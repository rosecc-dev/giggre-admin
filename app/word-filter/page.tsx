"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminLayout from "@/components/layout/AdminLayout";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useAuth } from "@/context/AuthContext";
import { writeLog, buildDescription } from "@/lib/activitylog";
import { toast } from "@/components/ui/Toaster";
import {
  Plus,
  X,
  Save,
  RotateCcw,
  RefreshCw,
  Search,
  ClipboardPaste,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTerm(raw: string): string {
  return raw.trim().toLowerCase();
}

function splitBulk(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map(normalizeTerm)
    .filter(Boolean);
}

function docRef() {
  return doc(db, "app_content", "word_filter");
}

interface WordFilterDoc {
  blockedTerms: string[];
  enabled: boolean;
}

const DEFAULTS: WordFilterDoc = { blockedTerms: [], enabled: true };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WordFilterPage() {
  const { user } = useAuth();
  useAuthGuard({ module: "word-filter" });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [terms, setTerms] = useState<string[]>(DEFAULTS.blockedTerms);
  const [savedTerms, setSavedTerms] = useState<string[]>(DEFAULTS.blockedTerms);
  const [enabled, setEnabled] = useState<boolean>(DEFAULTS.enabled);
  const [savedEnabled, setSavedEnabled] = useState<boolean>(DEFAULTS.enabled);

  const [newTerm, setNewTerm] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(docRef());
      if (snap.exists()) {
        const data = snap.data();
        const loadedTerms: string[] = Array.isArray(data.blockedTerms)
          ? [...data.blockedTerms].sort()
          : [];
        const loadedEnabled = data.enabled ?? true;
        setTerms(loadedTerms);
        setSavedTerms(loadedTerms);
        setEnabled(loadedEnabled);
        setSavedEnabled(loadedEnabled);
        setLastUpdated(data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : null);
      } else {
        setTerms(DEFAULTS.blockedTerms);
        setSavedTerms(DEFAULTS.blockedTerms);
        setEnabled(DEFAULTS.enabled);
        setSavedEnabled(DEFAULTS.enabled);
        setLastUpdated(null);
      }
    } catch {
      toast.error("Load failed", "Could not load the word filter list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const hasChanges =
    enabled !== savedEnabled || JSON.stringify(terms) !== JSON.stringify(savedTerms);

  // ── Add / remove ─────────────────────────────────────────────────────────────

  const addTerm = () => {
    const term = normalizeTerm(newTerm);
    if (!term) return;
    if (terms.includes(term)) {
      toast.warning("Duplicate term", `"${term}" is already in the list.`);
      return;
    }
    setTerms((prev) => [...prev, term].sort());
    setNewTerm("");
  };

  const addBulk = () => {
    const incoming = splitBulk(bulkText);
    if (incoming.length === 0) return;

    const existing = new Set(terms);
    const added: string[] = [];
    let duplicates = 0;

    for (const term of incoming) {
      if (existing.has(term)) {
        duplicates++;
        continue;
      }
      existing.add(term);
      added.push(term);
    }

    if (added.length > 0) {
      setTerms([...existing].sort());
    }
    setBulkText("");

    if (added.length === 0) {
      toast.warning("No new terms", `All ${incoming.length} term(s) were already in the list.`);
    } else if (duplicates > 0) {
      toast.success("Terms added", `Added ${added.length} new term(s), skipped ${duplicates} duplicate(s).`);
    } else {
      toast.success("Terms added", `Added ${added.length} new term(s).`);
    }
  };

  const removeTerm = (term: string) => {
    setTerms((prev) => prev.filter((t) => t !== term));
  };

  // ── Save / discard ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(docRef(), {
        blockedTerms: terms,
        enabled,
        lastUpdated: new Date(),
        updatedBy: user.uid,
      });

      setSavedTerms(terms);
      setSavedEnabled(enabled);
      setLastUpdated(new Date());

      await writeLog({
        actorId: user.uid,
        actorName: user.displayName ?? "Unknown",
        actorEmail: user.email ?? "",
        module: "word_filter",
        action: "word_filter_updated",
        description: buildDescription.wordFilterUpdated(terms.length, enabled),
        targetName: "app_content/word_filter",
      });

      toast.success("Saved", "Word filter list updated.");
    } catch {
      toast.error("Save failed", "Could not save the word filter. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setTerms(savedTerms);
    setEnabled(savedEnabled);
    toast.info("Discarded", "Changes reverted to last saved state.");
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const filteredTerms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? terms.filter((t) => t.includes(q)) : terms;
  }, [terms, search]);

  return (
    <AdminLayout
      title="Word Filter"
      subtitle="Manage blocked terms enforced across gig posts, profiles, chat, and support tickets"
    >
      <style>{`
        .wf-wrap { display: flex; flex-direction: column; height: 100%; }
        .wf-body { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 24px; }

        .wf-save-bar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 12px 24px;
          background: var(--bg-elevated); border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .wf-save-bar-info { display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .wf-save-bar-actions { display: flex; gap: 8px; }
        .wf-unsaved-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--orange); flex-shrink: 0; }

        .wf-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md); }
        .wf-card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .wf-card-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
        .wf-card-body { padding: 16px 20px; }

        .wf-status-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
        .wf-status-meta { display: flex; flex-direction: column; gap: 4px; }
        .wf-status-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .wf-status-desc { font-size: 12px; color: var(--text-muted); }

        .wf-toggle-wrap { flex-shrink: 0; display: flex; align-items: center; gap: 10px; }
        .wf-toggle { position: relative; width: 44px; height: 24px; border-radius: 12px; cursor: pointer; border: none; transition: background 0.2s; outline: none; flex-shrink: 0; }
        .wf-toggle--on  { background: var(--blue); }
        .wf-toggle--off { background: var(--bg-hover); border: 1px solid var(--border); }
        .wf-toggle-thumb { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: white; transition: left 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        .wf-toggle--on  .wf-toggle-thumb { left: 23px; }
        .wf-toggle--off .wf-toggle-thumb { left: 3px; }
        .wf-toggle-state { font-size: 12px; font-weight: 600; }
        .wf-toggle-state--on  { color: var(--blue); }
        .wf-toggle-state--off { color: var(--text-muted); }

        .wf-add-row { display: flex; gap: 8px; }
        .wf-input {
          flex: 1; padding: 8px 12px;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-sm); color: var(--text-primary);
          font-size: 13px; font-family: inherit; transition: border 0.15s;
        }
        .wf-input:focus { outline: none; border-color: var(--blue); }

        .wf-textarea {
          width: 100%; padding: 10px 14px;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-sm); color: var(--text-primary);
          font-size: 13px; font-family: inherit; resize: vertical;
          min-height: 84px; line-height: 1.6; transition: border 0.15s;
        }
        .wf-textarea:focus { outline: none; border-color: var(--blue); }
        .wf-bulk-hint { font-size: 11px; color: var(--text-muted); margin-top: 6px; }
        .wf-bulk-actions { display: flex; justify-content: flex-end; margin-top: 10px; }

        .wf-search-wrap {
          display: flex; align-items: center; gap: 8px;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-sm); padding: 7px 12px; margin-bottom: 14px;
        }
        .wf-search-wrap input {
          flex: 1; background: none; border: none; outline: none;
          color: var(--text-primary); font-size: 13px; font-family: inherit;
        }
        .wf-search-wrap input::placeholder { color: var(--text-muted); }

        .wf-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .wf-chip {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; padding: 5px 6px 5px 12px;
          border-radius: 20px; background: var(--red-dim); color: var(--red);
        }
        .wf-chip-remove {
          display: flex; align-items: center; justify-content: center;
          width: 18px; height: 18px; border-radius: 50%; border: none;
          background: rgba(239,68,68,0.16); color: var(--red); cursor: pointer;
          transition: background 0.15s;
        }
        .wf-chip-remove:hover { background: rgba(239,68,68,0.32); }
        .wf-empty { padding: 32px 20px; text-align: center; color: var(--text-muted); font-size: 13px; }

        .wf-skeleton { background: var(--bg-elevated); border-radius: 6px; animation: wf-pulse 1.4s ease-in-out infinite; }
        @keyframes wf-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.9; } }
      `}</style>

      <div className="wf-wrap">

        {/* ── Save bar ── */}
        <div className="wf-save-bar">
          <div className="wf-save-bar-info">
            {hasChanges ? (
              <>
                <span className="wf-unsaved-dot" />
                <span style={{ color: "var(--text-secondary)" }}>Unsaved changes</span>
              </>
            ) : (
              <span style={{ color: "var(--text-muted)" }}>
                {loading ? "Loading word filter…" : "Word filter is up to date"}
              </span>
            )}
          </div>
          <div className="wf-save-bar-actions">
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadConfig} disabled={loading || saving}>
              Refresh
            </Button>
            {hasChanges && (
              <Button variant="secondary" size="sm" icon={RotateCcw} onClick={handleDiscard} disabled={saving}>
                Discard
              </Button>
            )}
            <Button variant="primary" size="sm" icon={Save} onClick={handleSave} loading={saving} disabled={!hasChanges || loading}>
              Save Changes
            </Button>
          </div>
        </div>

        <div className="wf-body">

          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {/* ── Status card ── */}
              <div className="wf-card">
                <div className="wf-card-body">
                  <div className="wf-status-row">
                    <div className="wf-status-meta">
                      <div className="wf-status-label">Filter Enabled</div>
                      <div className="wf-status-desc">
                        When disabled, blocked terms are not enforced anywhere in the app.
                      </div>
                    </div>
                    <div className="wf-toggle-wrap">
                      <span className={`wf-toggle-state wf-toggle-state--${enabled ? "on" : "off"}`}>
                        {enabled ? "ON" : "OFF"}
                      </span>
                      <button
                        className={`wf-toggle wf-toggle--${enabled ? "on" : "off"}`}
                        onClick={() => setEnabled(!enabled)}
                        role="switch"
                        aria-checked={enabled}
                        type="button"
                      >
                        <span className="wf-toggle-thumb" />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <Badge variant={enabled ? "green" : "gray"} dot>{enabled ? "Active" : "Inactive"}</Badge>
                    <Badge variant="blue">{terms.length} blocked term{terms.length !== 1 ? "s" : ""}</Badge>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {lastUpdated
                        ? `Last updated ${lastUpdated.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`
                        : "Never updated"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Add term ── */}
              <div className="wf-card">
                <div className="wf-card-header">
                  <span className="wf-card-title">Add a Term</span>
                </div>
                <div className="wf-card-body">
                  <div className="wf-add-row">
                    <input
                      className="wf-input"
                      type="text"
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addTerm(); }}
                      placeholder="e.g. some-term"
                    />
                    <Button variant="primary" size="sm" icon={Plus} onClick={addTerm} disabled={!newTerm.trim()}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Bulk add ── */}
              <div className="wf-card">
                <div className="wf-card-header">
                  <span className="wf-card-title">Bulk Add</span>
                </div>
                <div className="wf-card-body">
                  <textarea
                    className="wf-textarea"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={"term one, term two\nterm three"}
                  />
                  <div className="wf-bulk-hint">Separate terms with a comma or a new line.</div>
                  <div className="wf-bulk-actions">
                    <Button variant="secondary" size="sm" icon={ClipboardPaste} onClick={addBulk} disabled={!bulkText.trim()}>
                      Add Terms
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Blocked terms list ── */}
              <div className="wf-card">
                <div className="wf-card-header">
                  <span className="wf-card-title">Blocked Terms ({terms.length})</span>
                </div>
                <div className="wf-card-body">
                  <div className="wf-search-wrap">
                    <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search terms…"
                    />
                  </div>

                  {filteredTerms.length === 0 ? (
                    <div className="wf-empty">
                      {terms.length === 0
                        ? "No blocked terms yet. Add one above."
                        : "No terms match your search."}
                    </div>
                  ) : (
                    <div className="wf-chips">
                      {filteredTerms.map((term) => (
                        <span key={term} className="wf-chip">
                          {term}
                          <button
                            className="wf-chip-remove"
                            onClick={() => removeTerm(term)}
                            title={`Remove "${term}"`}
                            type="button"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </AdminLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="wf-card">
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="wf-skeleton" style={{ height: 14, width: "40%" }} />
              <div className="wf-skeleton" style={{ height: 11, width: "65%" }} />
            </div>
            <div className="wf-skeleton" style={{ height: 34, width: 100, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
