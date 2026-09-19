import { describe, expect, it } from "vitest";
import { inspectSource } from "./sandbox-policy";

const ok = (body: string) => `public class Main { public static void main(String[] args) { ${body} } }`;

describe("sandbox policy", () => {
  it("accepts normal lesson code", () => {
    expect(inspectSource(ok("int[] a = {1, 2, 3}; System.out.println(a[1]);"), 32768)).toBeNull();
  });

  it("blocks environment and host property probing", () => {
    expect(inspectSource(ok("System.getenv(\"HOME\");"), 32768)).toBeTruthy();
    expect(inspectSource(ok("System.getProperty(\"java.home\");"), 32768)).toBeTruthy();
  });

  it("blocks dynamic loading and reflection", () => {
    expect(inspectSource(ok("Class.forName(\"java.lang.Runtime\");"), 32768)).toBeTruthy();
    expect(inspectSource(ok("java.lang.reflect.Method m = null;"), 32768)).toBeTruthy();
  });

  it("blocks filesystem and networking APIs", () => {
    expect(inspectSource(ok("java.nio.file.Files.exists(java.nio.file.Path.of(\"/tmp\"));"), 32768)).toBeTruthy();
    expect(inspectSource(ok("java.net.URI.create(\"http://example.com\");"), 32768)).toBeTruthy();
  });

  it("rejects package declarations and unapproved imports", () => {
    expect(inspectSource("package evil;\n" + ok("int x = 1;"), 32768)).toBeTruthy();
    expect(inspectSource("import java.io.File;\n" + ok("int x = 1;"), 32768)).toBeTruthy();
  });

  it("uses byte length for UTF-8 source limits", () => {
    const source = "é".repeat(100);
    const result = inspectSource(source, 150);
    expect(result).toBeTruthy();
  });

  it("rejects empty source", () => {
    expect(inspectSource("", 32768)).toBe("Source is empty.");
  });
});
