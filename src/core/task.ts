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
    write(vaultRoot, slug, readRaw(vaultRoot, slug, parentId));
  } catch {
    // Parent file missing (e.g. removed externally) — nothing to sync.
  }
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
  const project = readProject(vaultRoot, slug);
  const n = nextTaskNumber(vaultRoot, slug, project.key);
  const id = `${project.key}-${n}`;
  const now = new Date().toISOString();
  const description = input.description ?? "";

  const frontmatter: TaskFrontmatter = {
    id,
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
  };

  const updates: UpdateEntry[] = [
    { version: 1, timestamp: now, author: input.author ?? "agent", summary: "Задача создана.", description },
  ];

  write(vaultRoot, slug, { frontmatter, description, updates, comments: [], activity: [] });
  syncParentSubtasksSection(vaultRoot, slug, frontmatter.parent);
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
  const raw = readRaw(vaultRoot, slug, id);
  mutate(raw.frontmatter);
  raw.frontmatter.updated = new Date().toISOString();
  raw.activity.push({ timestamp: raw.frontmatter.updated, author, note });
  write(vaultRoot, slug, raw);
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
    `Статус изменён: ${before} → ${status}`,
    author
  );
}

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
  const raw = readRaw(vaultRoot, slug, id);
  raw.frontmatter.version += 1;
  raw.frontmatter.updated = new Date().toISOString();
  raw.updates.push({
    version: raw.frontmatter.version,
    timestamp: raw.frontmatter.updated,
    author,
    summary: summary || "Описание обновлено.",
    description: newDescription,
  });
  raw.description = newDescription;
  write(vaultRoot, slug, raw);
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
    `Поля обновлены: ${Object.keys(patch).join(", ")}`,
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
  const raw = readRaw(vaultRoot, slug, id);
  raw.frontmatter.updated = new Date().toISOString();
  raw.comments.push({ timestamp: raw.frontmatter.updated, author, text });
  write(vaultRoot, slug, raw);
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
 * Recommends the next actionable task so an agent doesn't have to scan the whole project:
 * unblocked, not in the terminal status, lowest `order` first, ties broken by priority.
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
    if (fm.parent !== parent) return false;
    if (fm.status === terminal) return false;
    const blocked = fm.blockedBy.some((bId) => byId.get(bId)?.status !== terminal);
    return !blocked;
  });

  candidates.sort((a, b) => a.order - b.order || priorityRank[a.priority] - priorityRank[b.priority]);
  if (!candidates.length) return null;

  const summaries = listTasks(vaultRoot, slug);
  return summaries.find((s) => s.id === candidates[0].id) ?? null;
}
