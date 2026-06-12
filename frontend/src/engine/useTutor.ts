// Owns the tutor session: creates it lazily, syncs the aggregated summary to
// the backend (batched, never per-note), and streams coaching / answers.

import { useCallback, useEffect, useRef, useState } from "react";
import { createSession, postEvents, streamCoach, streamAsk } from "../api";
import type { SessionSummary } from "./scorer";

const SYNC_MS = 5000; // batch summary posts (spec §7: aggregated, not every note)

export function useTutor(
  songId: string | null,
  mode: string,
  summary: SessionSummary | null,
  active: boolean,
) {
  const [sid, setSid] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [tokens, setTokens] = useState(0);
  const summaryRef = useRef(summary);
  summaryRef.current = summary;

  // Create a session once practice goes active.
  useEffect(() => {
    if (active && !sid) createSession(songId, mode).then(setSid).catch(() => {});
  }, [active, sid, songId, mode]);

  // Periodically push the latest summary so coaching has fresh data on demand.
  useEffect(() => {
    if (!sid) return;
    const id = setInterval(() => {
      if (summaryRef.current) postEvents(sid, summaryRef.current).catch(() => {});
    }, SYNC_MS);
    return () => clearInterval(id);
  }, [sid]);

  const run = useCallback(
    async (fn: (s: string, cb: (c: any) => void) => Promise<void>) => {
      if (!sid || busy) return;
      setBusy(true);
      setText("");
      if (summaryRef.current) await postEvents(sid, summaryRef.current).catch(() => {});
      try {
        await fn(sid, (c) => {
          if (c.delta) setText((t) => t + c.delta);
          if (typeof c.totalTokens === "number") setTokens(c.totalTokens);
        });
      } finally {
        setBusy(false);
      }
    },
    [sid, busy],
  );

  const coach = useCallback(() => run((s, cb) => streamCoach(s, cb)), [run]);
  const ask = useCallback(
    (q: string) => run((s, cb) => streamAsk(s, q, cb)),
    [run],
  );

  return { sid, text, busy, tokens, coach, ask };
}
