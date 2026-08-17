import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.ArrayReference;
import com.sun.jdi.Bootstrap;
import com.sun.jdi.Field;
import com.sun.jdi.IncompatibleThreadStateException;
import com.sun.jdi.LocalVariable;
import com.sun.jdi.Location;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.PrimitiveValue;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.StackFrame;
import com.sun.jdi.StringReference;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.Value;
import com.sun.jdi.VirtualMachine;
import com.sun.jdi.VoidValue;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.IllegalConnectorArgumentsException;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.connect.VMStartException;
import com.sun.jdi.event.BreakpointEvent;
import com.sun.jdi.event.ClassPrepareEvent;
import com.sun.jdi.event.Event;
import com.sun.jdi.event.EventSet;
import com.sun.jdi.event.ExceptionEvent;
import com.sun.jdi.event.VMDeathEvent;
import com.sun.jdi.event.VMDisconnectEvent;
import com.sun.jdi.event.VMStartEvent;
import com.sun.jdi.request.BreakpointRequest;
import com.sun.jdi.request.ClassPrepareRequest;
import com.sun.jdi.request.EventRequest;
import com.sun.jdi.request.EventRequestManager;
import com.sun.jdi.request.ExceptionRequest;

import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Trusted supervisor: compiles learner Java, launches it as a debuggee JVM,
 * and emits JSON snapshots from JDI. The learner JVM is a child process.
 */
public final class BrooExecutor {
    private static final int MAX_HEAP = 48;
    private static final int MAX_ARRAY = 24;
    private static final int MAX_FIELDS = 16;
    private static final int MAX_FRAMES = 8;

    public static void main(String[] args) {
        if (args.length < 5) {
            emit("{\"t\":\"denied\",\"reason\":\"missing arguments\"}");
            System.exit(2);
            return;
        }
        Path dir = Path.of(args[0]).toAbsolutePath().normalize();
        String className = args[1];
        long timeoutMs = Long.parseLong(args[3]);
        int maxSteps = Integer.parseInt(args[4]);
        int maxOutput = args.length > 5 ? Integer.parseInt(args[5]) : 65536;

        try {
            if (!Files.isDirectory(dir)) {
                emit("{\"t\":\"denied\",\"reason\":\"sandbox missing\"}");
                System.exit(2);
                return;
            }
            compile(dir, className);
            runDebuggee(dir, className, timeoutMs, maxSteps, maxOutput);
        } catch (CompileFailed e) {
            System.exit(0);
        } catch (Exception e) {
            emit("{\"t\":\"denied\",\"reason\":\"" + esc(e.getClass().getSimpleName() + ": " + e.getMessage()) + "\"}");
            System.exit(1);
        }
    }

