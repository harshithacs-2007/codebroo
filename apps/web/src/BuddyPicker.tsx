import type { BuddyId } from "@codebroo/core";
import { BUDDIES } from "./buddies";
import { Broo } from "./Broo";

export function BuddyPicker({
  value,
  onChoose,
}: {
  value: BuddyId;
  onChoose: (id: BuddyId) => void;
}) {
  return (
    <main className="buddy-screen">
      <div className="buddy-inner">
        <p className="kicker">Your CodeBroo journey</p>
        <h1>Pick the little brain that studies with you.</h1>
        <p className="buddy-lede">
          Your buddy will react to runs, mistakes, hints and milestones. You can change them later.
        </p>

        <div className="buddy-grid" role="list">
          {BUDDIES.map((buddy) => (
            <button
              type="button"
              key={buddy.id}
              className={"buddy-card " + buddy.id + (value === buddy.id ? " selected" : "")}
              aria-pressed={value === buddy.id}
              onClick={() => onChoose(buddy.id)}
            >
              <div className="buddy-art">
                <Broo buddyId={buddy.id} state="idle" minimized={false} showToggle={false} onToggle={() => undefined} />
              </div>
              <div className="buddy-copy">
                <strong>{buddy.name}</strong>
                <span>{buddy.species} · {buddy.vibe}</span>
                <em>“{buddy.line}”</em>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
