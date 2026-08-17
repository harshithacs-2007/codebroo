import { useEffect, useState } from "react";
import { Workspace } from "./Workspace";
import { api } from "./api";

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let n = 0;
    let stop = false;
    const tick = () => {
      api
        .health()
        .then(() => {
          if (!stop) setReady(true);
        })
        .catch((e: Error) => {
          n += 1;
          if (n > 20) setError(e.message || "API unreachable");
          else setTimeout(tick, 250);
        });
    };
    tick();
    return () => {
      stop = true;
    };
  }, []);

  if (error) {
    return (
      <div className="crash">
        <p className="kicker">CodeBroo</p>
        <h1>The tutor is up. The JVM runner isn’t answering.</h1>
        <p>Start the API on port 8787, then refresh. Your lesson data lives there, not in this tab.</p>
        <pre>{error}</pre>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="crash">
        <p className="kicker">CodeBroo</p>
        <h1>Warming the lab…</h1>
      </div>
    );
  }
  return <Workspace />;
}