    private static void compile(Path dir, String className) throws IOException, CompileFailed {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            emit("{\"t\":\"denied\",\"reason\":\"JDK compiler unavailable. BrooExecutor must run on a JDK.\"}");
            throw new CompileFailed();
        }
        Path src = dir.resolve(className + ".java");
        if (!Files.isRegularFile(src)) {
            emit("{\"t\":\"compileError\",\"msg\":\"Missing " + esc(className) + ".java\"}");
            throw new CompileFailed();
        }
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        try (StandardJavaFileManager fm = compiler.getStandardFileManager(diagnostics, null, StandardCharsets.UTF_8)) {
            Iterable<? extends JavaFileObject> units = fm.getJavaFileObjectsFromFiles(List.of(src.toFile()));
            List<String> options = List.of("-d", dir.toString(), "-cp", dir.toString(), "-encoding", "UTF-8", "-proc:none", "-g");
            boolean ok = compiler.getTask(null, fm, diagnostics, options, null, units).call();
            for (Diagnostic<? extends JavaFileObject> d : diagnostics.getDiagnostics()) {
                if (d.getKind() != Diagnostic.Kind.ERROR) continue;
                long line = d.getLineNumber();
                long col = d.getColumnNumber();
                emit("{\"t\":\"compileError\",\"line\":" + line + ",\"col\":" + col + ",\"msg\":\"" + esc(String.valueOf(d.getMessage(null))) + "\"}");
            }
            if (!ok) throw new CompileFailed();
        }
    }

    private static void runDebuggee(Path dir, String className, long timeoutMs, int maxSteps, int maxOutput)
            throws Exception {
        LaunchingConnector connector = Bootstrap.virtualMachineManager().defaultConnector();
        Map<String, Connector.Argument> cargs = connector.defaultArguments();
        cargs.get("main").setValue(className);
        if (cargs.get("home") != null) {
            cargs.get("home").setValue(System.getProperty("java.home"));
        }
        String cp = dir.toString();
        String options = "-cp " + quote(cp) + " -Xmx64m -Xss256k -Djava.awt.headless=true -Dfile.encoding=UTF-8";
        cargs.get("options").setValue(options);
        if (cargs.containsKey("suspend")) cargs.get("suspend").setValue("true");

        VirtualMachine vm;
        try {
            vm = connector.launch(cargs);
        } catch (VMStartException | IllegalConnectorArgumentsException e) {
            emit("{\"t\":\"denied\",\"reason\":\"" + esc("launch failed: " + e.getMessage()) + "\"}");
            return;
        }

        AtomicLong outBytes = new AtomicLong();
        AtomicBoolean timedOut = new AtomicBoolean(false);
        AtomicInteger steps = new AtomicInteger();
        Thread outPump = pump(vm.process().getInputStream(), "stdout", outBytes, maxOutput);
        Thread errPump = pump(vm.process().getErrorStream(), "stderr", outBytes, maxOutput);
        outPump.start();
        errPump.start();

        Thread watchdog = Thread.ofPlatform().daemon().start(() -> {
            try {
                Thread.sleep(timeoutMs);
                timedOut.set(true);
                destroyVm(vm);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        });

        EventRequestManager erm = vm.eventRequestManager();
        ClassPrepareRequest cpr = erm.createClassPrepareRequest();
        cpr.addClassFilter(className);
        cpr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        cpr.enable();
        ExceptionRequest exReq = erm.createExceptionRequest(null, true, true);
        exReq.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        exReq.enable();

        boolean started = false;
        int exitCode = 0;
        try {
            vm.resume();
            while (!timedOut.get()) {
                EventSet set = vm.eventQueue().remove(250);
                if (set == null) {
                    if (vm.process() != null && !vm.process().isAlive() && started) break;
                    continue;
                }
                boolean resume = true;
                for (Event ev : set) {
                    if (ev instanceof VMStartEvent) {
                        started = true;
                    } else if (ev instanceof ClassPrepareEvent cpe) {
                        armBreakpoints(erm, cpe.referenceType());
                    } else if (ev instanceof BreakpointEvent be) {
                        int n = steps.incrementAndGet();
                        if (n <= maxSteps) emitSnapshot(be.thread(), be.location().lineNumber());
                        if (n >= maxSteps) {
                            timedOut.set(true);
                            destroyVm(vm);
                            resume = false;
                        }
                    } else if (ev instanceof ExceptionEvent ee) {
                        emitException(ee);
                    } else if (ev instanceof VMDeathEvent || ev instanceof VMDisconnectEvent) {
                        resume = false;
                    }
                }
                if (resume) {
                    try {
                        set.resume();
                    } catch (Exception ignored) {
                        break;
                    }
                } else {
                    break;
                }
            }
            if (vm.process() != null) {
                vm.process().waitFor(400, java.util.concurrent.TimeUnit.MILLISECONDS);
                if (vm.process().isAlive()) destroyVm(vm);
                Integer code = vm.process().exitValue();
                if (code != null) exitCode = code;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            destroyVm(vm);
        } catch (Exception e) {
            destroyVm(vm);
        } finally {
            watchdog.interrupt();
            try {
                vm.dispose();
            } catch (Exception ignored) {
            }
            destroyVm(vm);
            outPump.join(300);
            errPump.join(300);
        }

        emit("{\"t\":\"done\",\"exitCode\":" + exitCode + ",\"timedOut\":" + timedOut.get() + ",\"steps\":" + steps.get() + "}");
        if (timedOut.get()) {
            emit("{\"t\":\"timeout\"}");
        }
    }

    private static void armBreakpoints(EventRequestManager erm, ReferenceType type) {
        try {
            for (Location loc : type.allLineLocations()) {
                BreakpointRequest bp = erm.createBreakpointRequest(loc);
                bp.setSuspendPolicy(EventRequest.SUSPEND_ALL);
                bp.enable();
            }
        } catch (AbsentInformationException ignored) {
        }
    }

    private static void emitSnapshot(ThreadReference thread, int line) {
        try {
            StringBuilder frames = new StringBuilder();
            frames.append("[");
            Map<Long, ObjectReference> seen = new HashMap<>();
            ArrayDeque<ObjectReference> q = new ArrayDeque<>();
            int frameCount = Math.min(MAX_FRAMES, thread.frameCount());
            for (int i = 0; i < frameCount; i++) {
                if (i > 0) frames.append(",");
                StackFrame frame = thread.frame(i);
                frames.append("{\"method\":\"").append(esc(frame.location().method().name())).append("\"");
                frames.append(",\"line\":").append(frame.location().lineNumber());
                frames.append(",\"vars\":[");
                try {
                    List<LocalVariable> vars = frame.visibleVariables();
                    Map<LocalVariable, Value> values = frame.getValues(vars);
                    int vi = 0;
                    for (LocalVariable lv : vars) {
                        if (lv.name().contains("this") && i == 0 && "main".equals(frame.location().method().name())) {
                            // keep this if present
                        }
                        if (vi++ > 0) frames.append(",");
                        frames.append("{\"name\":\"").append(esc(lv.name())).append("\",\"value\":");
                        frames.append(valueJson(values.get(lv), q, seen));
                        frames.append("}");
                    }
                } catch (AbsentInformationException e) {
                    // compiled without -g; still have objects if we can
                }
                frames.append("]}");
            }
            frames.append("]");
            String heap = heapJson(q, seen);
            emit("{\"t\":\"snapshot\",\"snap\":{\"line\":" + line + ",\"frames\":" + frames + ",\"heap\":" + heap + "}}");
        } catch (IncompatibleThreadStateException e) {
            emit("{\"t\":\"stderr\",\"d\":\"" + esc("snapshot skipped: " + e.getMessage()) + "\"}");
        }
    }

    private static String heapJson(ArrayDeque<ObjectReference> q, Map<Long, ObjectReference> seen) {
        StringBuilder heap = new StringBuilder();
        heap.append("[");
        int n = 0;
        Set<Long> dumped = new HashSet<>();
        while (!q.isEmpty() && n < MAX_HEAP) {
            ObjectReference obj = q.removeFirst();
            long id = obj.uniqueID();
            if (!dumped.add(id)) continue;
            if (n++ > 0) heap.append(",");
            heap.append(objectJson(obj, q, seen));
        }
        heap.append("]");
        return heap.toString();
    }

    private static String objectJson(ObjectReference obj, ArrayDeque<ObjectReference> q, Map<Long, ObjectReference> seen) {
        String type = obj.referenceType().name();
        String kind = "object";
        if (obj instanceof ArrayReference) kind = "array";
        if (obj instanceof StringReference) kind = "string";
        StringBuilder sb = new StringBuilder();
        sb.append("{\"id\":\"").append(idOf(obj)).append("\",\"kind\":\"").append(kind).append("\",\"type\":\"")
                .append(esc(simpleType(type))).append("\",\"slots\":[");
        if (obj instanceof StringReference str) {
            sb.append("{\"key\":\"chars\",\"value\":{\"k\":\"prim\",\"v\":\"").append(esc(str.value())).append("\",\"type\":\"String\"}}");
        } else if (obj instanceof ArrayReference arr) {
            int len = arr.length();
            int show = Math.min(MAX_ARRAY, len);
            List<Value> values = arr.getValues(0, show);
            for (int i = 0; i < values.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append("{\"key\":\"").append(i).append("\",\"value\":").append(valueJson(values.get(i), q, seen)).append("}");
            }
            if (len > show) {
                sb.append(",{\"key\":\"…\",\"value\":{\"k\":\"prim\",\"v\":\"len=").append(len).append("\",\"type\":\"int\"}}");
            }
        } else {
            List<Field> fields = obj.referenceType().visibleFields();
            int i = 0;
            for (Field f : fields) {
                if (f.isStatic()) continue;
                if (i >= MAX_FIELDS) break;
                if (i++ > 0) sb.append(",");
                Value v = obj.getValue(f);
                sb.append("{\"key\":\"").append(esc(f.name())).append("\",\"value\":").append(valueJson(v, q, seen)).append("}");
            }
        }
        sb.append("]}");
        return sb.toString();
    }

    private static String valueJson(Value v, ArrayDeque<ObjectReference> q, Map<Long, ObjectReference> seen) {
        if (v == null || v instanceof VoidValue) return "{\"k\":\"null\"}";
        if (v instanceof PrimitiveValue pv) {
            String type = pv.type().name();
            return "{\"k\":\"prim\",\"v\":\"" + esc(pv.toString()) + "\",\"type\":\"" + esc(simpleType(type)) + "\"}";
        }
        if (v instanceof ObjectReference obj) {
            long id = obj.uniqueID();
            if (!seen.containsKey(id)) {
                seen.put(id, obj);
                q.add(obj);
            }
            String type = obj.referenceType().name();
            return "{\"k\":\"ref\",\"id\":\"" + idOf(obj) + "\",\"type\":\"" + esc(simpleType(type)) + "\"}";
        }
        return "{\"k\":\"prim\",\"v\":\"" + esc(v.toString()) + "\",\"type\":\"unknown\"}";
    }

    private static String idOf(ObjectReference obj) {
        return Long.toString(obj.uniqueID());
    }

    private static String simpleType(String type) {
        int slash = type.lastIndexOf('.');
        return slash >= 0 ? type.substring(slash + 1) : type;
    }

    private static void emitException(ExceptionEvent ee) {
        String type = ee.exception().referenceType().name();
        String msg = "";
        try {
            Field detail = ee.exception().referenceType().fieldByName("detailMessage");
            if (detail != null) {
                Value v = ee.exception().getValue(detail);
                if (v instanceof StringReference s) msg = s.value();
            }
        } catch (Exception ignored) {
        }
        String loc = "";
        try {
            loc = ee.catchLocation() == null
                    ? ee.location().method().name() + ":" + ee.location().lineNumber()
                    : "";
            loc = ee.location().declaringType().name() + "." + ee.location().method().name() + ":" + ee.location().lineNumber();
        } catch (Exception ignored) {
        }
        emit("{\"t\":\"exception\",\"type\":\"" + esc(simpleType(type)) + "\",\"msg\":\"" + esc(msg)
                + "\",\"stack\":\"" + esc(loc) + "\"}");
    }

    private static Thread pump(InputStream in, String kind, AtomicLong outBytes, int maxOutput) {
        return Thread.ofPlatform().daemon().unstarted(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                char[] buf = new char[512];
                int n;
                while ((n = br.read(buf)) >= 0) {
                    if (n == 0) continue;
                    long soFar = outBytes.addAndGet(n);
                    if (soFar > maxOutput) {
                        emit("{\"t\":\"" + kind + "\",\"d\":\"" + esc("\\n[output truncated]\\n") + "\"}");
                        break;
                    }
                    emit("{\"t\":\"" + kind + "\",\"d\":\"" + esc(new String(buf, 0, n)) + "\"}");
                }
            } catch (IOException ignored) {
            }
        });
    }

    private static void destroyVm(VirtualMachine vm) {
        try {
            Process p = vm.process();
            if (p != null && p.isAlive()) {
                p.descendants().forEach(ProcessHandle::destroyForcibly);
                p.destroyForcibly();
            }
        } catch (Exception ignored) {
        }
        try {
            vm.exit(1);
        } catch (Exception ignored) {
        }
    }

    private static String quote(String path) {
        if (path.contains(" ")) return "\"" + path + "\"";
        return path;
    }

    private static void emit(String json) {
        synchronized (System.out) {
            System.out.println(json);
            System.out.flush();
        }
    }

    private static String esc(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> {
                    if (c < 32) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
                }
            }
        }
        return b.toString();
    }

    private static final class CompileFailed extends Exception {
        CompileFailed() { super("compile failed"); }
    }
}
