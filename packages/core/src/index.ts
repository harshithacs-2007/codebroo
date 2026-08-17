export * from "./types.ts";
export * from "./mastery.ts";
export * from "./tutor.ts";
export * from "./sandbox-policy.ts";
export { TWO_REMOTE_CONTROLS } from "./lessons/two-remote-controls.ts";

import { TWO_REMOTE_CONTROLS } from "./lessons/two-remote-controls.ts";
import type { Lesson } from "./types.ts";

const LESSONS: Record<string, Lesson> = {
  [TWO_REMOTE_CONTROLS.id]: TWO_REMOTE_CONTROLS,
};

export function getLesson(id: string): Lesson | undefined {
  return LESSONS[id];
}

export function listLessons(): Lesson[] {
  return Object.values(LESSONS);
}
