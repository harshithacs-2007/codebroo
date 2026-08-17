import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import {
  TWO_REMOTE_CONTROLS,
  applyDebug,
  applyExplanation,
  applyMasteryCheck,
  applyPrediction,
  applyRun,
  applyTransfer,
  EMPTY_EVIDENCE,
  getLesson,
  isMastered,
  listLessons,
  overallMastery,
  scoreExplanation,
  severityFor,
  tutorFor,
  reactToPrediction,
  type MasteryEvidence,
  type MistakeType,
} from "@codebroo/core";
import { openDb } from "./db.ts";
import { makeSessionToken, newLearnerId, readSessionToken } from "./session.ts";
import { runJava, stopJava, type ExecConfig } from "./run-java.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
loadDotEnv(join(root, ".env"));

const isProd = process.env.NODE_ENV === "production";
const secret = process.env.CODEBROO_SECRET || "";
if (isProd && (secret.length < 24 || secret === "dev-only-change-me" || secret === "change-me-to-a-long-random-secret")) {
  console.error("CODEBROO_SECRET must be a long random value in production.");
  process.exit(1);
}
const effectiveSecret = secret || "dev-only-change-me";
const port = Number(process.env.CODEBROO_PORT || 8787);
const host = process.env.CODEBROO_HOST || (isProd ? "0.0.0.0" : "127.0.0.1");
const dataDir = process.env.CODEBROO_DATA_DIR || join(root, "data");
const sandboxDir = process.env.CODEBROO_SANDBOX_DIR || join(root, "sandbox");
const webDist = process.env.CODEBROO_WEB_DIST || join(root, "apps", "web", "dist");
const allowedOrigins = (process.env.CODEBROO_ALLOWED_ORIGINS || process.env.CODEBROO_PUBLIC_ORIGIN || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const cfg: ExecConfig = {
  executorCp: join(root, "apps", "executor", "classes"),
  sandboxRoot: sandboxDir,
  timeoutMs: Number(process.env.CODEBROO_EXEC_TIMEOUT_MS || 5000),
  maxOutput: Number(process.env.CODEBROO_MAX_OUTPUT_BYTES || 65536),
  maxSource: Number(process.env.CODEBROO_MAX_SOURCE_BYTES || 32768),
  concurrency: Number(process.env.CODEBROO_EXEC_CONCURRENCY || 2),
  maxSteps: 600,
};

const db = openDb(join(dataDir, "codebroo.db"));
const app = new Hono();

const runWindow = new Map<string, number[]>();

function corsOrigin(origin: string): string | undefined {
  const o = origin.replace(/\/$/, "");
  if (allowedOrigins.includes(o)) return origin;
  if (!isProd && (/^http:\/\/localhost:\d+$/.test(o) || /^http:\/\/127\.0\.0\.1:\d+$/.test(o))) return origin;
  return undefined;
}

app.use("*", async (c, next) => {
  const started = Date.now();
  await next();
  const path = new URL(c.req.url).pathname;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      method: c.req.method,
      path,
      status: c.res.status,
      ms: Date.now() - started,
    }),
  );
});

