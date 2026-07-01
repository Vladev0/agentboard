import { useEffect, useRef, useState } from "react";
import { PRIORITY_DOT_CLASSES, STATUS_DOT_CLASSES } from "../colors.js";
import { cap, priorityLabels, useT } from "../i18n.js";
import { useStore } from "../store.js";
import type { Priority, Task } from "../types.js";
import { api } from "../api.js";

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

function formatRelative(iso: string, t: ReturnType<typeof useT>): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return t.minutesAgo(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t.hoursAgo(hours);
  const days = Math.round(hours / 24);
  return t.daysAgo(days);
}

/**
 * Surfaces how much happened between two update checkpoints — the "cycles" of
 * comments/activity a big update distills. Returns null for the very first
 * update (task creation), where there's nothing to summarize yet.
 */
function describeActivitySince(
  task: Task,
  sinceIso: string | undefined,
  untilIso: string,
  t: ReturnType<typeof useT>
): string | null {
  if (!sinceIso) return null;
  const inWindow = (ts: string) => ts > sinceIso && ts <= untilIso;
  const comments = task.comments.filter((c) => inWindow(c.timestamp)).length;
  const activity = task.activity.filter((a) => inWindow(a.timestamp)).length;
  return t.sinceLastUpdate(comments, activity);
}

type Tab = "overview" | "updates";

