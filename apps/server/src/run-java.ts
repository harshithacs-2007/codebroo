import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { inspectSource, extractPublicClass, type ExecEvent, type ExecutionResult, type Snapshot } from "@codebroo/core";

export type ExecConfig = {
  executorCp: string;
  sandboxRoot: string;
  timeoutMs: number;
  maxOutput: number;
  maxSource: number;
  concurrency: number;
  maxSteps: number;
};

type Gate = { active: number; wait: Array<() => void> };

function take(gate: Gate, limit: number): Promise<void> {
  if (gate.active < limit) {
    gate.active++;
    return Promise.resolve();
  }
  return new Promise((res) => {
    gate.wait.push(() => {
      gate.active++;
      res();
    });
  });
}

function release(gate: Gate) {
  gate.active--;
  const n = gate.wait.shift();
  if (n) n();
}

const gate: Gate = { active: 0, wait: [] };
const running = new Map<string, { kill: () => void }>();

function isInside(root: string, candidate: string): boolean {
  const r = resolve(root) + sep;
  const c = resolve(candidate) + sep;
  return c.startsWith(r);
}

export function stopJava(sessionId: string): boolean {
  const job = running.get(sessionId);
  if (!job) return false;
  job.kill();
  return true;
}

export async function runJava(opts: {
  source: string;
  cfg: ExecConfig;
  sessionId: string;
}): Promise<ExecutionResult> {
  const started = Date.now();
  const denied = inspectSource(opts.source, opts.cfg.maxSource);
  if (denied) {
    return emptyResult(started, { denied, events: [{ t: "denied", reason: denied }] });
  }
  const className = extractPublicClass(opts.source) ?? "Main";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(className)) {
    return emptyResult(started, { denied: "Invalid class name", events: [{ t: "denied", reason: "Invalid class name" }] });
  }

  await take(gate, opts.cfg.concurrency);
  const prev = running.get(opts.sessionId);
  prev?.kill();

  const runId = randomBytes(8).toString("hex");
  const dir = resolve(join(opts.cfg.sandboxRoot, opts.sessionId.slice(0, 12), runId));
  if (!isInside(opts.cfg.sandboxRoot, dir)) {
    release(gate);
    return emptyResult(started, { denied: "sandbox path rejected" });
  }

  let killed = false;
  let child: ReturnType<typeof spawn> | null = null;

  const kill = () => {
    killed = true;
    if (child?.pid) {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
  };
  running.set(opts.sessionId, { kill });

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${className}.java`), opts.source, "utf8");

    const events: ExecEvent[] = [];
    const snapshots: Snapshot[] = [];
    const compileErrors: ExecutionResult["compileErrors"] = [];
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let exception: ExecutionResult["exception"];
    let deniedReason: string | undefined;

    const args = [
      "--add-modules",
      "jdk.jdi",
      "-cp",
      opts.cfg.executorCp,
      "BrooExecutor",
      dir,
      className,
      "run",
      String(opts.cfg.timeoutMs),
      String(opts.cfg.maxSteps),
      String(opts.cfg.maxOutput),
    ];

    await new Promise<void>((resolvePromise, reject) => {
      child = spawn("java", args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const timer = setTimeout(() => {
        timedOut = true;
        kill();
      }, opts.cfg.timeoutMs + 2500);

      let buf = "";
      const onChunk = (chunk: Buffer, stream: "stdout" | "stderr") => {
        const text = chunk.toString("utf8");
        if (stream === "stderr") stderr += text;
        buf += text;
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("{")) continue;
          try {
            const ev = JSON.parse(line) as ExecEvent;
            events.push(ev);
            if (ev.t === "stdout") stdout += ev.d;
            if (ev.t === "stderr") stderr += ev.d;
            if (ev.t === "snapshot") snapshots.push(ev.snap);
            if (ev.t === "compileError") compileErrors.push({ line: ev.line, col: ev.col, msg: ev.msg });
            if (ev.t === "timeout") timedOut = true;
            if (ev.t === "denied") deniedReason = ev.reason;
            if (ev.t === "exception") exception = { type: ev.type, msg: ev.msg, stack: ev.stack };
          } catch {
            /* ignore malformed */
          }
        }
      };
      child.stdout?.on("data", (c) => onChunk(c, "stdout"));
      child.stderr?.on("data", (c) => onChunk(c, "stderr"));
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", () => {
        clearTimeout(timer);
        resolvePromise();
      });
    });

    if (killed && !timedOut && compileErrors.length === 0 && !deniedReason) {
      timedOut = true;
      events.push({ t: "timeout" });
    }

    return {
      ok: compileErrors.length === 0 && !timedOut && !deniedReason && !exception,
      events,
      stdout: stdout.slice(0, opts.cfg.maxOutput),
      stderr: stderr.slice(0, opts.cfg.maxOutput),
      snapshots,
      compileErrors,
      exception,
      timedOut,
      denied: deniedReason,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "executor failed";
    return emptyResult(started, {
      events: [{ t: "denied", reason: msg }],
      denied: msg,
    });
  } finally {
    running.delete(opts.sessionId);
    release(gate);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function emptyResult(started: number, extra: Partial<ExecutionResult> & { events?: ExecEvent[] }): ExecutionResult {
  return {
    ok: false,
    events: extra.events ?? [],
    stdout: "",
    stderr: "",
    snapshots: [],
    compileErrors: [],
    timedOut: extra.timedOut ?? false,
    denied: extra.denied,
    durationMs: Date.now() - started,
  };
}
