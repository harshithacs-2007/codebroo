import type { MasteryEvidence, MistakeType } from "./types.ts";

export const EMPTY_EVIDENCE: MasteryEvidence = {
  understanding: 0,
  prediction: 0,
  codeReading: 0,
  codeWriting: 0,
  debugging: 0,
  explanation: 0,
  transfer: 0,
  retention: 0,
  speed: 0,
};

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function blend(prev: number, sample: number, weight = 0.45): number {
  return clamp01(prev * (1 - weight) + sample * weight);
}

export function applyPrediction(
  evidence: MasteryEvidence,
  correct: boolean,
  firstTry: boolean,
  latencyMs: number,
): MasteryEvidence {
  const next = { ...evidence };
  const sample = correct ? (firstTry ? 1 : 0.55) : 0.08;
  next.prediction = blend(next.prediction, sample);
  next.understanding = blend(next.understanding, sample, 0.25);
  next.codeReading = blend(next.codeReading, sample, 0.3);
  if (correct && firstTry && latencyMs < 25000) {
    next.speed = blend(next.speed, 0.8, 0.2);
  } else if (!correct) {
    next.speed = blend(next.speed, 0.35, 0.15);
  }
  return next;
}

export function applyRun(evidence: MasteryEvidence, compiled: boolean, ran: boolean): MasteryEvidence {
  const next = { ...evidence };
  next.codeWriting = blend(next.codeWriting, compiled && ran ? 0.7 : compiled ? 0.4 : 0.15);
  return next;
}

export function applyDebug(evidence: MasteryEvidence, passed: boolean, hintsUsed: number): MasteryEvidence {
  const next = { ...evidence };
  const sample = passed ? clamp01(1 - hintsUsed * 0.12) : 0.12;
  next.debugging = blend(next.debugging, sample, 0.5);
  next.codeWriting = blend(next.codeWriting, passed ? 0.65 : 0.25, 0.25);
  return next;
}

export function scoreExplanation(text: string, mustInclude: string[], traps: string[]): {
  score: number;
  missing: string[];
  hitTrap: string | null;
} {
  const normalized = text.toLowerCase();
  const missing = mustInclude.filter((term) => !normalized.includes(term.toLowerCase()));
  const hitTrap = traps.find((trap) => normalized.includes(trap.toLowerCase())) ?? null;
  const covered = (mustInclude.length - missing.length) / Math.max(1, mustInclude.length);
  const score = clamp01(covered * (hitTrap ? 0.35 : 1));
  return { score, missing, hitTrap };
}

export function applyExplanation(evidence: MasteryEvidence, score: number): MasteryEvidence {
  const next = { ...evidence };
  next.explanation = blend(next.explanation, score, 0.55);
  next.understanding = blend(next.understanding, score, 0.3);
  return next;
}

export function applyTransfer(evidence: MasteryEvidence, correct: boolean, firstTry: boolean): MasteryEvidence {
  const next = { ...evidence };
  const sample = correct ? (firstTry ? 1 : 0.5) : 0.1;
  next.transfer = blend(next.transfer, sample, 0.55);
  next.retention = blend(next.retention, sample, 0.35);
  return next;
}

export function applyMasteryCheck(evidence: MasteryEvidence, correctCount: number, total: number): MasteryEvidence {
  const next = { ...evidence };
  const sample = total === 0 ? 0 : correctCount / total;
  next.understanding = blend(next.understanding, sample, 0.4);
  next.retention = blend(next.retention, sample, 0.4);
  return next;
}

export function overallMastery(evidence: MasteryEvidence): number {
  const weights: Array<[keyof MasteryEvidence, number]> = [
    ["understanding", 1.1],
    ["prediction", 1.2],
    ["codeReading", 1],
    ["codeWriting", 0.9],
    ["debugging", 1.1],
    ["explanation", 1.2],
    ["transfer", 1.3],
    ["retention", 0.8],
    ["speed", 0.3],
  ];
  let sum = 0;
  let w = 0;
  for (const [k, weight] of weights) {
    sum += evidence[k] * weight;
    w += weight;
  }
  return clamp01(sum / w);
}

/** Completion of the last screen is not enough. */
export function isMastered(evidence: MasteryEvidence, mistakes: { type: MistakeType; recovered: boolean }[]): boolean {
  const unresolved = mistakes.filter((m) => !m.recovered && (m.type === "alias-as-copy" || m.type === "pass-by-reference-myth"));
  if (unresolved.length > 0) return false;
  if (evidence.prediction < 0.72) return false;
  if (evidence.explanation < 0.55) return false;
  if (evidence.transfer < 0.7) return false;
  if (evidence.debugging < 0.45) return false;
  return overallMastery(evidence) >= 0.68;
}

export function severityFor(type: MistakeType): number {
  switch (type) {
    case "alias-as-copy":
    case "pass-by-reference-myth":
      return 0.9;
    case "equals-vs-identity":
    case "new-vs-alias":
    case "mutation-surprise":
      return 0.75;
    case "null-confusion":
    case "logic":
      return 0.6;
    default:
      return 0.4;
  }
}
