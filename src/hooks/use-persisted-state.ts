"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth";

const PREFIX = "sbm:";

/**
 * State that survives a reload, kept in localStorage under one key.
 *
 * Use it for how a page is *shown* — which view is selected, what is
 * collapsed, how a list is sorted. Not for what is being *looked at*: search
 * text and data filters are task-scoped, and silently restoring them leaves
 * someone staring at a filtered list wondering where their records went.
 *
 * The stored value is read after mount rather than during render, because the
 * server has no localStorage and a value read during render would make the
 * prerendered HTML and the first client render disagree.
 *
 * Keys carry the signed-in uid. Two people sharing a browser otherwise share
 * every view preference, and an Admin Manager would inherit whichever tab the
 * last person left Administration on.
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
