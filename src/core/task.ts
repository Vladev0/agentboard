import fs from "node:fs";
import { parseTaskFile, serializeTaskFile } from "./markdown.js";
import { readProject } from "./project.js";
import type {
  ActivityEntry,
  Assignee,
  CommentEntry,
  Priority,
  ProjectConfig,
  SubtaskRef,
  Task,
  TaskFrontmatter,
  TaskSummary,
  UpdateEntry,
} from "./types.js";
import {
  atomicWriteFileSync,
  listTaskFiles,
  nextTaskNumber,
  taskFile,
  tasksDir,
  withFileLock,
} from "./vault.js";

interface RawTask {
  frontmatter: TaskFrontmatter;
  description: string;
  updates: UpdateEntry[];
  comments: CommentEntry[];
  activity: ActivityEntry[];
}

function readRaw(vaultRoot: string, slug: string, id: string): RawTask {
  const raw = fs.readFileSync(taskFile(vaultRoot, slug, id), "utf8");
  return parseTaskFile(raw);
}

function computeSubtasks(vaultRoot: string, slug: string, parentId: string): SubtaskRef[] {
  const project = readProject(vaultRoot, slug);
  const terminal = project.statuses[project.statuses.length - 1]?.id;
  return listTaskFiles(vaultRoot, slug)
    .map((f) => parseTaskFile(fs.readFileSync(f, "utf8")).frontmatter)
    .filter((fm) => fm.parent === parentId)
    .sort((a, b) => a.order - b.order)
    .map((fm) => ({ id: fm.id, title: fm.title, status: fm.status, done: fm.status === terminal }));
}

function write(vaultRoot: string, slug: string, raw: RawTask): void {
  const subtasks = computeSubtasks(vaultRoot, slug, raw.frontmatter.id);
  const out = serializeTaskFile(
    raw.frontmatter,
    raw.description,
    raw.updates,
    raw.comments,
    raw.activity,
    subtasks
  );
  atomicWriteFileSync(taskFile(vaultRoot, slug, raw.frontmatter.id), out);
}

/**
 * The `## Subtasks` section in a task file is a denormalized view of its children
 * (source of truth is each child's `parent` field). Whenever a child is created or
 * its status/title changes, the parent file must be rewritten so a human opening it
 * directly — without the UI — sees an up-to-date list, not a stale one.
 */
function syncParentSubtasksSection(vaultRoot: string, slug: string, parentId: string | null): void {
  if (!parentId) return;
  try {
    withFileLock(taskFile(vaultRoot, slug, parentId), () => {
      write(vaultRoot, slug, readRaw(vaultRoot, slug, parentId));
    });
  } catch {
    // Parent file missing (e.g. removed externally) — nothing to sync.
  }
}

/**
 * Runs a read-modify-write cycle on a task file under a cross-process lock, so the
 * REST server and a separately-running MCP server can never interleave writes to the
 * same file (see withFileLock). Every mutating operation below goes through this.
 */
function mutateTask(vaultRoot: string, slug: string, id: string, mutate: (raw: RawTask) => void): RawTask {
  return withFileLock(taskFile(vaultRoot, slug, id), () => {
    const raw = readRaw(vaultRoot, slug, id);
    mutate(raw);
    write(vaultRoot, slug, raw);
    return raw;
  });
}

export function readTask(vaultRoot: string, slug: string, id: string): Task {
  const raw = readRaw(vaultRoot, slug, id);
  const subtasks = computeSubtasks(vaultRoot, slug, id);
  return { ...raw.frontmatter, description: raw.description, updates: raw.updates, comments: raw.comments, activity: raw.activity, subtasks };
}

export function listTasks(vaultRoot: string, slug: string): TaskSummary[] {
  const project = readProject(vaultRoot, slug);
  const terminal = project.statuses[project.statuses.length - 1]?.id;
  const files = listTaskFiles(vaultRoot, slug);
  const all = files.map((f) => parseTaskFile(fs.readFileSync(f, "utf8")).frontmatter);
  return all.map((fm) => {
    const children = all.filter((t) => t.parent === fm.id);
    const done = children.filter((t) => t.status === terminal).length;
    return {
      id: fm.id,
      title: fm.title,
      status: fm.status,
      priority: fm.priority,
      assignee: fm.assignee,
      parent: fm.parent,
      order: fm.order,
      labels: fm.labels,
      updated: fm.updated,
      blocked: fm.blocked,
      subtaskProgress: { done, total: children.length },
    };
  });
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  parent?: string | null;
  priority?: Priority;
  assignee?: Assignee;
  labels?: string[];
  order?: number;
  blockedBy?: string[];
  author?: string;
}

