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
  subtaskProgress: { done: number; total: number };
}
