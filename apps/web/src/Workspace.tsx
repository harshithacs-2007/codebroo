import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CompanionState,
  ExecutionResult,
  Lesson,
  LessonBlock,
  MasteryEvidence,
  Snapshot,
  TutorTurn,
} from "@codebroo/core";
import { EMPTY_EVIDENCE, TWO_REMOTE_CONTROLS, type BuddyId } from "@codebroo/core";
import { api } from "./api";
import { Broo } from "./Broo";
import { HeapViz } from "./HeapViz";\nimport { BuddyPicker } from "./BuddyPicker";\nimport { BUDDIES } from "./buddies";

const JavaEditor = lazy(() => import("./JavaEditor").then((m) => ({ default: m.JavaEditor })));

const LESSON_ID = TWO_REMOTE_CONTROLS.id;

export function Workspace() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [index, setIndex] = useState(0);
  const [farthest, setFarthest] = useState(0);
  const [unlockedRun, setUnlockedRun] = useState(false);
  const [evidence, setEvidence] = useState<MasteryEvidence>(EMPTY_EVIDENCE);
  const [overall, setOverall] = useState(0);
  const [mastered, setMastered] = useState(false);
  const [skills, setSkills] = useState<Array<{ id: string; label: string; value: number }>>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [buddyId, setBuddyId] = useState<BuddyId>("mochi");
  const [showBuddyPicker, setShowBuddyPicker] = useState(false);

  const [choice, setChoice] = useState<string | null>(null);
  const [predictResult, setPredictResult] = useState<{ correct: boolean; reveal: string[] } | null>(null);
  const [firstTry, setFirstTry] = useState(true);
  const predictStarted = useRef(Date.now());

  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [snapIndex, setSnapIndex] = useState(0);
  const [tutor, setTutor] = useState<TutorTurn>({ text: "Predict first. Running is how we check, not how we guess.", companion: "idle", escalate: false });
  const [hintLevel, setHintLevel] = useState(0);
  const [explainText, setExplainText] = useState("");
  const [explainScore, setExplainScore] = useState<number | null>(null);
  const [masteryAnswers, setMasteryAnswers] = useState<Record<string, string>>({});
  const [masteryResult, setMasteryResult] = useState<Array<{ id: string; correct: boolean }> | null>(null);
  const [companion, setCompanion] = useState<CompanionState>("idle");
  const [hideBroo, setHideBroo] = useState(false);
  const [busy, setBusy] = useState(false);

  const buddy = BUDDIES.find((item) => item.id === buddyId) ?? BUDDIES[0];
  const journeyPercent = lesson ? Math.round(((index + 1) / Math.max(1, lesson.blocks.length)) * 100) : 0;

  const block: LessonBlock | undefined = lesson?.blocks[index];
  const snapshots = result?.snapshots ?? [];
  const snap = snapshots[Math.min(snapIndex, Math.max(0, snapshots.length - 1))] ?? null;
  const prev = snapshots[Math.max(0, snapIndex - 1)] ?? null;

  const load = useCallback(async () => {
    try {
      const me = await api.me();
      setBuddyId(me.learner.buddyId);
      setShowBuddyPicker(!me.learner.onboarded);

      const [l, s] = await Promise.all([api.lesson(LESSON_ID), api.skills()]);
      setLesson(l.lesson);
      setIndex(l.progress.block_index);
      setFarthest(l.progress.block_index);
      setUnlockedRun(Boolean(l.progress.unlocked_run));
      setEvidence(l.evidence);
      setOverall(l.overall);
      setMastered(l.mastered);
      setSkills(s.skills);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load lesson");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!block) return;
    if (block.kind === "run" || block.kind === "debug") {
      const next = block.kind === "run" ? block.code : block.brokenCode;
      setCode(next);
      setResult(null);
      setSnapIndex(0);
    }
    if (block.kind === "compare") {
      setCode(`public class Main {
    public static void main(String[] args) {
        int[] a = {10, 20, 30};
        int[] b = a;
        b[0] = 99;
        System.out.println("a[0]=" + a[0]);
        System.out.println("same=" + (a == b));
    }
}
`);
      setResult(null);
      setSnapIndex(0);
    }
    if (block.kind === "predict" || block.kind === "transfer") {
      setChoice(null);
      setPredictResult(null);
      setFirstTry(true);
      predictStarted.current = Date.now();
    }
    if (block.kind === "explain") {
      setExplainText("");
      setExplainScore(null);
    }
    if (block.kind === "mastery") {
      setMasteryAnswers({});
      setMasteryResult(null);
    }
    setHintLevel(0);
  }, [block?.id]);

  const canEnter = (i: number) => {
    if (!lesson) return false;
    const pred = lesson.blocks.findIndex((b) => b.kind === "predict");
    if (i > pred && !unlockedRun) return false;
    return i <= farthest + 1;
  };

  async function go(i: number) {
    if (!lesson || !canEnter(i)) return;
    setIndex(i);
    const far = Math.max(farthest, i);
    setFarthest(far);
    await api.progress(LESSON_ID, far, unlockedRun).catch(() => undefined);
  }

  async function chooseBuddy(next: BuddyId) {
    setBuddyId(next);
    setShowBuddyPicker(false);
    try {
      await api.updateProfile({ buddyId: next });
    } catch (e) {
      setShowBuddyPicker(true);
      setTutor({
        text: e instanceof Error ? e.message : "Couldn't save your buddy yet.",
        companion: "warning",
        escalate: false,
      });
    }
  }

  async function submitPredict() {
    if (!block || (block.kind !== "predict" && block.kind !== "transfer") || !choice || busy) return;
    setBusy(true);
    setCompanion("thinking");
    try {
      const res = await api.predict(LESSON_ID, {
        blockId: block.id,
        choiceId: choice,
        firstTry,
        latencyMs: Date.now() - predictStarted.current,
      });
      setPredictResult({ correct: res.correct, reveal: res.reveal });
      setTutor(res.tutor);
      setCompanion(res.tutor.companion);
      setEvidence(res.evidence);
      setOverall(res.overall);
      setMastered(res.mastered);
      if (res.correct && block.kind === "predict") {
        setUnlockedRun(true);
        await api.progress(LESSON_ID, index, true);
      }
      if (!res.correct) setFirstTry(false);
      const s = await api.skills();
      setSkills(s.skills);
    } catch (e) {
      setTutor({ text: e instanceof Error ? e.message : "Prediction failed to save.", companion: "warning", escalate: false });
      setCompanion("warning");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!block || running) return;
    if (block.kind === "run" || block.kind === "debug") {
      if (block.kind === "run" && lesson?.blocks[1]?.kind === "predict" && !unlockedRun) {
        setTutor({ text: "Guess first. Then we let the JVM talk.", companion: "warning", escalate: false });
        setCompanion("warning");
        return;
      }
    }
    setRunning(true);
    setCompanion("watching");
    setTutor({ text: "I'm watching the heap, not the theater.", companion: "watching", escalate: false });
    try {
      const res = await api.run({
        source: code,
        lessonId: LESSON_ID,
        blockId: block?.id,
        hintsUsed: hintLevel,
      });
      setResult(res.result);
      setSnapIndex(Math.max(0, res.result.snapshots.length - 1));
      setEvidence(res.evidence);
      setOverall(res.overall);
      setMastered(res.mastered);
      if (res.result.timedOut) {
        setCompanion("warning");
        setTutor({ text: "Cut off. Infinite loops don't become insights if we wait politely.", companion: "warning", escalate: false });
      } else if (res.result.compileErrors.length) {
        setCompanion("investigating");
        setTutor({
          text: res.result.compileErrors[0].msg,
          companion: "investigating",
          escalate: false,
        });
      } else if (res.result.exception) {
        setCompanion("investigating");
        setTutor({
          text: `${res.result.exception.type}: ${res.result.exception.msg}`,
          companion: "investigating",
          escalate: false,
        });
      } else if (res.result.denied) {
        setCompanion("warning");
        setTutor({ text: res.result.denied, companion: "warning", escalate: false });
      } else {
        setCompanion("success");
      }
      const s = await api.skills();
      setSkills(s.skills);
    } catch (e) {
      setCompanion("warning");
      setTutor({ text: e instanceof Error ? e.message : "Run failed.", companion: "warning", escalate: false });
    } finally {
      setRunning(false);
    }
  }

  async function stop() {
    await api.stop().catch(() => undefined);
    setRunning(false);
    setCompanion("idle");
  }

  function resetCode() {
    if (!block) return;
    if (block.kind === "run") setCode(block.code);
    if (block.kind === "debug") setCode(block.brokenCode);
    setResult(null);
    setSnapIndex(0);
  }

  async function hint() {
    const topic = block?.kind === "debug" ? "debug" : block?.kind === "explain" ? "explain" : "predict";
    const res = await api.hint(LESSON_ID, { topic, level: hintLevel });
    setTutor(res.tutor);
    setCompanion(res.tutor.companion);
    if (res.tutor.escalate) setHintLevel((h) => h + 1);
  }

  async function submitExplain() {
    if (!block || block.kind !== "explain" || busy) return;
    setBusy(true);
    try {
      const res = await api.explain(LESSON_ID, { blockId: block.id, text: explainText });
      setExplainScore(res.score);
      setTutor(res.tutor);
      setCompanion(res.score >= 0.7 ? "success" : "teaching");
      setEvidence(res.evidence);
      setOverall(res.overall);
      setMastered(res.mastered);
    } finally {
      setBusy(false);
    }
  }

  async function submitMastery() {
    if (!block || block.kind !== "mastery" || busy) return;
    setBusy(true);
    try {
      const res = await api.mastery(LESSON_ID, { blockId: block.id, answers: masteryAnswers });
      setMasteryResult(res.results);
      setEvidence(res.evidence);
      setOverall(res.overall);
      setMastered(res.mastered);
      setCompanion(res.mastered ? "celebrating" : res.correctCount === res.total ? "success" : "curious");
      setTutor({
        text: res.mastered
          ? "That's mastery: prediction, mutation, identity, and pass-by-value — not a Complete button."
          : "Completion isn't mastery. Misses here mean the model still slips. Go back to the picture.",
        companion: res.mastered ? "celebrating" : "curious",
        escalate: !res.mastered,
      });
    } finally {
      setBusy(false);
    }
  }

  const debugPass = useMemo(() => {
    if (block?.kind !== "debug" || !result) return false;
    if (block.passWhen.stdoutIncludes && !result.stdout.includes(block.passWhen.stdoutIncludes)) return false;
    if (block.passWhen.mustNotContain?.some((s) => code.includes(s))) return false;
    return result.compileErrors.length === 0 && !result.timedOut;
  }, [block, result, code]);

  if (loadErr) {
    return (
      <div className="crash">
        <p className="kicker">CodeBroo</p>
        <h1>Lesson failed to load.</h1>
        <p>{loadErr}</p>
        <button onClick={() => void load()}>Retry</button>
      </div>
    );
  }
  if (showBuddyPicker) return <BuddyPicker value={buddyId} onChoose={(id) => void chooseBuddy(id)} />;

  if (!lesson || !block) {
    return (
      <div className="crash">
        <p className="kicker">CodeBroo</p>
        <h1>Opening the lab…</h1>
      </div>
    );
  }

  const showEditor = block.kind === "run" || block.kind === "debug" || block.kind === "compare";
  const editorLocked = block.kind === "run" && !unlockedRun;

  return (
    <div className="shell">
      <aside className="rail">
        <div>
          <div className="mark">
            Code<span>Broo</span>
          </div>
          <div className="tagline">Don't memorize. Get it.</div>
        </div>
        <div>
          <p className="kicker" style={{ color: "#e07a48" }}>
            Java · References
          </p>
          <ol className="steps">
            {lesson.blocks.map((b, i) => (
              <li key={b.id}>
                <button className={i === index ? "on" : ""} disabled={!canEnter(i)} onClick={() => void go(i)}>
                  {i + 1}. {titleOf(b)}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="meters">
          {skills.map((s) => (
            <div className="meter" key={s.id}>
              <label>
                <span>{s.label}</span>
                <span>{Math.round(s.value * 100)}</span>
              </label>
              <div className="bar">
                <i style={{ width: `${Math.round(s.value * 100)}%` }} />
              </div>
            </div>
          ))}
          <p className="tagline">Overall {Math.round(overall * 100)} · {mastered ? "mastered" : "not mastered"}</p>
        </div>
      </aside>

      <main className="stage">
        <header className="stage-head">
          <div className="lesson-meta">
            <div>
              <p className="kicker">{block.kind}</p>
              <span className="path-label">Java path · {index + 1} of {lesson.blocks.length}</span>
            </div>
            <div className="journey-progress" aria-label={`Lesson progress ${journeyPercent}%`}>
              <span>{journeyPercent}% through this lesson</span>
              <div className="journey-track"><i style={{ width: `${journeyPercent}%` }} /></div>
            </div>
          </div>
          <h1>{headingOf(block)}</h1>
          <p className="lede">{ledeOf(block)}</p>
        </header>
        <div className="viz-wrap">
          <div className="viz-label">Live JVM state</div>
          <HeapViz snap={snap} prev={prev} />
        </div>
        <div className="work">
          <section className="col">
            <h2>Lesson</h2>
            <div className="lesson-body">{renderBlock(block)}</div>
          </section>
          <section className="col">
            <h2>Java · real javac / JVM</h2>
            <div className="toolbar">
              <button className="teal" onClick={() => void run()} disabled={running || editorLocked || !showEditor}>
                {running ? "Running" : "Run"}
              </button>
              <button className="danger" onClick={() => void stop()} disabled={!running}>
                Stop
              </button>
              <button className="ghost" onClick={resetCode} disabled={!showEditor}>
                Reset
              </button>
              {snapshots.length > 1 && (
                <>
                  <button className="ghost" onClick={() => setSnapIndex((i) => Math.max(0, i - 1))}>
                    Step −
                  </button>
                  <button className="ghost" onClick={() => setSnapIndex((i) => Math.min(snapshots.length - 1, i + 1))}>
                    Step +
                  </button>
                </>
              )}
              <span className="status">
                {editorLocked ? "locked until you predict" : running ? "jvm" : result?.timedOut ? "timeout" : "ready"}
                {snapshots.length ? ` · ${snapIndex + 1}/${snapshots.length}` : ""}
              </span>
            </div>
            {showEditor ? (
              <Suspense fallback={<div className="viz-empty">Editor…</div>}>
                <JavaEditor value={code} onChange={setCode} readOnly={editorLocked || running} />
              </Suspense>
            ) : (
              <div className="viz-empty">Editor unlocks on the experiment steps. Keep reading — then break it.</div>
            )}
            <div className="output" aria-live="polite">
              {renderOutput(result)}
            </div>
          </section>
        </div>
      </main>

      <aside className="tutor">
        <div className="broo-dock">
          <div className="buddy-identity">
            {!hideBroo && <Broo buddyId={buddyId} state={companion} minimized={false} onToggle={() => setHideBroo(true)} />}
            {hideBroo && <Broo buddyId={buddyId} state={companion} minimized onToggle={() => setHideBroo(false)} />}
            <div>
              <span className="buddy-eyebrow">Your study buddy</span>
              <strong>{buddy.name}</strong>
              <span>{buddy.vibe}</span>
            </div>
          </div>
          <div className="tutor-heading">
            <h2>Tutor</h2>
            <button className="text-button" type="button" onClick={() => setShowBuddyPicker(true)}>Change buddy</button>
          </div>
        </div>
        <div className="tutor-log">
          <div className="tutor-bubble">
            <span className="bubble-kicker">{buddy.name} says</span>
            <p>{tutor.text}</p>
          </div>
          <div className="tutor-signal">
            <span className={mastered ? "signal-dot mastered" : "signal-dot"} />
            <span>{mastered ? "Lesson mastered" : `Mastery ${Math.round(overall * 100)}%`}</span>
          </div>
        </div>
        <div className="hint-row">
          <button className="ghost" onClick={() => void hint()}>
            Hint
          </button>
          <button className="ghost" disabled={index >= lesson.blocks.length - 1 || !canEnter(index + 1)} onClick={() => void go(index + 1)}>
            Continue
          </button>
        </div>
      </aside>
    </div>
  );

  function renderBlock(block: LessonBlock) {
    if (block.kind === "hook") {
      return (
        <div className="prose">
          {block.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <button onClick={() => void go(index + 1)}>Predict before you run</button>
        </div>
      );
    }
    if (block.kind === "predict" || block.kind === "transfer") {
      return (
        <div>
          <pre className="code-sample">{block.code}</pre>
          <p className="lede">{block.prompt}</p>
          <div className="choices">
            {block.choices.map((c) => (
              <button
                key={c.id}
                className={
                  "choice" +
                  (predictResult && c.id === choice && predictResult.correct ? " good" : "") +
                  (predictResult && c.id === choice && !predictResult.correct ? " bad" : "")
                }
                onClick={() => setChoice(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button onClick={() => void submitPredict()} disabled={!choice || busy}>
            Lock in prediction
          </button>
          {predictResult && (
            <div className={"banner " + (predictResult.correct ? "good" : "warn")}>
              {predictResult.correct ? "Held. Now go look at the heap." : "Not that. Hint before you memorize an option."}
            </div>
          )}
          {predictResult?.reveal?.map((r) => (
            <p key={r} className="lede">
              {r}
            </p>
          ))}
          {predictResult?.correct && (
            <button style={{ marginTop: 8 }} onClick={() => void go(index + 1)}>
              Continue
            </button>
          )}
        </div>
      );
    }
    if (block.kind === "layers") {
      return (
        <div className="layers">
          {block.layers.map((layer, i) => (
            <details key={layer.title} className="layer" open={i === 0}>
              <summary>{layer.title}</summary>
              {layer.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </details>
          ))}
          <button style={{ marginTop: 10 }} onClick={() => void go(index + 1)}>
            Run the first program
          </button>
        </div>
      );
    }
    if (block.kind === "run") {
      return (
        <div className="prose">
          <p>{block.brief}</p>
          <p>{block.goal}</p>
          {debugPass && <div className="banner good">Heap agrees with the story.</div>}
        </div>
      );
    }
    if (block.kind === "compare") {
      return (
        <div>
          <p className="lede">{block.ask}</p>
          <div className="compare">
            <div>
              <p className="kicker">{block.leftTitle}</p>
              <pre className="code-sample">{block.leftCode}</pre>
            </div>
            <div>
              <p className="kicker">{block.rightTitle}</p>
              <pre className="code-sample">{block.rightCode}</pre>
            </div>
          </div>
          <p className="lede">Paste either snippet into Main and run. Count the heap boxes.</p>
        </div>
      );
    }
    if (block.kind === "debug") {
      return (
        <div className="prose">
          <p>{block.story}</p>
          <p>
            Expected: <strong>{block.expected}</strong>
          </p>
          {result && (
            <p>
              Actual stdout: <code>{result.stdout.trim() || "(empty)"}</code>
            </p>
          )}
          {debugPass && <div className="banner good">Warehouse intact. That's a real fix, not a vibe.</div>}
        </div>
      );
    }
    if (block.kind === "explain") {
      return (
        <div>
          <p className="lede">{block.prompt}</p>
          <textarea className="explain-box" value={explainText} onChange={(e) => setExplainText(e.target.value)} />
          <div style={{ marginTop: 8 }}>
            <button onClick={() => void submitExplain()} disabled={busy || explainText.trim().length < 20}>
              Check explanation
            </button>
          </div>
          {explainScore != null && (
            <div className={"banner " + (explainScore >= 0.7 ? "good" : "warn")}>
              Score {Math.round(explainScore * 100)} — missing the required ideas keeps you un-mastered.
            </div>
          )}
        </div>
      );
    }
    if (block.kind === "mastery") {
      return (
        <div>
          {block.checks.map((ch) => (
            <div key={ch.id} style={{ marginBottom: 12 }}>
              <p className="lede">{ch.prompt}</p>
              <div className="choices">
                {ch.choices.map((c) => (
                  <button
                    key={c.id}
                    className={
                      "choice" +
                      (masteryResult?.find((r) => r.id === ch.id) && masteryAnswers[ch.id] === c.id
                        ? masteryResult.find((r) => r.id === ch.id)?.correct
                          ? " good"
                          : " bad"
                        : "")
                    }
                    onClick={() => setMasteryAnswers((m) => ({ ...m, [ch.id]: c.id }))}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => void submitMastery()} disabled={busy}>
            Submit evidence
          </button>
          {masteryResult && (
            <div className={"banner " + (mastered ? "good" : "warn")}>
              {mastered ? "Mastered this lesson." : "Not mastered yet. Evidence is below the bar."}
            </div>
          )}
        </div>
      );
    }
    return null;
  }
}

function titleOf(b: LessonBlock) {
  return b.title.replace(/^The /, "").slice(0, 28);
}
function headingOf(b: LessonBlock) {
  return b.title;
}
function ledeOf(b: LessonBlock) {
  if (b.kind === "hook") return b.body[0];
  if (b.kind === "predict" || b.kind === "transfer") return "No running until you commit.";
  if (b.kind === "run") return b.brief;
  if (b.kind === "debug") return "Expected vs actual. Then a hypothesis — not random edits.";
  if (b.kind === "explain") return "If you can't say it, you don't have it yet.";
  if (b.kind === "mastery") return "A Complete click would be a lie. These checks are the gate.";
  if (b.kind === "compare") return b.ask;
  if (b.kind === "layers") return "Open only as far as you need. Depth is here when you want it.";
  return "";
}

function renderOutput(result: ExecutionResult | null) {
  if (!result) return <span className="ok">Output appears here. Compiler and runtime errors too.</span>;
  const chunks: string[] = [];
  if (result.denied) chunks.push("DENIED\n" + result.denied);
  if (result.compileErrors.length) {
    chunks.push(result.compileErrors.map((e) => `compile:${e.line ?? "?"}:${e.col ?? "?"} ${e.msg}`).join("\n"));
  }
  if (result.exception) chunks.push(`${result.exception.type}: ${result.exception.msg}\n${result.exception.stack}`);
  if (result.timedOut) chunks.push("TIMEOUT — process killed.");
  if (result.stdout) chunks.push(result.stdout);
  if (result.stderr) chunks.push(result.stderr);
  const text = chunks.join("\n") || "(no output)";
  const bad = Boolean(result.denied || result.compileErrors.length || result.exception || result.timedOut);
  return <span className={bad ? "err" : "ok"}>{text}</span>;
}
