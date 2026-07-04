import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { PRIORITY_DOT_CLASSES, STATUS_DOT_CLASSES } from "../colors.js";
import { cap, priorityLabels, statusLabel, useT } from "../i18n.js";
import { useStore } from "../store.js";
import type { Priority, Task, TaskSummary } from "../types.js";
import { api } from "../api.js";
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

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(DATE_LOCALES[locale] ?? "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
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

function taskNumber(id: string): number {
  const m = id.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

// System summaries written by the core when a description was saved without an
// explanation ("Description updated." is the pre-0.2 form kept for old files).
const MINOR_EDIT_SUMMARIES = new Set(["Minor edit.", "Description updated."]);

type Tab = "overview" | "updates";

function PropRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</div>
      {children}
    </div>
  );
}

export function TaskDetail() {
  const task = useStore((s) => s.selectedTask);
  const project = useStore((s) => s.projects.find((p) => p.slug === s.selectedSlug));
  const allTasks = useStore((s) => (s.selectedSlug ? s.tasksBySlug[s.selectedSlug] ?? [] : []));
  const locale = useStore((s) => s.locale);
  const closeTask = useStore((s) => s.closeTask);
  const setStatus = useStore((s) => s.setStatus);
  const setBlocked = useStore((s) => s.setBlocked);
  const setDescription = useStore((s) => s.setDescription);
  const addComment = useStore((s) => s.addComment);
  const createSubtask = useStore((s) => s.createSubtask);
  const deleteTask = useStore((s) => s.deleteTask);
  const openTask = useStore((s) => s.openTask);
  const selectedSlug = useStore((s) => s.selectedSlug);
  const t = useT();
  const labels = priorityLabels(t);

  const [tab, setTab] = useState<Tab>("overview");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());
  const [activityOpen, setActivityOpen] = useState(false);
  const commentBoxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSummaryDraft("");
    setTab("overview");
    setEditingDesc(false);
    setExpandedVersions(new Set());
  }, [task?.id]);

  useEffect(() => {
    // Keep the draft in sync with live changes (agent edits over WS) — but never
    // clobber text the human is currently editing.
    if (!editingDesc) setDescDraft(task?.description ?? "");
  }, [task?.description, editingDesc]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (editingDesc) {
        setEditingDesc(false);
        setSummaryDraft("");
      } else {
        closeTask();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTask, editingDesc]);

  if (!task || !project) {
    return <div className="flex h-full min-w-0 flex-1 items-center justify-center text-[12px] text-neutral-300">…</div>;
  }

  // Breadcrumb chain: walk up the parent links using the light task summaries.
  const chain: TaskSummary[] = [];
  let parentId = task.parent;
  let guard = 0;
  while (parentId && guard++ < 6) {
    const p = allTasks.find((x) => x.id === parentId);
    if (!p) break;
    chain.unshift(p);
    parentId = p.parent;
  }

  // Prev/next navigation cycles between siblings: subtasks of the same parent,
  // or top-level tasks of the project for a top-level task.
  const siblings = allTasks
    .filter((x) => (x.parent ?? null) === (task.parent ?? null))
    .sort((a, b) => a.order - b.order || taskNumber(a.id) - taskNumber(b.id));
  const siblingIndex = siblings.findIndex((x) => x.id === task.id);
  const prevSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined;
  const nextSibling =
    siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : undefined;

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

  function startEditingDescription() {
    setDescDraft(task!.description);
    setSummaryDraft("");
    setEditingDesc(true);
  }

  async function saveDescription() {
    await setDescription(task!.id, descDraft, summaryDraft.trim());
    setSummaryDraft("");
    setEditingDesc(false);
  }

  function deleteSubtask(sub: { id: string; title: string }) {
    if (!confirm(t.confirmDeleteSubtask(sub.title))) return;
    deleteTask(sub.id);
  }

  function deleteCurrentTask() {
    if (!confirm(t.confirmDeleteTask(task!.title, Boolean(task!.parent), task!.subtasks.length))) return;
    deleteTask(task!.id);
  }

  const statusSelect = (
    <select
      value={task.status}
      onChange={(e) => setStatus(task.id, e.target.value)}
      className="w-full rounded-md border border-neutral-200 bg-transparent px-2 py-1.5 text-[13px] outline-none focus:border-accent dark:border-neutral-700 dark:bg-transparent"
    >
      {project.statuses.map((s) => (
        <option key={s.id} value={s.id}>
          {statusLabel(t, s)}
        </option>
      ))}
    </select>
  );

  const prioritySelect = (
    <select
      value={task.priority}
      onChange={(e) => togglePriority(e.target.value as Priority)}
      className="w-full rounded-md border border-neutral-200 bg-transparent px-2 py-1.5 text-[13px] outline-none focus:border-accent dark:border-neutral-700 dark:bg-transparent"
    >
      {Object.entries(labels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );

  // Rail control: a switch under the section label — no text duplication, one line.
  const flagSwitch = (
    <button
      onClick={() => setBlocked(task.id, !task.blocked)}
      title={task.blocked ? t.unmarkNeedsInputTooltip : t.markNeedsInputTooltip}
      className="group flex items-center gap-2"
    >
      <span
        className={`relative inline-block h-[18px] w-[32px] shrink-0 rounded-full transition-colors ${
          task.blocked
            ? "bg-red-500"
            : "bg-neutral-200 group-hover:bg-neutral-300 dark:bg-neutral-700 dark:group-hover:bg-neutral-600"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-all ${
            task.blocked ? "left-[16px]" : "left-[2px]"
          }`}
        />
      </span>
      {task.blocked && <span className="text-[12px]">🚩</span>}
    </button>
  );

  // Compact pill for the small-screen properties row, where there's no section label.
  const flagPill = (
    <button
      onClick={() => setBlocked(task.id, !task.blocked)}
      title={task.blocked ? t.unmarkNeedsInputTooltip : t.markNeedsInputTooltip}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12.5px] font-medium transition-colors ${
        task.blocked
          ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
          : "border-neutral-200 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:border-neutral-700 dark:hover:bg-neutral-800"
      }`}
    >
      <span>🚩</span>
      <span>{t.needsInputFlag}</span>
    </button>
  );

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header: breadcrumb trail + sibling navigation + actions */}
      <header className="flex items-center justify-between gap-3 border-b border-neutral-150 px-5 py-2.5 dark:border-neutral-800">
        <nav className="flex min-w-0 items-center gap-1.5 text-[12px] text-neutral-400">
          <button
            onClick={closeTask}
            title={t.backToBoardTooltip}
            className="max-w-[200px] shrink-0 truncate rounded px-1 py-0.5 font-medium hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            {project.name}
          </button>
          {chain.map((p) => (
            <Fragment key={p.id}>
              <span className="shrink-0 text-neutral-300 dark:text-neutral-700">/</span>
              <button
                onClick={() => openTask(p.id)}
                title={p.title}
                className="shrink-0 rounded px-1 py-0.5 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                {p.id}
              </button>
            </Fragment>
          ))}
          <span className="shrink-0 text-neutral-300 dark:text-neutral-700">/</span>
          <span className="shrink-0 font-medium text-neutral-600 dark:text-neutral-200">{task.id}</span>
          {task.parent && (
            <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {t.subtaskBadge}
            </span>
          )}
          {task.blocked && (
            <span title={t.needsInputFlag} className="shrink-0 text-[11px]">
              🚩
            </span>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {siblings.length > 1 && (
            <div className="mr-2 flex items-center gap-1 text-[11px] text-neutral-400">
              <button
                onClick={() => prevSibling && openTask(prevSibling.id)}
                disabled={!prevSibling}
                title={t.prevTaskTooltip}
                className="rounded px-1.5 py-0.5 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
              >
                ‹
              </button>
              <span className="tabular-nums">
                {siblingIndex + 1}/{siblings.length}
              </span>
              <button
                onClick={() => nextSibling && openTask(nextSibling.id)}
                disabled={!nextSibling}
                title={t.nextTaskTooltip}
                className="rounded px-1.5 py-0.5 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
              >
                ›
              </button>
            </div>
          )}
          <button
            onClick={deleteCurrentTask}
            title={t.deleteTaskTooltip}
            className="rounded px-1.5 py-0.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            🗑
          </button>
          <button
            onClick={closeTask}
            title={t.backToBoardTooltip}
            className="rounded px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
            <div className="mx-auto w-full max-w-[780px]">
              <h1 className="mb-2 text-[24px] font-semibold leading-tight tracking-[-0.01em]">{task.title}</h1>

              {latestUpdate && (
                <button
                  onClick={() => setTab("updates")}
                  className="mb-5 text-[11.5px] text-neutral-400 hover:text-accent hover:underline"
                >
                  {t.updatedAgo(
                    formatRelative(latestUpdate.timestamp, t),
                    latestUpdate.author === "agent" ? t.roleAgent : t.roleHuman,
                    task.version
                  )}
                </button>
              )}

              {/* Compact properties for small screens; the rail covers wide ones */}
              <div className="mb-4 flex flex-wrap items-center gap-2 lg:hidden">
                <div className="w-[150px]">{statusSelect}</div>
                <div className="w-[130px]">{prioritySelect}</div>
                <div className="w-auto">{flagPill}</div>
              </div>

              <div className="mb-6 flex gap-4 border-b border-neutral-150 dark:border-neutral-800">
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
                {tab === "overview" && !editingDesc && task.description.trim() !== "" && (
                  <button
                    onClick={startEditingDescription}
                    className="ml-auto self-start rounded px-1.5 pb-1.5 text-[12px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    {t.editButton}
                  </button>
                )}
              </div>

              {tab === "overview" && (
                <>
                  <section className="mb-9">
                    {!editingDesc ? (
                      task.description.trim() ? (
                        <Markdown text={task.description} />
                      ) : (
                        <button
                          onClick={startEditingDescription}
                          className="w-full rounded-lg border border-dashed border-neutral-200 px-3.5 py-3 text-left text-[13.5px] text-neutral-400 hover:border-neutral-300 hover:text-neutral-500 dark:border-neutral-800 dark:hover:border-neutral-700"
                        >
                          {t.addDescriptionButton}
                        </button>
                      )
                    ) : (
                      <>
                        <textarea
                          value={descDraft}
                          onChange={(e) => setDescDraft(e.target.value)}
                          rows={14}
                          autoFocus
                          placeholder={t.descriptionPlaceholder}
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
                              onClick={saveDescription}
                              className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent-hover"
                            >
                              {t.saveAsUpdateButton}
                            </button>
                            <button
                              onClick={() => {
                                setEditingDesc(false);
                                setSummaryDraft("");
                              }}
                              className="rounded-md px-2.5 py-1 text-[12px] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              {t.cancelButton}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </section>

                  <section className="mb-8">
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
                                {statusLabel(t, s)}
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
                          className="rounded-md bg-neutral-50 px-3 py-2 text-[13px] dark:bg-neutral-800/60"
                        >
                          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-neutral-400">
                            <span className="font-medium text-neutral-500 dark:text-neutral-300">
                              {c.author === "agent" ? cap(t.roleAgent) : c.author === "human" ? t.roleYou : c.author}
                            </span>
                            <span>{formatTime(c.timestamp, locale)}</span>
                          </div>
                          <Markdown text={c.text} className="text-[13px]" />
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
                        const isMinor = MINOR_EDIT_SUMMARIES.has(u.summary.trim());
                        return (
                          <div
                            key={u.version}
                            className={`rounded-md border ${
                              isMinor
                                ? "border-dashed border-neutral-150 dark:border-neutral-800/70"
                                : "border-neutral-150 dark:border-neutral-800"
                            }`}
                          >
                            <button
                              onClick={() => toggleVersion(u.version)}
                              className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                            >
                              <span className="mt-0.5 shrink-0 text-[10px] text-neutral-400">
                                {expanded ? "▾" : "▸"}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
                                  <span
                                    className={`rounded px-1.5 py-0.5 font-medium ${
                                      isMinor
                                        ? "bg-transparent text-neutral-400"
                                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300"
                                    }`}
                                  >
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
                                {isMinor ? (
                                  <div className="mt-0.5 text-[12.5px] italic text-neutral-400">
                                    {t.minorEditLabel}
                                  </div>
                                ) : (
                                  <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-neutral-800 dark:text-neutral-200">
                                    {u.summary}
                                  </div>
                                )}
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
                if (commentBoxRef.current) commentBoxRef.current.style.height = "auto";
              }}
              className="border-t border-neutral-150 px-6 py-3 md:px-10 dark:border-neutral-800"
            >
              <div className="mx-auto flex w-full max-w-[780px] items-end gap-2">
                <textarea
                  ref={commentBoxRef}
                  value={commentDraft}
                  rows={1}
                  onChange={(e) => {
                    setCommentDraft(e.target.value);
                    // Auto-grow up to ~8 lines, then scroll inside the box.
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 168)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={t.commentInputPlaceholder}
                  className="flex-1 resize-none rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[13px] leading-relaxed outline-none focus:border-accent dark:border-neutral-700"
                />
                <button
                  type="submit"
                  disabled={!commentDraft.trim()}
                  className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  {t.sendButton}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Properties rail */}
        <aside className="hidden w-[248px] shrink-0 overflow-y-auto border-l border-neutral-150 px-5 py-6 lg:block dark:border-neutral-800">
          <PropRow label={t.propStatus}>{statusSelect}</PropRow>
          <PropRow label={t.propPriority}>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT_CLASSES[task.priority]}`} />
              {prioritySelect}
            </div>
          </PropRow>
          <PropRow label={t.needsInputFlag}>{flagSwitch}</PropRow>
          <PropRow label={t.propAssignee}>
            <span className="text-[13px]">{cap(task.assignee === "agent" ? t.roleAgent : t.roleHuman)}</span>
          </PropRow>
          {task.labels.length > 0 && (
            <PropRow label={t.propLabels}>
              <div className="flex flex-wrap gap-1">
                {task.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </PropRow>
          )}
          <PropRow label={t.propCreated}>
            <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
              {formatDate(task.created, locale)}
            </span>
          </PropRow>
          <PropRow label={t.propUpdated}>
            <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
              {formatTime(task.updated, locale)}
            </span>
          </PropRow>
        </aside>
      </div>
    </div>
  );
}
