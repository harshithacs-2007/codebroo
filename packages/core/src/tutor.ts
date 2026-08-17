import type { CompanionState, MistakeType } from "./types.ts";

export type TutorTurn = {
  text: string;
  companion: CompanionState;
  escalate: boolean;
};

const LADDERS: Record<string, string[]> = {
  predict: [
    "Hold up. How many times did we actually create an array?",
    "`int[] b = a` does not say `new`. So what, exactly, got copied into `b`?",
    "Java copied the reference value sitting in `a` — a pointer to one array object. Two remotes. One TV.",
    "After `b[0] = 99`, there is still one array. Both `a` and `b` point at it. `a[0]` is 99.",
    "Write `int[] c = new int[]{10,20,30}` next. Now you have two TVs. Mutating one remote's TV should leave the other alone.",
  ],
  alias: [
    "If `b` were a second array, `new` would have shown up on that line. Did it?",
    "Assignment copies the value in the variable. For a reference type, that value is the address, not the object.",
    "People say 'Java passes objects by reference.' That's the trap. Java passes the reference by value.",
  ],
  debug: [
    "Expected vs actual. What did you think this program owned — one array or two?",
    "Find the line that shares an object. Then find the line that mutates it.",
    "The bug is aliasing, not arithmetic. Split the objects with `new`, or stop mutating through the second name.",
  ],
  explain: [
    "I'm not grading poetry. Did you mention that the reference was copied, not the array?",
    "If your explanation still says 'b is a copy of the array', that's the misconception wearing a disguise.",
    "A clean version: variables hold values. For arrays, the value is a reference. Assignment copies that reference. Mutation goes through it to the same object.",
  ],
  equals: [
    "`==` on references asks: same object? `equals` asks: same meaning, if the class defined one.",
    "Two arrays with the same contents are still two objects. `==` is false. `Arrays.equals` is the content check.",
  ],
};

export function tutorFor(opts: {
  topic: keyof typeof LADDERS;
  level: number;
  mistake?: MistakeType;
  extra?: string;
}): TutorTurn {
  const lines = LADDERS[opts.topic] ?? LADDERS.alias;
  const idx = Math.max(0, Math.min(lines.length - 1, opts.level));
  const escalate = idx < lines.length - 1;
  let companion: CompanionState = idx === 0 ? "curious" : idx < 3 ? "teaching" : "investigating";
  if (opts.mistake === "alias-as-copy") companion = idx === 0 ? "confused" : "teaching";
  if (opts.mistake === "pass-by-reference-myth") companion = "warning";
  const extra = opts.extra ? `\n\n${opts.extra}` : "";
  return { text: lines[idx] + extra, companion, escalate };
}

export function reactToPrediction(correct: boolean, choiceLabel: string): TutorTurn {
  if (correct) {
    return {
      text: `Yes. ${choiceLabel} — because there was only ever one array. Two names. Same object.`,
      companion: "success",
      escalate: false,
    };
  }
  return {
    text: `"${choiceLabel}" is what it looks like if you think assignment clones the array. How many \`new\` arrays did that snippet actually create?`,
    companion: "confused",
    escalate: true,
  };
}

export function reactToRun(opts: { compiling: boolean; running: boolean; error?: string; timedOut?: boolean }): TutorTurn {
  if (opts.compiling) return { text: "Compiler's turn. Let's see if the types even exist yet.", companion: "watching", escalate: false };
  if (opts.running) return { text: "I'm watching the heap, not the theater. Keep your eyes on the arrows.", companion: "watching", escalate: false };
  if (opts.timedOut) {
    return {
      text: "That's enough. Infinite loops don't become insights if we wait politely. Check the loop condition — or stop allocating forever.",
      companion: "warning",
      escalate: false,
    };
  }
  if (opts.error) {
    return {
      text: `The JVM objected: ${opts.error.slice(0, 180)} Read it. The first line that mentions your class is the one that matters.`,
      companion: "investigating",
      escalate: false,
    };
  }
  return { text: "Output is evidence. The picture is the explanation.", companion: "idle", escalate: false };
}

export function scanDangerousExplanation(text: string): string | null {
  const n = text.toLowerCase();
  if (n.includes("pass") && n.includes("by reference") && !n.includes("by value")) {
    return "Careful: Java does not pass objects by reference. It passes reference values by value.";
  }
  if (n.includes("b is a copy of the array") || n.includes("b is another array")) {
    return "That's the two-TV story. The code only bought one TV.";
  }
  return null;
}
