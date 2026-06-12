// The tutor: streamed coaching text + a question box. Speaks on request /
// between sections, not over every note (spec §8).

import { useState } from "react";

export function TutorPanel({
  text,
  busy,
  tokens,
  onCoach,
  onAsk,
}: {
  text: string;
  busy: boolean;
  tokens: number;
  onCoach: () => void;
  onAsk: (q: string) => void;
}) {
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    if (t && !busy) {
      onAsk(t);
      setQ("");
    }
  };

  return (
    <div className="tutor">
      <div className="tutor-text">
        {text || <span className="muted">Hit “Coach me” for feedback on your last run.</span>}
        {busy && <span className="caret">▌</span>}
      </div>
      <div className="tutor-actions">
        <button onClick={onCoach} disabled={busy}>
          {busy ? "…" : "Coach me"}
        </button>
        {tokens > 0 && <span className="muted tok">{tokens} tokens</span>}
      </div>
      <form className="tutor-ask" onSubmit={submit}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask the tutor… (why is F so hard?)"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !q.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
