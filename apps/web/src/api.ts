import type { ExecutionResult, Lesson, MasteryEvidence, TutorTurn } from "@codebroo/core";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), path.includes("/api/run") ? 25000 : 20000);
  try {
    const res = await fetch(path, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || "request failed");
    return data as T;
  } finally {
    clearTimeout(t);
  }
}

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),
  me: () =>
    req<{
      learner: { id: string; name: string; buddyId: "mochi" | "bibi" | "momo" | "koko" | "pip"; onboarded: boolean };
      buddies: Array<"mochi" | "bibi" | "momo" | "koko" | "pip">;
    }>("/api/me"),
  updateProfile: (body: { name?: string; buddyId?: "mochi" | "bibi" | "momo" | "koko" | "pip" }) =>
    req<{ ok: boolean }>("/api/me", { method: "POST", body: JSON.stringify(body) }),
  lesson: (id: string) =>
    req<{
      lesson: Lesson;
      progress: { block_index: number; unlocked_run: number };
      evidence: MasteryEvidence;
      overall: number;
      mastered: boolean;
      mistakes: Array<{ type: string; recovered: number; frequency: number }>;
    }>(`/api/lessons/${id}`),
  progress: (id: string, blockIndex: number, unlockedRun: boolean) =>
    req("/api/lessons/" + id + "/progress", {
      method: "POST",
      body: JSON.stringify({ blockIndex, unlockedRun }),
    }),
  predict: (id: string, body: object) =>
    req<{
      correct: boolean;
      tutor: TutorTurn;
      evidence: MasteryEvidence;
      overall: number;
      mastered: boolean;
      reveal: string[];
    }>(`/api/lessons/${id}/predict`, { method: "POST", body: JSON.stringify(body) }),
  explain: (id: string, body: object) =>
    req<{
      score: number;
      missing: string[];
      hitTrap: string | null;
      tutor: TutorTurn;
      evidence: MasteryEvidence;
      mastered: boolean;
      overall: number;
    }>(`/api/lessons/${id}/explain`, { method: "POST", body: JSON.stringify(body) }),
  mastery: (id: string, body: object) =>
    req<{
      results: Array<{ id: string; correct: boolean }>;
      correctCount: number;
      total: number;
      evidence: MasteryEvidence;
      overall: number;
      mastered: boolean;
    }>(`/api/lessons/${id}/mastery`, { method: "POST", body: JSON.stringify(body) }),
  hint: (id: string, body: object) => req<{ tutor: TutorTurn }>(`/api/lessons/${id}/hint`, { method: "POST", body: JSON.stringify(body) }),
  run: (body: object) =>
    req<{ result: ExecutionResult; evidence: MasteryEvidence; overall: number; mastered: boolean }>("/api/run", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  stop: () => req<{ stopped: boolean }>("/api/stop", { method: "POST", body: "{}" }),
  skills: () =>
    req<{
      skills: Array<{ id: string; label: string; value: number }>;
      overall: number;
      mastered: boolean;
      mistakes: Array<{ type: string; recovered: number; frequency: number }>;
    }>("/api/skills"),
};
