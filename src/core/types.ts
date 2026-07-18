export type Priority = "low" | "medium" | "high" | "urgent";
export type Assignee = "agent" | "human";

export interface StatusDef {
  id: string;
  name: string;
  color: string;
}

export interface ProjectConfig {
  slug: string;
  name: string;
  key: string;
  statuses: StatusDef[];
  labels: string[];
  created: string;
}

/**
 * A deliberate checkpoint in the task's substance: the description was rewritten
 * after some work/discussion, with a short rationale. This is the "big update" —
 * distinct from casual comments and from routine status/field bookkeeping.
 */
export interface UpdateEntry {
  version: number;
  timestamp: string;
  author: string;
  summary: string;
  /** Full snapshot of the description as of this version. */
  description: string;
}

export interface CommentEntry {
  timestamp: string;
  author: string;
  text: string;
}

/** Routine, auto-generated bookkeeping (status/field changes) — not versioned, not prominent. */
export interface ActivityEntry {
  timestamp: string;
  author: string;
  note: string;
}

export interface SubtaskRef {
  id: string;
  title: string;
  status: string;
  done: boolean;
}

export interface TaskFrontmatter {
  id: string;
  title: string;
  status: string;
  priority: Priority;
  assignee: Assignee;
  parent: string | null;
  order: number;
  blockedBy: string[];
  labels: string[];
  created: string;
  updated: string;
  version: number;
  /** Waiting on a human decision to proceed — independent of `status`, since work can get
   *  stuck at any stage of the pipeline, not just in a dedicated column. */
  blocked: boolean;
}

export interface Task extends TaskFrontmatter {
  description: string;
  updates: UpdateEntry[];
  comments: CommentEntry[];
  activity: ActivityEntry[];
  subtasks: SubtaskRef[];
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: Priority;
  assignee: Assignee;
  parent: string | null;
  order: number;
  labels: string[];
  updated: string;
  blocked: boolean;
  subtaskProgress: { done: number; total: number };
}

/**
 * A knowledge note — one node of the project's memory. Lives in `memory/<id>.md`,
 * addressed by `[[id]]` wikilinks from tasks and other notes. The body is the CURRENT
 * truth; history holds versioned snapshots of how it got there (same mechanism as a
 * task's updates). Unlike tasks, notes don't die — they get updated or superseded.
 */
export interface NoteFrontmatter {
  /** Immutable kebab-case slug — the wikilink target and the filename. */
  id: string;
  title: string;
  /** Task ids this knowledge came from (provenance). */
  sources: string[];
  created: string;
  updated: string;
  /** Last time an agent read this note — feeds future relevance/decay ranking. */
  lastUsed: string;
  version: number;
}

export interface Note extends NoteFrontmatter {
  /** Current truth. */
  body: string;
  /** Versioned checkpoints: summary of what/why changed + full body snapshot. */
  history: UpdateEntry[];
}

/** One line of the generated memory index — cheap to list, cheap to read. */
export interface NoteSummary {
  id: string;
  title: string;
  /** First line of the body, as a scannable hook. */
  hook: string;
  sources: string[];
  updated: string;
  version: number;
}
