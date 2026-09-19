export type BuddyId = "mochi" | "bibi" | "momo" | "koko" | "pip";

export type CompanionState =
  | "idle"
  | "thinking"
  | "teaching"
  | "watching"
  | "curious"
  | "confused"
  | "investigating"
  | "warning"
  | "success"
  | "celebrating";

export type SkillId =
  | "java-fundamentals"
  | "references"
  | "debugging"
  | "code-reading"
  | "code-writing"
  | "explanation";

export type MistakeType =
  | "alias-as-copy"
  | "pass-by-reference-myth"
  | "equals-vs-identity"
  | "null-confusion"
  | "mutation-surprise"
  | "new-vs-alias"
  | "compiler"
  | "runtime"
  | "logic"
  | "incomplete-explanation";

export type VizPrimitive = {
  k: "prim";
  v: string;
  type: string;
};

export type VizRef = {
  k: "ref";
  id: string;
  type: string;
};

export type VizNull = { k: "null" };

export type VizValue = VizPrimitive | VizRef | VizNull;

export type HeapObject = {
  id: string;
  kind: "array" | "object" | "string";
  type: string;
  label?: string;
  slots: { key: string; value: VizValue }[];
};

export type StackFrameSnap = {
  method: string;
  line?: number;
  vars: { name: string; value: VizValue }[];
};

export type Snapshot = {
  line?: number;
  frames: StackFrameSnap[];
  heap: HeapObject[];
};

export type ExecEvent =
  | { t: "compileError"; line?: number; col?: number; msg: string }
  | { t: "stdout"; d: string }
  | { t: "stderr"; d: string }
  | { t: "snapshot"; snap: Snapshot }
  | { t: "exception"; type: string; msg: string; stack: string }
  | { t: "timeout" }
  | { t: "denied"; reason: string }
  | { t: "done"; exitCode: number; timedOut: boolean; steps: number };

export type ExecutionResult = {
  ok: boolean;
  events: ExecEvent[];
  stdout: string;
  stderr: string;
  snapshots: Snapshot[];
  compileErrors: { line?: number; col?: number; msg: string }[];
  exception?: { type: string; msg: string; stack: string };
  timedOut: boolean;
  denied?: string;
  durationMs: number;
};

export type PredictChoice = {
  id: string;
  label: string;
};

export type LessonBlock =
  | {
      id: string;
      kind: "hook";
      kicker: string;
      title: string;
      body: string[];
    }
  | {
      id: string;
      kind: "predict";
      title: string;
      prompt: string;
      code: string;
      choices: PredictChoice[];
      correctId: string;
      misconception: Record<string, MistakeType>;
      reveal: string[];
    }
  | {
      id: string;
      kind: "layers";
      title: string;
      layers: { title: string; body: string[] }[];
    }
  | {
      id: string;
      kind: "run";
      title: string;
      brief: string;
      code: string;
      goal: string;
    }
  | {
      id: string;
      kind: "compare";
      title: string;
      leftTitle: string;
      leftCode: string;
      rightTitle: string;
      rightCode: string;
      ask: string;
    }
  | {
      id: string;
      kind: "debug";
      title: string;
      story: string;
      expected: string;
      brokenCode: string;
      hintLadder: string[];
      passWhen: { stdoutIncludes?: string; mustContain?: string[]; mustNotContain?: string[] };
    }
  | {
      id: string;
      kind: "explain";
      title: string;
      prompt: string;
      mustInclude: string[];
      niceInclude: string[];
      traps: string[];
    }
  | {
      id: string;
      kind: "transfer";
      title: string;
      prompt: string;
      code: string;
      choices: PredictChoice[];
      correctId: string;
      misconception: Record<string, MistakeType>;
      why: string[];
    }
  | {
      id: string;
      kind: "mastery";
      title: string;
      checks: { id: string; prompt: string; choices: PredictChoice[]; correctId: string }[];
    };

export type Lesson = {
  id: string;
  track: "java";
  title: string;
  subtitle: string;
  skills: SkillId[];
  blocks: LessonBlock[];
};

export type AttemptKind =
  | "prediction"
  | "run"
  | "debug"
  | "explain"
  | "transfer"
  | "mastery";

export type MasteryEvidence = {
  understanding: number;
  prediction: number;
  codeReading: number;
  codeWriting: number;
  debugging: number;
  explanation: number;
  transfer: number;
  retention: number;
  speed: number;
};

export type LearnerMistake = {
  concept: string;
  type: MistakeType;
  frequency: number;
  recency: number;
  severity: number;
  recovered: boolean;
};
