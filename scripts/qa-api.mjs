/**
 * Hits the real API + JDK. Requires the server to be running.
 */
const base = process.env.CODEBROO_PUBLIC_ORIGIN || "http://127.0.0.1:8787";

async function main() {
  const health = await (await fetch(base + "/api/health")).json();
  if (!health.ok) throw new Error("health failed");

  const meRes = await fetch(base + "/api/me");
  const setCookie = meRes.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  const headers = { "content-type": "application/json", cookie };

  const lessonId = "java-references-two-remotes";
  const lesson = await (await fetch(base + "/api/lessons/" + lessonId, { headers })).json();
  if (!lesson.lesson) throw new Error("lesson missing");

  const wrong = await (
    await fetch(base + `/api/lessons/${lessonId}/predict`, {
      method: "POST",
      headers,
      body: JSON.stringify({ blockId: "predict-alias", choiceId: "10", firstTry: true, latencyMs: 800 }),
    })
  ).json();
  if (wrong.correct) throw new Error("10 should be wrong");

  const right = await (
    await fetch(base + `/api/lessons/${lessonId}/predict`, {
      method: "POST",
      headers,
      body: JSON.stringify({ blockId: "predict-alias", choiceId: "99", firstTry: false, latencyMs: 400 }),
    })
  ).json();
  if (!right.correct) throw new Error("99 should be right");

  const source = `public class Main {
    public static void main(String[] args) {
        int[] a = {10, 20, 30};
        int[] b = a;
        b[0] = 99;
        System.out.println(a[0]);
    }
}`;
  const run = await (
    await fetch(base + "/api/run", {
      method: "POST",
      headers,
      body: JSON.stringify({ source, lessonId, blockId: "run-alias" }),
    })
  ).json();
  const result = run.result;
  if (result.compileErrors?.length) throw new Error("compile: " + JSON.stringify(result.compileErrors));
  if (result.denied) throw new Error("denied: " + result.denied);
  if (!String(result.stdout).includes("99") && !result.snapshots?.length) {
    throw new Error("expected 99 or snapshots, got " + JSON.stringify(result).slice(0, 500));
  }

  const boom = await (
    await fetch(base + "/api/run", {
      method: "POST",
      headers,
      body: JSON.stringify({ source: "public class Main {", lessonId, blockId: "run-alias" }),
    })
  ).json();
  if (!boom.result.compileErrors?.length) throw new Error("expected compile errors");

  const loop = await (
    await fetch(base + "/api/run", {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "public class Main { public static void main(String[] a){ while(true){} } }",
        lessonId,
        blockId: "run-alias",
      }),
    })
  ).json();
  if (!loop.result.timedOut && loop.result.ok) throw new Error("infinite loop should time out");

  console.log("qa ok", {
    snapshots: result.snapshots?.length ?? 0,
    stdout: result.stdout,
    timedOutLoop: loop.result.timedOut,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
