const FORBIDDEN = [
  { re: /\bRuntime\b/, reason: "Runtime is blocked in the playground." },
  { re: /\bProcessBuilder\b/, reason: "Process spawning is blocked." },
  { re: /\bProcessHandle\b/, reason: "Process handles are blocked." },
  { re: /\bSystem\s*\.\s*(exit|halt|setSecurityManager|getProperties|setProperty)\b/, reason: "JVM/host property control APIs are blocked." },
  { re: /\bSystem\s*\.\s*getenv\b/, reason: "Environment access is blocked." },
  { re: /\bSystem\s*\.\s*getProperty\b/, reason: "Host property probing is blocked." },
  { re: /\bClass\s*\.\s*forName\b/, reason: "Dynamic class loading is blocked." },
  { re: /\b(Class|ClassLoader|URLClassLoader|MethodHandles|MethodType|AccessibleObject|Method|Field|Constructor|Proxy|InvocationHandler)\b/, reason: "Dynamic code loading/reflection is blocked." },
  { re: /\b(ReflectiveOperationException|InvocationTargetException)\b/, reason: "Reflection is blocked." },
  { re: /\b(java\.lang\.reflect|java\.lang\.invoke)\b/, reason: "Reflection/invoke packages are blocked." },
  { re: /\bUnsafe\b/, reason: "Unsafe is blocked." },
  { re: /\bJNI\b/, reason: "Native interfaces are blocked." },
  { re: /\b(java\.net\.|Socket|ServerSocket|DatagramSocket|HttpClient|URLConnection)\b/, reason: "Network APIs are blocked." },
  { re: /\b(java\.nio\.|java\.nio\.file\.)\b/, reason: "NIO/filesystem APIs are blocked." },
  { re: /\b(java\.io\.|FileInputStream|FileOutputStream|FileReader|FileWriter|RandomAccessFile)\b/, reason: "Filesystem I/O is blocked in the playground." },
  { re: /\b(Files|Path|File)\s*\./, reason: "Filesystem APIs are blocked in the playground." },
  { re: /\b(Thread|ThreadGroup|Executor|ExecutorService|ForkJoinPool)\b/, reason: "User-created concurrency is blocked in this playground." },
  { re: /\b(java\.security\.|javax\.crypto\.|javax\.management\.)\b/, reason: "Host/security probing APIs are blocked." },
  { re: /\b(sun\.|jdk\.internal\.|com\.sun\.)/, reason: "Internal JDK APIs are blocked." },
  { re: /\/proc(?:\/|\b)|C:\\\\Windows/i, reason: "Path looks like host probing." },
  { re: /^\s*package\s+/m, reason: "Package declarations are blocked in the playground." },
];

const SAFE_IMPORT = /^\s*import\s+(?:static\s+)?(?:java\.util(?:\.[A-Za-z_$][A-Za-z0-9_$]*)?|java\.math\.[A-Za-z_$][A-Za-z0-9_$]*);\s*$/;

export function inspectSource(source: string, maxBytes: number): string | null {
  const bytes = new TextEncoder().encode(source).byteLength;
  if (bytes === 0) return "Source is empty.";
  if (bytes > maxBytes) return `Source exceeds ${maxBytes} bytes.`;
  if (source.includes("\0")) return "Source contains a null byte.";

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) continue;
    if (line.startsWith("import ")) {
      if (!SAFE_IMPORT.test(line)) return "Only approved Java utility/math imports are allowed.";
    }
  }

  for (const rule of FORBIDDEN) {
    if (rule.re.test(source)) return rule.reason;
  }
  return null;
}

export function extractPublicClass(source: string): string | null {
  const m = source.match(/public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return m?.[1] ?? null;
}
