"use client";

import { createContext, useContext, ReactNode } from "react";
import { useLocalToggle } from "@/hooks/useLocalToggle";

const STORAGE_KEY = "giggre_dev_mode";

interface DevModeContextValue {
  devMode: boolean;
  setDevMode: (value: boolean) => void;
  toggleDevMode: () => void;
}

const DevModeContext = createContext<DevModeContextValue>({
  devMode: false,
  setDevMode: () => {},
  toggleDevMode: () => {},
});

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [devMode, setDevMode] = useLocalToggle(STORAGE_KEY);

  return (
    <DevModeContext.Provider
      value={{ devMode, setDevMode, toggleDevMode: () => setDevMode(!devMode) }}
    >
      {children}
    </DevModeContext.Provider>
  );
}

/** Gates developer-only tabs/features that should stay hidden until switched on via the Developer Toggle FAB. */
export function useDevMode() {
  return useContext(DevModeContext);
}
