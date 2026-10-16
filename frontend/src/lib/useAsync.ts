import { useCallback, useEffect, useState } from "react";

/** A tiny load-once-with-reload hook. No caching, no fabrication. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn().then(
      (v) => {
        if (alive) {
          setData(v);
          setLoading(false);
        }
      },
      (e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, deps);

  useEffect(run, [run]);
  return { data, error, loading, reload: run };
}

/** Same contract as `useAsync`, but re-runs on an interval for live records. */
export function usePoll<T>(fn: () => Promise<T>, everyMs: number, deps: unknown[] = []) {
  const { data, error, loading, reload } = useAsync(fn, deps);
  useEffect(() => {
    const t = setInterval(reload, everyMs);
    return () => clearInterval(t);
  }, [reload, everyMs]);
  return { data, error, loading, reload };
}