export function TaskDetail() {
  const task = useStore((s) => s.selectedTask);
  const project = useStore((s) => s.projects.find((p) => p.slug === s.selectedSlug));
  const locale = useStore((s) => s.locale);
  const closeTask = useStore((s) => s.closeTask);
  const setStatus = useStore((s) => s.setStatus);
  const setDescription = useStore((s) => s.setDescription);
  const addComment = useStore((s) => s.addComment);
  const createSubtask = useStore((s) => s.createSubtask);
  const deleteTask = useStore((s) => s.deleteTask);
  const openTask = useStore((s) => s.openTask);
  const selectedSlug = useStore((s) => s.selectedSlug);
  const parentSummary = useStore((s) =>
    task?.parent && s.selectedSlug
      ? s.tasksBySlug[s.selectedSlug]?.find((t) => t.id === task.parent)
      : undefined
  );
  const t = useT();
  const labels = priorityLabels(t);

  const [tab, setTab] = useState<Tab>("overview");
  const [descDraft, setDescDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());
  const [activityOpen, setActivityOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDescDraft(task?.description ?? "");
    setSummaryDraft("");
    setTab("overview");
  }, [task?.id]);

  useEffect(() => {
    setDescDraft(task?.description ?? "");
  }, [task?.description]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeTask();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTask]);

  if (!task || !project) return null;

  const descriptionDirty = descDraft !== task.description;
  const latestUpdate = task.updates[0];

  async function togglePriority(priority: Priority) {
    if (!selectedSlug) return;
    await api.patchTask(selectedSlug, task!.id, { priority });
    await openTask(task!.id);
  }

  function toggleVersion(version: number) {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  }

  async function saveDescription() {
    await setDescription(task!.id, descDraft, summaryDraft.trim());
    setSummaryDraft("");
  }

  function deleteSubtask(sub: { id: string; title: string }) {
    if (!confirm(t.confirmDeleteSubtask(sub.title))) return;
    deleteTask(sub.id);
  }

  function deleteCurrentTask() {
    if (!confirm(t.confirmDeleteTask(task!.title, Boolean(task!.parent), task!.subtasks.length))) return;
    deleteTask(task!.id);
  }

  function toggleMaximize() {
    const el = panelRef.current;
    if (!el) return;
    if (maximized) {
      el.style.width = "";
      el.style.height = "";
    } else {
      el.style.width = "96vw";
      el.style.height = "94vh";
    }
    setMaximized((v) => !v);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-0 md:p-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeTask();
      }}
    >
      <div
        ref={panelRef}
        className="flex h-full w-full flex-col overflow-hidden border border-neutral-150 bg-white shadow-2xl dark:border-neutral-800 dark:bg-[#0d0d0e] md:h-[min(84vh,860px)] md:w-[min(880px,92vw)] md:min-h-[360px] md:min-w-[420px] md:max-h-[100vh] md:max-w-[100vw] md:resize md:rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-150 px-4 py-3 dark:border-neutral-800">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px]">
            {task.parent && (
              <>
                <button
                  onClick={() => openTask(task.parent!)}
                  title={t.backToParentTitle}
                  className="flex min-w-0 shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-medium text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                >
                  <span>←</span>
                  <span>{parentSummary ? parentSummary.id : task.parent}</span>
                  {parentSummary && (
                    <span className="hidden max-w-[160px] truncate text-neutral-400 sm:inline">
                      · {parentSummary.title}
                    </span>
                  )}
                </button>
                <span className="shrink-0 text-neutral-300 dark:text-neutral-700">/</span>
              </>
            )}
            <span className="truncate font-medium text-neutral-500 dark:text-neutral-300">{task.id}</span>
            {task.parent && (
              <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                {t.subtaskBadge}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={toggleMaximize}
              title={maximized ? t.restoreSizeTooltip : t.maximizeTooltip}
              className="hidden rounded px-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 md:block dark:hover:bg-neutral-800"
            >
              {maximized ? "⤡" : "⤢"}
            </button>
            <button
              onClick={deleteCurrentTask}
              title={t.deleteTaskTooltip}
              className="rounded px-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              🗑
            </button>
            <button
              onClick={closeTask}
              title={t.closeTooltip}
              className="rounded px-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-10 md:py-6">
          <div className="mx-auto w-full max-w-[680px]">
            <h1 className="mb-3 text-[20px] font-semibold leading-snug">{task.title}</h1>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={task.status}
                onChange={(e) => setStatus(task.id, e.target.value)}
                className="rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-[12px] outline-none dark:border-neutral-700"
              >
                {project.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={task.priority}
                onChange={(e) => togglePriority(e.target.value as Priority)}
                className="rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-[12px] outline-none dark:border-neutral-700"
              >
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT_CLASSES[task.priority]}`} />
                {cap(task.assignee === "agent" ? t.roleAgent : t.roleHuman)}
              </span>
            </div>

            {latestUpdate && (
              <button
                onClick={() => setTab("updates")}
                className="mb-4 text-[11px] text-neutral-400 hover:text-accent hover:underline"
              >
                {t.updatedAgo(
                  formatRelative(latestUpdate.timestamp, t),
                  latestUpdate.author === "agent" ? t.roleAgent : t.roleHuman,
                  task.version
                )}
              </button>
            )}

            <div className="mb-5 flex gap-4 border-b border-neutral-150 dark:border-neutral-800">
              <button
                onClick={() => setTab("overview")}
                className={`-mb-px border-b-2 px-0.5 pb-2 text-[13px] font-medium ${
                  tab === "overview"
                    ? "border-accent text-accent"
                    : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                }`}
              >
                {t.tabOverview}
              </button>
              <button
                onClick={() => setTab("updates")}
                className={`-mb-px border-b-2 px-0.5 pb-2 text-[13px] font-medium ${
                  tab === "updates"
                    ? "border-accent text-accent"
                    : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                }`}
              >
                {t.tabUpdates(task.updates.length)}
              </button>
            </div>

            {tab === "overview" && (
              <>
                <section className="mb-7">
                  <textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={12}
                    placeholder={t.descriptionPlaceholder}
                    className="w-full min-h-[280px] resize-y rounded-lg border border-neutral-200 bg-transparent px-3.5 py-3 text-[14.5px] leading-relaxed outline-none focus:border-accent dark:border-neutral-700"
                  />
                  {descriptionDirty && (
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      <input
                        value={summaryDraft}
                        onChange={(e) => setSummaryDraft(e.target.value)}
                        placeholder={t.summaryPlaceholder}
                        className="rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[12px] outline-none focus:border-accent dark:border-neutral-700"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveDescription}
                          className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent-hover"
                        >
                          {t.saveAsUpdateButton}
                        </button>
                        <button
                          onClick={() => {
                            setDescDraft(task.description);
                            setSummaryDraft("");
                          }}
                          className="rounded-md px-2.5 py-1 text-[12px] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          {t.cancelButton}
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                <section className="mb-6">
                  <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {t.subtasksHeading(task.subtasks.filter((s) => s.done).length, task.subtasks.length)}
                  </h2>
                  <div className="flex flex-col gap-1">
                    {task.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <select
                          value={sub.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setStatus(sub.id, e.target.value)}
                          className="rounded border border-neutral-200 bg-transparent px-1 py-0.5 text-[11px] outline-none dark:border-neutral-700"
                        >
                          {project.statuses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => openTask(sub.id)}
                          className="flex flex-1 items-center gap-2 truncate text-left"
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              STATUS_DOT_CLASSES[
                                project.statuses.find((s) => s.id === sub.status)?.color ?? "gray"
                              ]
                            }`}
                          />
                          <span className="shrink-0 text-neutral-400">{sub.id}</span>
                          <span className={`truncate ${sub.done ? "text-neutral-400 line-through" : ""}`}>
                            {sub.title}
                          </span>
                        </button>
                        <button
                          onClick={() => deleteSubtask(sub)}
                          title={t.deleteSubtaskTooltip}
                          className="shrink-0 rounded px-1 text-neutral-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!subtaskDraft.trim()) return;
                      createSubtask(task.id, subtaskDraft.trim());
                      setSubtaskDraft("");
                    }}
                    className="mt-1.5 flex gap-1.5"
                  >
                    <input
                      value={subtaskDraft}
                      onChange={(e) => setSubtaskDraft(e.target.value)}
                      placeholder={t.addSubtaskPlaceholder}
                      className="flex-1 rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-[12px] outline-none focus:border-accent dark:border-neutral-700"
                    />
                  </form>
                </section>

                <section>
                  <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {t.commentsHeading}
                  </h2>
                  <div className="flex flex-col gap-3">
                    {task.comments.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-md bg-neutral-50 px-2.5 py-2 text-[13px] dark:bg-neutral-800/60"
                      >
                        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-neutral-400">
                          <span className="font-medium text-neutral-500 dark:text-neutral-300">
                            {c.author === "agent" ? cap(t.roleAgent) : c.author === "human" ? t.roleYou : c.author}
                          </span>
                          <span>{formatTime(c.timestamp, locale)}</span>
                        </div>
                        <div className="whitespace-pre-wrap">{c.text}</div>
                      </div>
                    ))}
                    {task.comments.length === 0 && (
                      <p className="text-[12px] text-neutral-300">{t.noCommentsYet}</p>
                    )}
                  </div>
                </section>
              </>
            )}

            {tab === "updates" && (
              <>
                <section className="mb-6">
                  <div className="flex flex-col gap-1.5">
                    {task.updates.map((u, i) => {
                      const prev = task.updates[i + 1];
                      const sinceLabel = describeActivitySince(task, prev?.timestamp, u.timestamp, t);
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
                                {sinceLabel && (
                                  <>
                                    <span>·</span>
                                    <span>{sinceLabel}</span>
                                  </>
                                )}
                              </div>
                              <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-neutral-800 dark:text-neutral-200">
                                {u.summary}
                              </div>
                            </div>
                          </button>
                          {expanded && (
                            <div className="border-t border-neutral-150 px-2.5 py-2 dark:border-neutral-800">
                              <div className="mb-1 text-[11px] text-neutral-400">{t.versionSnapshotLabel}</div>
                              <div className="whitespace-pre-wrap rounded-md bg-neutral-50 px-2.5 py-2 text-[12px] text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">
                                {u.description || t.emptyPlaceholder}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <button
                    onClick={() => setActivityOpen((v) => !v)}
                    className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <span>{activityOpen ? "▾" : "▸"}</span>
                    <span>{t.activityHeading(task.activity.length)}</span>
                  </button>
                  {activityOpen && (
                    <div className="flex flex-col gap-1.5">
                      {task.activity
                        .slice()
                        .reverse()
                        .map((a, i) => (
                          <div key={i} className="text-[11px] text-neutral-400">
                            <span>{formatTime(a.timestamp, locale)}</span>
                            <span> · </span>
                            <span>
                              {a.author === "agent" ? t.roleAgent : a.author === "human" ? t.roleHuman : a.author}
                            </span>
                            <span> · </span>
                            <span>{a.note}</span>
                          </div>
                        ))}
                      {task.activity.length === 0 && (
                        <p className="text-[11px] text-neutral-300">{t.noActivityYet}</p>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>

        {tab === "overview" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!commentDraft.trim()) return;
              addComment(task.id, commentDraft.trim());
              setCommentDraft("");
            }}
            className="flex items-center gap-2 border-t border-neutral-150 p-3 dark:border-neutral-800"
          >
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder={t.commentInputPlaceholder}
              className="flex-1 rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-accent dark:border-neutral-700"
            />
            <button
              type="submit"
              disabled={!commentDraft.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
            >
              {t.sendButton}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