export function createTask(vaultRoot: string, slug: string, input: CreateTaskInput): Task {
  // Locked at the project's tasks-directory level (not a specific file, which doesn't exist
  // yet) so two concurrent creates in the same project can't allocate the same next id.
  const id = withFileLock(tasksDir(vaultRoot, slug), () => {
    const project = readProject(vaultRoot, slug);
    const n = nextTaskNumber(vaultRoot, slug, project.key);
    const newId = `${project.key}-${n}`;
    const now = new Date().toISOString();
    const description = input.description ?? "";

    const frontmatter: TaskFrontmatter = {
      id: newId,
      title: input.title,
      status: project.statuses[0]?.id ?? "todo",
      priority: input.priority ?? "medium",
      assignee: input.assignee ?? "agent",
      parent: input.parent ?? null,
      order: input.order ?? n * 10,
      blockedBy: input.blockedBy ?? [],
      labels: input.labels ?? [],
      created: now,
      updated: now,
      version: 1,
      blocked: false,
    };

    const updates: UpdateEntry[] = [
      { version: 1, timestamp: now, author: input.author ?? "agent", summary: "Task created.", description },
    ];

    write(vaultRoot, slug, { frontmatter, description, updates, comments: [], activity: [] });
    return newId;
  });

  syncParentSubtasksSection(vaultRoot, slug, input.parent ?? null);
  return readTask(vaultRoot, slug, id);
}

/** Routine bookkeeping (status/field changes): logged to `activity`, does NOT bump `version`. */
function logActivity(
  vaultRoot: string,
  slug: string,
  id: string,
  mutate: (fm: TaskFrontmatter) => void,
  note: string,
  author: string
): Task {
  const raw = mutateTask(vaultRoot, slug, id, (raw) => {
    mutate(raw.frontmatter);
    raw.frontmatter.updated = new Date().toISOString();
    raw.activity.push({ timestamp: raw.frontmatter.updated, author, note });
  });
  syncParentSubtasksSection(vaultRoot, slug, raw.frontmatter.parent);
  return readTask(vaultRoot, slug, id);
}

export function updateStatus(
  vaultRoot: string,
  slug: string,
  id: string,
  status: string,
  author = "agent"
): Task {
  const before = readRaw(vaultRoot, slug, id).frontmatter.status;
  if (before === status) return readTask(vaultRoot, slug, id);
  return logActivity(
    vaultRoot,
    slug,
    id,
    (fm) => {
      fm.status = status;
    },
    `Status changed: ${before} → ${status}`,
    author
  );
}

/**
 * Flags (or unflags) a task as waiting on a human decision — independent of `status`,
 * since work can stall at any stage of the pipeline, not just in a dedicated column.
 * A blocked task is excluded from `getNextTask` so an agent doesn't keep proposing it.
 */
export function setBlocked(
  vaultRoot: string,
  slug: string,
  id: string,
  blocked: boolean,
  author = "agent"
): Task {
  const before = readRaw(vaultRoot, slug, id).frontmatter.blocked;
  if (before === blocked) return readTask(vaultRoot, slug, id);
  return logActivity(
    vaultRoot,
    slug,
    id,
    (fm) => {
      fm.blocked = blocked;
    },
    blocked ? "Flagged: needs human input" : "Needs-input flag cleared",
    author
  );
}

/**
 * Standard summary recorded when a description is saved without an explanation
 * (e.g. a human fixing a couple of words in the UI). Keeps the version history
 * complete while letting clients visually de-emphasize these versions against
 * deliberate, explained updates.
 */
export const MINOR_EDIT_SUMMARY = "Minor edit.";

/**
 * The "big update": a deliberate checkpoint where the task's substance (its description)
 * was rewritten after some work or discussion, with a short rationale. This is what
 * shows up prominently in the UI — distinct from casual comments and from routine
 * status/field bookkeeping (see `activity`).
 */