app.use(
  "*",
  cors({
    origin: (origin) => (origin ? corsOrigin(origin) : undefined),
    credentials: true,
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use("*", secureHeaders());
app.use("/api/*", bodyLimit({ maxSize: 80 * 1024, onError: (c) => c.json({ error: "payload too large" }, 413) }));

function learnerId(c: { req: { raw: Request }; header: (n: string) => string | undefined }): string {
  const token = getCookie(c as never, "broo_sid");
  const existing = readSessionToken(effectiveSecret, token);
  if (existing) {
    db.prepare("UPDATE learners SET last_seen = ? WHERE id = ?").run(Date.now(), existing);
    return existing;
  }
  const id = newLearnerId();
  const now = Date.now();
  db.prepare("INSERT INTO learners (id, name, created_at, last_seen) VALUES (?, ?, ?, ?)").run(id, "learner", now, now);
  setCookie(c as never, "broo_sid", makeSessionToken(effectiveSecret, id), {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: isProd,
  });
  return id;
}

function loadEvidence(id: string, lessonId: string): MasteryEvidence {
  const row = db.prepare("SELECT evidence FROM mastery WHERE learner_id = ? AND lesson_id = ?").get(id, lessonId) as
    | { evidence: string }
    | undefined;
  if (!row) return { ...EMPTY_EVIDENCE };
  try {
    return { ...EMPTY_EVIDENCE, ...JSON.parse(row.evidence) };
  } catch {
    return { ...EMPTY_EVIDENCE };
  }
}

function saveEvidence(id: string, lessonId: string, evidence: MasteryEvidence, mastered: boolean) {
  db.prepare(
    `INSERT INTO mastery (learner_id, lesson_id, evidence, mastered, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(learner_id, lesson_id) DO UPDATE SET evidence=excluded.evidence, mastered=excluded.mastered, updated_at=excluded.updated_at`,
  ).run(id, lessonId, JSON.stringify(evidence), mastered ? 1 : 0, Date.now());
}

function noteMistake(id: string, concept: string, type: MistakeType, recovered: boolean) {
  const now = Date.now();
  const row = db
    .prepare("SELECT frequency, recovered FROM mistakes WHERE learner_id = ? AND concept = ? AND type = ?")
    .get(id, concept, type) as { frequency: number; recovered: number } | undefined;
  if (!row) {
    db.prepare(
      "INSERT INTO mistakes (learner_id, concept, type, frequency, recency, severity, recovered) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, concept, type, recovered ? 0 : 1, now, severityFor(type), recovered ? 1 : 0);
    return;
  }
  const freq = recovered ? row.frequency : row.frequency + 1;
  db.prepare(
    "UPDATE mistakes SET frequency = ?, recency = ?, severity = ?, recovered = ? WHERE learner_id = ? AND concept = ? AND type = ?",
  ).run(freq, now, severityFor(type), recovered ? 1 : 0, id, concept, type);
}

function mistakesOf(id: string) {
  return db
    .prepare("SELECT concept, type, frequency, recency, severity, recovered FROM mistakes WHERE learner_id = ?")
    .all(id) as Array<{
    concept: string;
    type: MistakeType;
    frequency: number;
    recency: number;
    severity: number;
    recovered: number;
  }>;
}

function allowRun(id: string): string | null {
  const now = Date.now();
  const arr = (runWindow.get(id) ?? []).filter((t) => now - t < 30_000);
  if (arr.length && now - arr[arr.length - 1] < 400) return "Slow down. The JVM is not a fidget toy.";
  if (arr.length >= 8) return "Too many runs in 30s. Read the last error first.";
  arr.push(now);
  runWindow.set(id, arr);
  return null;
}

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    java: existsSync(join(cfg.executorCp, "BrooExecutor.class")),
    time: Date.now(),
  }),
);

app.get("/api/me", (c) => {
  const id = learnerId(c);
  const row = db.prepare("SELECT id, name, created_at FROM learners WHERE id = ?").get(id) as
    | { id: string; name: string; created_at: number }
    | undefined;
  return c.json({ learner: row });
});

app.post("/api/me", async (c) => {
  const id = learnerId(c);
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.slice(0, 40).trim() : "";
  if (name) db.prepare("UPDATE learners SET name = ? WHERE id = ?").run(name, id);
  return c.json({ ok: true });
});

app.get("/api/lessons", (c) => {
  learnerId(c);
  return c.json({
    lessons: listLessons().map((l) => ({
      id: l.id,
      title: l.title,
      subtitle: l.subtitle,
      track: l.track,
      skills: l.skills,
    })),
  });
});

app.get("/api/lessons/:id", (c) => {
  const id = learnerId(c);
  const lesson = getLesson(c.req.param("id"));
  if (!lesson) return c.json({ error: "Unknown lesson" }, 404);
  const progress = db
    .prepare("SELECT block_index, unlocked_run FROM progress WHERE learner_id = ? AND lesson_id = ?")
    .get(id, lesson.id) as { block_index: number; unlocked_run: number } | undefined;
  const evidence = loadEvidence(id, lesson.id);
  const mastered = isMastered(
    evidence,
    mistakesOf(id).map((m) => ({ type: m.type, recovered: m.recovered === 1 })),
  );
  return c.json({
    lesson,
    progress: progress ?? { block_index: 0, unlocked_run: 0 },
    evidence,
    overall: overallMastery(evidence),
    mastered,
    mistakes: mistakesOf(id),
  });
});

app.post("/api/lessons/:id/progress", async (c) => {
  const id = learnerId(c);
  const lesson = getLesson(c.req.param("id"));
  if (!lesson) return c.json({ error: "Unknown lesson" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const blockIndex = Number(body.blockIndex ?? 0);
  const unlockedRun = body.unlockedRun ? 1 : 0;
  if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= lesson.blocks.length) {
    return c.json({ error: "Invalid block" }, 400);
  }
  db.prepare(
    `INSERT INTO progress (learner_id, lesson_id, block_index, unlocked_run, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(learner_id, lesson_id) DO UPDATE SET block_index=excluded.block_index, unlocked_run=excluded.unlocked_run, updated_at=excluded.updated_at`,
  ).run(id, lesson.id, blockIndex, unlockedRun, Date.now());
  return c.json({ ok: true });
});

app.post("/api/lessons/:id/predict", async (c) => {
  const id = learnerId(c);
  const lesson = getLesson(c.req.param("id"));
  if (!lesson) return c.json({ error: "Unknown lesson" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const block = lesson.blocks.find((b) => b.id === body.blockId);
  if (!block || (block.kind !== "predict" && block.kind !== "transfer")) {
    return c.json({ error: "Not a prediction" }, 400);
  }
  const choiceId = String(body.choiceId ?? "");
  const firstTry = Boolean(body.firstTry);
  const latencyMs = Number(body.latencyMs ?? 0);
  const correct = choiceId === block.correctId;
  let evidence = loadEvidence(id, lesson.id);
  if (block.kind === "predict") evidence = applyPrediction(evidence, correct, firstTry, latencyMs);
  else evidence = applyTransfer(evidence, correct, firstTry);
  const mtype = block.misconception[choiceId];
  if (mtype) noteMistake(id, "references", mtype, false);
  if (correct) noteMistake(id, "references", "alias-as-copy", true);
  const mastered = isMastered(
    evidence,
    mistakesOf(id).map((m) => ({ type: m.type, recovered: m.recovered === 1 })),
  );
  saveEvidence(id, lesson.id, evidence, mastered);
  db.prepare(
    "INSERT INTO attempts (learner_id, lesson_id, block_id, kind, payload, correct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, lesson.id, block.id, block.kind, JSON.stringify({ choiceId }), correct ? 1 : 0, Date.now());
  const tutor = correct
    ? reactToPrediction(true, block.choices.find((x) => x.id === choiceId)?.label ?? choiceId)
    : reactToPrediction(false, block.choices.find((x) => x.id === choiceId)?.label ?? choiceId);
  return c.json({
    correct,
    tutor,
    evidence,
    overall: overallMastery(evidence),
    mastered,
    reveal: block.kind === "predict" ? (correct || body.revealAnyway ? block.reveal : []) : block.why,
  });
});

app.post("/api/lessons/:id/explain", async (c) => {
  const id = learnerId(c);
  const lesson = getLesson(c.req.param("id"));
  if (!lesson) return c.json({ error: "Unknown lesson" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const block = lesson.blocks.find((b) => b.id === body.blockId && b.kind === "explain");
  if (!block || block.kind !== "explain") return c.json({ error: "Not an explain block" }, 400);
  const text = String(body.text ?? "").slice(0, 4000);
  const scored = scoreExplanation(text, block.mustInclude, block.traps);
  let evidence = applyExplanation(loadEvidence(id, lesson.id), scored.score);
  if (scored.hitTrap) noteMistake(id, "references", "incomplete-explanation", false);
  if (scored.score >= 0.7) noteMistake(id, "references", "incomplete-explanation", true);
  const mastered = isMastered(
    evidence,
    mistakesOf(id).map((m) => ({ type: m.type, recovered: m.recovered === 1 })),
  );
  saveEvidence(id, lesson.id, evidence, mastered);
  db.prepare(
    "INSERT INTO attempts (learner_id, lesson_id, block_id, kind, payload, correct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, lesson.id, block.id, "explain", JSON.stringify({ text, score: scored.score }), scored.score >= 0.7 ? 1 : 0, Date.now());
  const level = scored.score >= 0.7 ? 0 : scored.hitTrap ? 1 : 0;
  const tutor = tutorFor({
    topic: "explain",
    level: scored.score >= 0.7 ? 2 : level,
    extra: scored.missing.length ? `Still unused words: ${scored.missing.join(", ")}.` : undefined,
  });
  return c.json({ score: scored.score, missing: scored.missing, hitTrap: scored.hitTrap, tutor, evidence, mastered, overall: overallMastery(evidence) });
});

app.post("/api/lessons/:id/mastery", async (c) => {
  const id = learnerId(c);
  const lesson = getLesson(c.req.param("id"));
  if (!lesson) return c.json({ error: "Unknown lesson" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const block = lesson.blocks.find((b) => b.id === body.blockId && b.kind === "mastery");
  if (!block || block.kind !== "mastery") return c.json({ error: "Not a mastery block" }, 400);
  const answers = (body.answers ?? {}) as Record<string, string>;
  let correctCount = 0;
  const results = block.checks.map((ch) => {
    const ok = answers[ch.id] === ch.correctId;
    if (ok) correctCount++;
    return { id: ch.id, correct: ok, correctId: ch.correctId };
  });
  let evidence = applyMasteryCheck(loadEvidence(id, lesson.id), correctCount, block.checks.length);
  const mastered = isMastered(
    evidence,
    mistakesOf(id).map((m) => ({ type: m.type, recovered: m.recovered === 1 })),
  );
  saveEvidence(id, lesson.id, evidence, mastered);
  return c.json({ results, correctCount, total: block.checks.length, evidence, overall: overallMastery(evidence), mastered });
});

app.post("/api/lessons/:id/hint", async (c) => {
  learnerId(c);
  const body = await c.req.json().catch(() => ({}));
  const topic = ["predict", "alias", "debug", "explain", "equals"].includes(body.topic) ? body.topic : "alias";
  const level = Math.max(0, Math.min(4, Number(body.level ?? 0)));
  return c.json({ tutor: tutorFor({ topic, level, mistake: body.mistake }) });
});

app.post("/api/stop", (c) => {
  const id = learnerId(c);
  return c.json({ stopped: stopJava(id) });
});

app.post("/api/run", async (c) => {
  const id = learnerId(c);
  const limited = allowRun(id);
  if (limited) return c.json({ error: limited }, 429);
  const body = await c.req.json().catch(() => ({}));
  const source = String(body.source ?? "");
  const lessonId = String(body.lessonId ?? TWO_REMOTE_CONTROLS.id);
  const blockId = String(body.blockId ?? "");
  const lesson = getLesson(lessonId);
  if (!lesson) return c.json({ error: "Unknown lesson" }, 404);
  const result = await runJava({ source, cfg, sessionId: id });
  let evidence = applyRun(loadEvidence(id, lessonId), result.compileErrors.length === 0, !result.timedOut && !result.denied);
  const block = lesson.blocks.find((b) => b.id === blockId);
  if (block?.kind === "debug" && result.stdout.includes(block.passWhen.stdoutIncludes ?? "\u0000")) {
    const hintsUsed = Number(body.hintsUsed ?? 0);
    evidence = applyDebug(evidence, true, hintsUsed);
    noteMistake(id, "references", "alias-as-copy", true);
  }
  const mastered = isMastered(
    evidence,
    mistakesOf(id).map((m) => ({ type: m.type, recovered: m.recovered === 1 })),
  );
  saveEvidence(id, lessonId, evidence, mastered);
  db.prepare(
    "INSERT INTO attempts (learner_id, lesson_id, block_id, kind, payload, correct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    lessonId,
    blockId,
    "run",
    JSON.stringify({
      ok: result.ok,
      timedOut: result.timedOut,
      compile: result.compileErrors.length,
    }),
    result.ok ? 1 : 0,
    Date.now(),
  );
  return c.json({ result, evidence, overall: overallMastery(evidence), mastered });
});

app.get("/api/skills", (c) => {
  const id = learnerId(c);
  const evidence = loadEvidence(id, TWO_REMOTE_CONTROLS.id);
  return c.json({
    skills: [
      { id: "java-fundamentals", label: "Java Fundamentals", value: evidence.understanding },
      { id: "references", label: "References", value: Math.max(evidence.prediction, evidence.understanding) },
      { id: "debugging", label: "Debugging", value: evidence.debugging },
      { id: "code-reading", label: "Code Reading", value: evidence.codeReading },
      { id: "code-writing", label: "Code Writing", value: evidence.codeWriting },
      { id: "explanation", label: "Explanation", value: evidence.explanation },
    ],
    mistakes: mistakesOf(id),
    overall: overallMastery(evidence),
    mastered: isMastered(
      evidence,
      mistakesOf(id).map((m) => ({ type: m.type, recovered: m.recovered === 1 })),
    ),
  });
});

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

app.get("/*", async (c) => {
  if (!existsSync(webDist)) return c.json({ error: "web bundle not built" }, 404);
  const urlPath = decodeURIComponent(new URL(c.req.url).pathname);
  if (urlPath.includes("..")) return c.json({ error: "bad path" }, 400);
  let file = join(webDist, urlPath === "/" ? "index.html" : urlPath);
  if (!existsSync(file) || extname(file) === "") file = join(webDist, "index.html");
  const body = readFileSync(file);
  return new Response(body, { headers: { "content-type": mime[extname(file)] || "application/octet-stream" } });
});

function loadDotEnv(path: string) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

if (!existsSync(join(cfg.executorCp, "BrooExecutor.class"))) {
  console.warn("BrooExecutor.class missing — run npm run executor:build");
}

serve({ fetch: app.fetch, port, hostname: host, createServer }, () => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg: "listening", host, port, prod: isProd }));
});
