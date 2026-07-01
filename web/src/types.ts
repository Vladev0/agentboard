export type Priority = "low" | "medium" | "high" | "urgent";
export type Assignee = "agent" | "human";
export type Locale = "en" | "es" | "ru";

export interface StatusDef {
  id: string;
  name: string;
  color: string;
  blocksOnHuman?: boolean;
}

export interface Project {
  slug: string;
  name: string;
  key: string;
  statuses: StatusDef[];
  labels: string[];
  created: string;
  taskCount: number;
  counts: Record<string, number>;
}

export interface UpdateEntry {
  version: number;
  timestamp: string;
  author: string;
  summary: string;
  description: string;
}

export interface CommentEntry {
  timestamp: string;
  author: string;
  text: string;
}

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

export interface Task extends TaskSummary {
  created: string;
  version: number;
  blockedBy: string[];
  description: string;
  updates: UpdateEntry[];
  comments: CommentEntry[];
  activity: ActivityEntry[];
  subtasks: SubtaskRef[];
}

export interface VaultChangeEvent {
  type: "change";
  slug: string;
  reason: "project" | "task";
}
