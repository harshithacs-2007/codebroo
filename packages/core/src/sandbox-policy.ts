const FORBIDDEN = [
  { re: /\bRuntime\b/, reason: "Runtime is blocked in the playground." },
  { re: /\bProcessBuilder\b/, reason: "Process spawning is blocked." },
  { re: /\bProcessHandle\b/, reason: "Process handles are blocked." },
  { re: /\bSystem\.exit\b/, reason: "Don't shut down the JVM. Return from main." },
  { re: /\bjava\.net\./, reason: "Network APIs are blocked." },
  { re: /\bSocket\b/, reason: "Sockets are blocked." },
  { re: /\bURLClassLoader\b/, reason: "Custom class loaders are blocked." },
  { re: /\bUnsafe\b/, reason: "Unsafe is blocked." },
  { re: /\bJNI\b/, reason: "Native interfaces are blocked." },
  { re: /\bProcess\b/, reason: "Process APIs are blocked." },
  { re: /\bFiles\.(delete|write|copy|move|create)/, reason: "Filesystem mutation is blocked." },
  { re: /\bFile(Output|Writer|Input)/, reason: "Raw file I/O is blocked in this lesson." },
  { re: /\/proc\b|C:\\Windows/i, reason: "Path looks like host probing." },
];

export function inspectSource(source: string, maxBytes: number): string | null {
  if (source.length > maxBytes) return `Source exceeds ${maxBytes} bytes.`;
  if (source.includes("\0")) return "Source contains a null byte.";
  for (const rule of FORBIDDEN) {
    if (rule.re.test(source)) return rule.reason;
  }
  return null;
}

export function extractPublicClass(source: string): string | null {
  const m = source.match(/public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return m?.[1] ?? null;
}
