import { useEffect, useState } from "react";
import { useT } from "../i18n.js";
import { useStore } from "../store.js";
import { Markdown } from "./Markdown.js";

const DATE_LOCALES: Record<string, string> = { en: "en-US", es: "es-ES", ru: "ru-RU" };

function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(DATE_LOCALES[locale] ?? "en-US", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * One knowledge note, full-pane. Opens on top of wherever the user was — the memory
 * index or a task (via a [[wikilink]]) — and the breadcrumb goes back there.
 */
export function NoteView() {
  const project = useStore((s) => s.projects.find((p) => p.slug === s.selectedSlug));
  const note = useStore((s) => s.selectedNote);
  const noteId = useStore((s) => s.selectedNoteId);
  const fromTask = useStore((s) => s.selectedTaskId);
  const fromIndex = useStore((s) => s.memoryOpen);
  const locale = useStore((s) => s.locale);
  const closeNote = useStore((s) => s.closeNote);
  const closeTask = useStore((s) => s.closeTask);
  const closeMemory = useStore((s) => s.closeMemory);
  const saveNote = useStore((s) => s.saveNote);
  const openTask = useStore((s) => s.openTask);
  const t = useT();

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());

  useEffect(() => {
    setEditing(false);
    setExpandedVersions(new Set());
  }, [noteId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (editing) setEditing(false);
      else closeNote();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeNote, editing]);

  if (!project) return null;

  function goToBoard() {
    closeNote();
    closeTask();
    closeMemory();
  }

  function startEditing() {
    if (!note) return;
    setTitleDraft(note.title);
    setBodyDraft(note.body);
    setSummaryDraft("");
    setEditing(true);
  }

  async function save() {
    await saveNote(titleDraft.trim(), bodyDraft, summaryDraft.trim());
    setEditing(false);
  }

  function toggleVersion(version: number) {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-150 px-5 py-2.5 dark:border-neutral-800">
        <nav className="flex min-w-0 items-center gap-1.5 text-[12px] text-neutral-400">
          <button
            onClick={goToBoard}
            title={t.backToBoardTooltip}
            className="max-w-[200px] shrink-0 truncate rounded px-1 py-0.5 font-medium hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            {project.name}
          </button>
          {fromTask && (
            <>
              <span className="shrink-0 text-neutral-300 dark:text-neutral-700">/</span>
              <button
                onClick={closeNote}
                className="shrink-0 rounded px-1 py-0.5 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                {fromTask}
              </button>
            </>
          )}
          {!fromTask && fromIndex && (
            <>
              <span className="shrink-0 text-neutral-300 dark:text-neutral-700">/</span>
              <button
                onClick={closeNote}
                className="shrink-0 rounded px-1 py-0.5 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                {t.memoryTitle}
              </button>
            </>
          )}
          <span className="shrink-0 text-neutral-300 dark:text-neutral-700">/</span>
          <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 font-medium text-accent">
            [[{noteId}]]
          </span>
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          {!editing && note && (
            <button
              onClick={startEditing}
              className="rounded px-1.5 py-0.5 text-[12px] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              {t.editButton}
            </button>
          )}
          <button
            onClick={closeNote}
            title={t.closeTooltip}
            className="rounded px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
        <div className="mx-auto w-full max-w-[780px]">
          {!note ? (
            <p className="text-[12px] text-neutral-300">…</p>
          ) : editing ? (
            <>
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="mb-3 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-[18px] font-semibold outline-none focus:border-accent dark:border-neutral-700"
              />
              <textarea
                value={bodyDraft}
                onChange={(e) => setBodyDraft(e.target.value)}
                rows={14}
                autoFocus
                className="w-full min-h-[300px] resize-y rounded-lg border border-neutral-200 bg-transparent px-3.5 py-3 font-mono text-[13px] leading-relaxed outline-none focus:border-accent dark:border-neutral-700"
              />
              <div className="mt-1.5 flex flex-col gap-1.5">
                <input
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  placeholder={t.summaryPlaceholder}
                  className="rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[12px] outline-none focus:border-accent dark:border-neutral-700"
                />
                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={!titleDraft.trim()}
                    className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                  >
                    {t.saveButton}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-md px-2.5 py-1 text-[12px] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t.cancelButton}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-[24px] font-semibold leading-tight tracking-[-0.01em]">{note.title}</h1>
              <div className="mb-6 flex flex-wrap items-center gap-1.5 text-[11.5px] text-neutral-400">
                <span>v{note.version}</span>
                <span>·</span>
                <span>{formatTime(note.updated, locale)}</span>
                {note.sources.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{t.noteSourcesLabel}:</span>
                    {note.sources.map((s) => (
                      <button
                        key={s}
                        onClick={() => openTask(s)}
                        className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      >
                        {s}
                      </button>
                    ))}
                  </>
                )}
              </div>

              <section className="mb-9">
                <Markdown text={note.body} />
              </section>

              <section>
                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  {t.noteHistoryHeading(note.history.length)}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {note.history.map((u) => {
                    const expanded = expandedVersions.has(u.version);
                    return (
                      <div key={u.version} className="rounded-md border border-neutral-150 dark:border-neutral-800">
                        <button
                          onClick={() => toggleVersion(u.version)}
                          className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                        >
                          <span className="mt-0.5 shrink-0 text-[10px] text-neutral-400">
                            {expanded ? "▾" : "▸"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
                              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
                                v{u.version}
                              </span>
                              <span>{formatTime(u.timestamp, locale)}</span>
                              <span>·</span>
                              <span>
                                {u.author === "agent" ? t.roleAgent : u.author === "human" ? t.roleHuman : u.author}
                              </span>
                            </div>
                            <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-neutral-800 dark:text-neutral-200">
                              {u.summary}
                            </div>
                          </div>
                        </button>
                        {expanded && (
                          <div className="border-t border-neutral-150 px-2.5 py-2 dark:border-neutral-800">
                            <div className="mb-1 text-[11px] text-neutral-400">{t.versionSnapshotLabel}</div>
                            <div className="rounded-md bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60">
                              {u.description ? (
                                <Markdown text={u.description} className="text-[12.5px]" />
                              ) : (
                                <span className="text-[12px] text-neutral-400">{t.emptyPlaceholder}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
