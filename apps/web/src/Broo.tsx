import type { CompanionState } from "@codebroo/core";

export function Broo({ state, minimized, onToggle }: { state: CompanionState; minimized: boolean; onToggle: () => void }) {
  const mood = moodFor(state);
  return (
    <div className={"broo " + state + (minimized ? " minimized" : "")} title={mood.title}>
      <svg className="broo-svg" viewBox="0 0 88 88" aria-hidden="true">
        <g className="body">
          <ellipse cx="44" cy="50" rx="28" ry="24" fill="#1c1814" />
          <ellipse cx="44" cy="54" rx="18" ry="14" fill="#efe7d8" opacity="0.14" />
          <path d="M28 28 C30 16, 38 18, 40 26" fill="none" stroke="#c44b1b" strokeWidth="2.4" />
          <path d="M60 28 C58 16, 50 18, 48 26" fill="none" stroke="#c44b1b" strokeWidth="2.4" />
          <circle cx="34" cy="46" r={mood.eye} fill="#efe7d8" />
          <circle cx="54" cy="46" r={mood.eye} fill="#efe7d8" />
          <circle className="pupil" cx="34.5" cy="46.5" r="2.2" fill="#c44b1b" />
          <circle className="pupil" cx="54.5" cy="46.5" r="2.2" fill="#c44b1b" />
          <path d={mood.mouth} fill="none" stroke="#efe7d8" strokeWidth="1.8" strokeLinecap="round" />
          <text x="44" y="78" textAnchor="middle" fill="#efe7d8" fontSize="8" fontFamily="IBM Plex Sans, sans-serif" opacity="0.7">
            {minimized ? "" : mood.tag}
          </text>
        </g>
      </svg>
      <button className="ghost" style={{ marginTop: 4, padding: "0.15rem 0.5rem", fontSize: 11 }} onClick={onToggle}>
        {minimized ? "Broo" : "Hide"}
      </button>
    </div>
  );
}

function moodFor(state: CompanionState) {
  switch (state) {
    case "confused":
      return { eye: 7.5, mouth: "M36 62 Q44 58 52 62", tag: "wait—", title: "Confused" };
    case "curious":
      return { eye: 8.2, mouth: "M38 61 Q44 64 50 61", tag: "hm", title: "Curious" };
    case "watching":
    case "investigating":
      return { eye: 6.2, mouth: "M40 62 L48 62", tag: "watching", title: "Watching code" };
    case "warning":
      return { eye: 5.5, mouth: "M36 64 Q44 60 52 64", tag: "nope", title: "Warning" };
    case "success":
      return { eye: 5, mouth: "M36 60 Q44 66 52 60", tag: "yes", title: "Success" };
    case "celebrating":
      return { eye: 4.5, mouth: "M34 59 Q44 68 54 59", tag: "got it", title: "Celebrating" };
    case "teaching":
      return { eye: 7, mouth: "M38 62 Q44 63 50 62", tag: "look", title: "Teaching" };
    case "thinking":
      return { eye: 6.5, mouth: "M40 63 Q44 61 48 63", tag: "…", title: "Thinking" };
    default:
      return { eye: 7, mouth: "M38 62 Q44 64 50 62", tag: "broo", title: "Idle" };
  }
}
