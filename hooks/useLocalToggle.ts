"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Boolean preference persisted to localStorage, scoped to the current browser.
 * Defaults to `false` on the server and until the stored value is read on mount,
 * so screens gated by this should default to their "hidden" state.
 */
export function useLocalToggle(key: string, defaultValue = false) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored !== null) setValue(stored === "true");
  }, [key]);

  const set = useCallback((next: boolean) => {
    setValue(next);
    localStorage.setItem(key, String(next));
  }, [key]);

  return [value, set] as const;
}
