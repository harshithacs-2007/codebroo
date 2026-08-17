import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const classes = join(root, "apps", "executor", "classes");
const dir = mkdtempSync(join(tmpdir(), "broo-exec-"));
writeFileSync(
  join(dir, "Main.java"),
  `public class Main {
  public static void main(String[] args) {
    int[] a = {10, 20, 30};
    int[] b = a;
    b[0] = 99;
    System.out.println(a[0]);
  }
}
`,
  "utf8",
);

const r = spawnSync(
  "java",
  ["--add-modules", "jdk.jdi", "-cp", classes, "BrooExecutor", dir, "Main", "run", "8000", "400", "65536"],
  { encoding: "utf8", timeout: 20000 },
);

rmSync(dir, { recursive: true, force: true });
const out = `${r.stdout || ""}\n${r.stderr || ""}`;
if (!out.includes('"t":"done"') && !out.includes('"t":"snapshot"') && !out.includes("99")) {
  process.stderr.write(out);
  process.stderr.write("executor smoke test failed\n");
  process.exit(1);
}
if (out.includes('"t":"denied"') && !out.includes("snapshot")) {
  process.stderr.write(out);
  process.exit(1);
}
process.stdout.write("executor smoke ok\n");
