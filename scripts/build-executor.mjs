import { mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "apps", "executor", "BrooExecutor.java");
const out = join(root, "apps", "executor", "classes");
mkdirSync(out, { recursive: true });

const r = spawnSync(
  "javac",
  ["--add-modules", "jdk.jdi", "-d", out, src],
  { encoding: "utf8" },
);
if (r.status !== 0) {
  process.stderr.write(r.stderr || r.stdout || "javac failed\n");
  process.exit(r.status ?? 1);
}
if (!existsSync(join(out, "BrooExecutor.class"))) {
  process.stderr.write("BrooExecutor.class missing\n");
  process.exit(1);
}
process.stdout.write("executor compiled\n");
