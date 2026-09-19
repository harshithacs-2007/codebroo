import type { BuddyId, CompanionState } from "@codebroo/core";

export function Broo({
  buddyId = "mochi",
  state,
  minimized,
  onToggle,
  showToggle = true,
}: {
  buddyId?: BuddyId;
  state: CompanionState;
  minimized: boolean;
  onToggle: () => void;
  showToggle?: boolean;
}) {
  const mood = moodFor(state);
  return (
    <div className={"broo " + buddyId + " " + state + (minimized ? " minimized" : "")} title={mood.title}>
      <svg className="broo-svg" viewBox="0 0 88 88" role="img" aria-label={mood.title}>
        <g className="body">
          {earShape(buddyId)}
          <ellipse cx="44" cy="51" rx="28" ry="24" fill="#1c1814" />
          {buddyId === "pip" && (
            <>
              <ellipse cx="34" cy="45" rx="8" ry="9" fill="#0f0d0b" />
              <ellipse cx="54" cy="45" rx="8" ry="9" fill="#0f0d0b" />
            </>
          )}
          <ellipse cx="44" cy="54" rx="18" ry="14" fill="#efe7d8" opacity="0.14" />
          {buddyId === "koko" && (
            <path d="M18 59 C10 55, 10 44, 18 39 C15 48, 18 53, 24 56" fill="#c44b1b" opacity="0.9" />
          )}
          {buddyId === "bibi" && <ellipse cx="44" cy="57" rx="8" ry="5" fill="#efe7d8" opacity="0.2" />}
          {buddyId === "momo" && (
            <>
              <circle cx="27" cy="31" r="6" fill="#1c1814" />
              <circle cx="61" cy="31" r="6" fill="#1c1814" />
            </>
          )}
          <circle cx="34" cy="46" r={mood.eye} fill="#efe7d8" />
          <circle cx="54" cy="46" r={mood.eye} fill="#efe7d8" />
          <circle className="pupil" cx="34.5" cy="46.5" r="2.2" fill="#c44b1b" />
          <circle className="pupil" cx="54.5" cy="46.5" r="2.2" fill="#c44b1b" />
          <path d={mood.mouth} fill="none" stroke="#efe7d8" strokeWidth="1.8" strokeLinecap="round" />
          {!minimized && (
            <text x="44" y="78" textAnchor="middle" fill="#efe7d8" fontSize="8" fontFamily="IBM Plex Sans, sans-serif" opacity="0.7">
              {mood.tag}
            </text>
          )}
        </g>
      </svg>
      {showToggle && (
        <button className="ghost" style={{ marginTop: 4, padding: "0.15rem 0.5rem", fontSize: 11 }} onClick={onToggle}>
          {minimized ? "Broo" : "Hide"}
        </button>
      )}
    </div>
  );
}

function earShape(buddyId: BuddyId) {
  switch (buddyId) {
    case "bibi":
      return (
        <>
          <path d="M27 31 C22 16, 27 7, 35 13 C39 17, 37 28, 35 34 Z" fill="#1c1814" />
          <path d="M53 34 C51 28, 49 17, 53 13 C61 7, 66 16, 61 31 Z" fill="#1c1814" />
        </>
      );
    case "momo":
      return null;
    case "koko":
      return (
        <>
          <path d="M24 34 L29 13 L42 29 Z" fill="#1c1814" />
          <path d="M46 29 L59 13 L64 34 Z" fill="#1c1814" />
        </>
      );
    case "pip":
      return (
        <>
          <circle cx="25" cy="30" r="8" fill="#1c1814" />
          <circle cx="63" cy="30" r="8" fill="#1c1814" />
        </>
      );
    default:
      return (
        <>
          <path d="M25 34 L31 14 L42 29 Z" fill="#1c1814" />
          <path d="M46 29 L57 14 L63 34 Z" fill="#1c1814" />
        </>
      );
  }
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
