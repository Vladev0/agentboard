import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getNote, listNotes, upsertNote } from "../core/notes.js";
import { createProject, deleteProject, listProjects } from "../core/project.js";
import {
  addComment,
  createSubtask,
  createTask,
  deleteTask,
  getNextTask,
  listTasks,
  readTask,
  setBlocked,
  updateDescription,
  updateFields,
  updateStatus,
} from "../core/task.js";

const priority = z.enum(["low", "medium", "high", "urgent"]);

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

export function registerTools(server: McpServer, vaultRoot: string): void {
  server.tool(
    "list_projects",
    "List every project in the vault with task counts by status. Does not return the tasks themselves — use list_tasks for that.",
    {},
    async () => {
      const projects = listProjects(vaultRoot).map((p) => {
        const tasks = listTasks(vaultRoot, p.slug);
        const counts: Record<string, number> = {};
        for (const s of p.statuses) counts[s.id] = 0;
        for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
        const blockedCount = tasks.filter((t) => t.blocked).length;
        return { ...p, taskCount: tasks.length, counts, blockedCount };
      });
      return text(projects);
    }
  );

  server.tool(
    "create_project",
    "Create a new project in the vault. `key` is a short prefix for task IDs (e.g. WEB); it's derived from the name if omitted.",
    { name: z.string(), key: z.string().optional() },
    async ({ name, key }) => text(createProject(vaultRoot, name, { key }))
  );

  server.tool(
    "delete_project",
    "Permanently delete a project — all of its tasks and history, unrecoverable. Only on an explicit human request, never on your own guess.",
    { project: z.string() },
    async ({ project }) => {
      deleteProject(vaultRoot, project);
      return text({ deleted: project });
    }
  );

  server.tool(
    "list_tasks",
    "A lightweight list of a project's tasks (no descriptions/history/comments) — saves context. Use get_task for the details of one.",
    { project: z.string() },
    async ({ project }) => text(listTasks(vaultRoot, project))
  );

  server.tool(
    "get_task",
    "The full card for one task: description, versioned updates (the task's evolution), comments, technical activity, and subtasks. Request only when you need the details of a specific task.",
    { project: z.string(), id: z.string() },
    async ({ project, id }) => text(readTask(vaultRoot, project, id))
  );

  server.tool(
    "get_next_task",
    "Recommends the next task to work on: not blocked, not in the terminal status, lowest `order` first (ties broken by priority). With no `parent`, it searches the whole project at every depth — so nested-only work isn't missed; pass a `parent` id to scope the search to that task's direct subtasks. Use this instead of scanning the whole list, so you don't lose the plan or waste context.",
    { project: z.string(), parent: z.string().nullable().optional() },
    async ({ project, parent }) => text(getNextTask(vaultRoot, project, parent ?? null))
  );

  server.tool(
    "create_task",
    "Create a new top-level task in a project.",
    {
      project: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: priority.optional(),
      labels: z.array(z.string()).optional(),
      order: z.number().optional(),
      blockedBy: z.array(z.string()).optional(),
    },
    async ({ project, ...input }) => text(createTask(vaultRoot, project, { ...input, author: "agent" }))
  );

  server.tool(
    "create_subtask",
    "Create a subtask inside an existing task (to break a plan down without holding it all in your own context).",
    {
      project: z.string(),
      parentId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: priority.optional(),
      labels: z.array(z.string()).optional(),
      order: z.number().optional(),
      blockedBy: z.array(z.string()).optional(),
    },
    async ({ project, parentId, ...input }) =>
      text(createSubtask(vaultRoot, project, parentId, { ...input, author: "agent" }))
  );

  server.tool(
    "update_status",
    "Change a task's status. This is routine bookkeeping — it goes into the task's technical activity, not its versioned updates.",
    { project: z.string(), id: z.string(), status: z.string() },
    async ({ project, id, status }) => text(updateStatus(vaultRoot, project, id, status, "agent"))
  );

  server.tool(
    "set_needs_input",
    "Flag (or unflag) a task as waiting on a human decision — independent of status, since work can stall at any stage of the pipeline, not just in a dedicated column. A task flagged this way stops being suggested by get_next_task. Once the human has answered (in a comment), clear it by calling again with blocked=false.",
    { project: z.string(), id: z.string(), blocked: z.boolean() },
    async ({ project, id, blocked }) => text(setBlocked(vaultRoot, project, id, blocked, "agent"))
  );

  server.tool(
    "update_task",
    "Change fields on an existing task (title, priority, labels, order, blockers, assignee) without changing status and without creating an update — this is also routine bookkeeping, logged to technical activity. Pass only the fields you're changing.",
    {
      project: z.string(),
      id: z.string(),
      title: z.string().optional(),
      priority: priority.optional(),
      labels: z.array(z.string()).optional(),
      order: z.number().optional(),
      blockedBy: z.array(z.string()).optional(),
      assignee: z.enum(["agent", "human"]).optional(),
    },
    async ({ project, id, ...patch }) => text(updateFields(vaultRoot, project, id, patch, "agent"))
  );

  server.tool(
    "update_description",
    "Record a 'big update' to a task: rewrite the description once discussion/work has led to a decision about what should change. `summary` is a required short note on WHAT changed and WHY (like a commit message). Each call creates a new version with a full snapshot of the description — this builds the task's substance-evolution history shown in the UI. Don't use it for minor tweaks or discussion — use add_comment for those.",
    { project: z.string(), id: z.string(), description: z.string(), summary: z.string() },
    async ({ project, id, description, summary }) =>
      text(updateDescription(vaultRoot, project, id, description, summary, "agent"))
  );

  server.tool(
    "add_comment",
    "Leave a comment on a task — discussion, a clarifying question for the human, a passing remark while working. To actually change the task's substance (its description) once discussion has led somewhere, use update_description, not this.",
    { project: z.string(), id: z.string(), text: z.string() },
    async ({ project, id, text: body }) => text(addComment(vaultRoot, project, id, body, "agent"))
  );

  server.tool(
    "list_notes",
    "The index of the project's memory: one line per knowledge note (id, title, hook). Read this at the START of every session, before get_next_task — it's tiny, and it tells you what's already been settled so you don't re-derive or contradict it. Then get_note only the entries relevant to your current task.",
    { project: z.string() },
    async ({ project }) => text(listNotes(vaultRoot, project))
  );

  server.tool(
    "get_note",
    "One knowledge note in full: body = the CURRENT truth (latest formulas, chosen approach), history = how it got there (versioned summaries — read these when you need to know why something changed). Notes are addressed by [[id]] wikilinks — when a task description mentions [[some-note]], this is how you follow the link.",
    {
      project: z.string(),
      id: z.string().describe("Note id — the [[wikilink]] target, e.g. 'rating-formula'"),
      include_snapshots: z
        .boolean()
        .optional()
        .describe("Include full body snapshots per version (archaeology); default false — summaries only"),
    },
    async ({ project, id, include_snapshots }) => {
      const note = getNote(vaultRoot, project, id, { touch: true });
      if (!include_snapshots) {
        return text({ ...note, history: note.history.map(({ description, ...h }) => h) });
      }
      return text(note);
    }
  );

  server.tool(
    "upsert_note",
    "Create or update a knowledge note — the project's memory. WHEN: you've just settled something reusable (a final formula, a validated approach, a decision and its why, a costly pitfall) — write it AT THAT MOMENT, don't wait for the task to close. Test: 'will a session that never saw this task need it?' No → don't write. NOT for: work logs, task summaries, anything derivable from code/files, anything already in a note (update that note instead). One note = one idea (if you can't fit the idea in the title, split into linked [[notes]]). When you replace an approach, keep the rejected one as a line 'Rejected: X because Y — revisit if Z'. `summary` is the commit message: what changed and why. Reference the note from the task you're working on by writing [[id]] in its description or a comment.",
    {
      project: z.string(),
      id: z
        .string()
        .describe("Immutable kebab-case id, becomes the [[wikilink]] target, e.g. 'rating-formula'"),
      title: z.string().describe("The one idea of this note, stated as a title"),
      body: z.string().describe("The current truth — a few lines to a few paragraphs of markdown"),
      summary: z.string().describe("What changed and why (like a commit message)"),
      sources: z.array(z.string()).optional().describe("Task ids this knowledge came from, e.g. ['CR-3']"),
    },
    async ({ project, id, title, body, summary, sources }) => {
      const { note, created, sizeWarning } = upsertNote(vaultRoot, project, {
        id,
        title,
        body,
        summary,
        sources,
      });
      return text({ [created ? "created" : "updated"]: note.id, version: note.version, ...(sizeWarning ? { warning: sizeWarning } : {}) });
    }
  );

  server.tool(
    "delete_task",
    "Permanently delete a task (its file and all its history) — e.g. a duplicate, or a subtask that's no longer needed. Cascades to all of its subtasks. Irreversible — not for changing status, use update_status for that.",
    { project: z.string(), id: z.string() },
    async ({ project, id }) => {
      deleteTask(vaultRoot, project, id);
      return text({ deleted: id });
    }
  );
}
