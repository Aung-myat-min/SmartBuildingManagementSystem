"use client";

import * as React from "react";

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
 */
export function usePersistedState<T>(
  key: string,
  fallback: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = React.useState<T>(fallback);
  const [restored, setRestored] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Private windows and blocked site data both throw; the fallback stands.
    }
    setRestored(true);
  }, [key]);

  React.useEffect(() => {
    // Don't write the fallback back over a stored value before it is read.
    if (!restored) return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Nothing to do — the preference just won't outlive this session.
    }
  }, [key, value, restored]);

  return [value, setValue];
}