export function updateDescription(
  vaultRoot: string,
  slug: string,
  id: string,
  newDescription: string,
  summary: string,
  author = "agent"
): Task {
  mutateTask(vaultRoot, slug, id, (raw) => {
    raw.frontmatter.version += 1;
    raw.frontmatter.updated = new Date().toISOString();
    raw.updates.push({
      version: raw.frontmatter.version,
      timestamp: raw.frontmatter.updated,
      author,
      summary: summary.trim() || MINOR_EDIT_SUMMARY,
      description: newDescription,
    });
    raw.description = newDescription;
  });
  return readTask(vaultRoot, slug, id);
}

export function updateFields(
  vaultRoot: string,
  slug: string,
  id: string,
  patch: Partial<Pick<TaskFrontmatter, "title" | "priority" | "labels" | "order" | "blockedBy" | "assignee">>,
  author = "human"
): Task {
  return logActivity(
    vaultRoot,
    slug,
    id,
    (fm) => Object.assign(fm, patch),
    `Fields updated: ${Object.keys(patch).join(", ")}`,
    author
  );
}

export function addComment(
  vaultRoot: string,
  slug: string,
  id: string,
  text: string,
  author: string
): Task {
  mutateTask(vaultRoot, slug, id, (raw) => {
    raw.frontmatter.updated = new Date().toISOString();
    raw.comments.push({ timestamp: raw.frontmatter.updated, author, text });
  });
  return readTask(vaultRoot, slug, id);
}

export function createSubtask(
  vaultRoot: string,
  slug: string,
  parentId: string,
  input: Omit<CreateTaskInput, "parent">
): Task {
  return createTask(vaultRoot, slug, { ...input, parent: parentId });
}

/**
 * Deletes a task and, cascading, all of its subtasks (a subtask acts as a
 * checklist-item substitute — removing the group should remove what's under it,
 * not leave orphans floating around). Resyncs the former parent's subtask list.
 */
export function deleteTask(vaultRoot: string, slug: string, id: string): void {
  const parentId = withFileLock(taskFile(vaultRoot, slug, id), () => {
    const raw = readRaw(vaultRoot, slug, id);

    const children = listTaskFiles(vaultRoot, slug)
      .map((f) => parseTaskFile(fs.readFileSync(f, "utf8")).frontmatter)
      .filter((fm) => fm.parent === id);
    for (const child of children) {
      deleteTask(vaultRoot, slug, child.id);
    }

    fs.unlinkSync(taskFile(vaultRoot, slug, id));
    return raw.frontmatter.parent;
  });

  syncParentSubtasksSection(vaultRoot, slug, parentId);
}

/**
 * Recommends the next actionable task so an agent doesn't have to scan the whole project:
 * unblocked, not in the terminal status, lowest `order` first, ties broken by priority.
 *
 * When `parent` is null (the default — "what should I work on next?"), the search spans the
 * WHOLE project at every depth. This matters: if the only top-level tasks are done or blocked
 * but open subtasks remain, a top-level-only search would return null and an agent following
 * the loop protocol would wrongly conclude the project is finished. Passing an explicit
 * `parent` id instead scopes the search to that task's direct children, for deliberate
 * level-by-level tree navigation.
 */
export function getNextTask(
  vaultRoot: string,
  slug: string,
  parent: string | null = null
): TaskSummary | null {
  const project: ProjectConfig = readProject(vaultRoot, slug);
  const terminal = project.statuses[project.statuses.length - 1]?.id;
  const files = listTaskFiles(vaultRoot, slug);
  const all = files.map((f) => parseTaskFile(fs.readFileSync(f, "utf8")).frontmatter);
  const byId = new Map(all.map((t) => [t.id, t]));
  const priorityRank: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  const candidates = all.filter((fm) => {
    // Explicit parent → that level only; null → every level (don't hide nested-only work).
    if (parent !== null && fm.parent !== parent) return false;
    if (fm.status === terminal) return false;
    if (fm.blocked) return false; // Waiting on a human — don't keep proposing it.
    const blockedByOther = fm.blockedBy.some((bId) => {
      const blocker = byId.get(bId);
      // A blocker that no longer exists (e.g. deleted) can't be blocking anything.
      return blocker !== undefined && blocker.status !== terminal;
    });
    return !blockedByOther;
  });

  candidates.sort((a, b) => a.order - b.order || priorityRank[a.priority] - priorityRank[b.priority]);
  if (!candidates.length) return null;

  const summaries = listTasks(vaultRoot, slug);
  return summaries.find((s) => s.id === candidates[0].id) ?? null;
}
