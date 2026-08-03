"use client";

import { Code2 } from "lucide-react";
import { useDevMode } from "@/context/DevModeContext";
import { useLocalToggle } from "@/hooks/useLocalToggle";

/** Floating toggle, fixed to the bottom-right corner, that reveals developer-only tabs/features app-wide. */
export default function DevModeFab() {
  const { devMode, toggleDevMode } = useDevMode();
  const [showButton] = useLocalToggle("gigdevbutton");

  if (!showButton) return null;

  return (
    <button
      onClick={toggleDevMode}
      className="dev-mode-fab"
      data-on={devMode}
      title={devMode ? "Developer mode: ON — click to hide dev-only features" : "Developer mode: OFF — click to reveal dev-only features"}
      aria-label="Toggle developer mode"
      aria-pressed={devMode}
    >
      <style>{`
        .dev-mode-fab {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 500;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--bg-surface);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
          opacity: 0.55;
          transition: opacity 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s;
        }
        .dev-mode-fab:hover {
          opacity: 1;
          color: var(--text-primary);
          transform: translateY(-1px);
        }
        .dev-mode-fab[data-on="true"] {
          opacity: 1;
          color: var(--blue);
          border-color: var(--blue);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15), 0 2px 8px rgba(0,0,0,0.18);
        }
      `}</style>
      <Code2 size={16} />
    </button>
  );
}
