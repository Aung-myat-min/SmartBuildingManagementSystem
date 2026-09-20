"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth";

const PREFIX = "sbm:";

/**
 * View state that survives a reload, in localStorage, keyed by the signed-in
 * uid so two people sharing a browser do not share preferences.
 *
 * For how a page is *shown* — selected view, collapsed sections, sort order —
 * not what is being looked at: restoring filters leaves someone staring at a
 * list with records apparently missing. Read after mount, never during render;
 * the server has no localStorage and the mismatch breaks hydration.
 */
export function usePersistedState<T>(
  key: string,
  fallback: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { user } = useAuth();
  // Signed out there is nobody to scope to, and nothing below the gate renders
  // anyway; the shared key keeps the /login screens from needing a special case.
  const scoped = `${PREFIX}${user?.uid ?? "anon"}:${key}`;

  const [value, setValue] = React.useState<T>(fallback);
  const [restored, setRestored] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(scoped);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Private windows and blocked site data both throw; the fallback stands.
    }
    setRestored(true);
  }, [scoped]);

  React.useEffect(() => {
    // Don't write the fallback back over a stored value before it is read.
    if (!restored) return;
    try {
      window.localStorage.setItem(scoped, JSON.stringify(value));
    } catch {
      // Nothing to do — the preference just won't outlive this session.
    }
  }, [scoped, value, restored]);

  return [value, setValue];
}
