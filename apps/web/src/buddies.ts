import type { BuddyId } from "@codebroo/core";

export const BUDDIES: Array<{
  id: BuddyId;
  name: string;
  species: string;
  vibe: string;
  line: string;
}> = [
  { id: "mochi", name: "Mochi", species: "Cat", vibe: "calm + observant", line: "Let's untangle it." },
  { id: "bibi", name: "Bibi", species: "Bunny", vibe: "energetic + curious", line: "Okay, one more!" },
  { id: "momo", name: "Momo", species: "Bear", vibe: "sleepy + patient", line: "No rush. We can reason it out." },
  { id: "koko", name: "Koko", species: "Fox", vibe: "playful + tricky", line: "I think you missed something..." },
  { id: "pip", name: "Pip", species: "Panda", vibe: "gentle + analytical", line: "Show me your thinking." },
];
