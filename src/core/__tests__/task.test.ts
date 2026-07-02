import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject } from "../project.js";
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
} from "../task.js";

let vaultRoot: string;

beforeEach(() => {
  vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentboard-test-"));
});

afterEach(() => {
  fs.rmSync(vaultRoot, { recursive: true, force: true });
});

describe("task lifecycle round-trip", () => {
  it("creates a task with id derived from project key and version 1", () => {
    const project = createProject(vaultRoot, "Website Redesign", { key: "WEB" });
    const task = createTask(vaultRoot, project.slug, { title: "Implement login form" });

    expect(task.id).toBe("WEB-1");
    expect(task.version).toBe(1);
    expect(task.updates).toHaveLength(1);
    expect(task.status).toBe(project.statuses[0].id);

    const reloaded = readTask(vaultRoot, project.slug, task.id);
    expect(reloaded.title).toBe("Implement login form");
  });

  it("logs status changes to activity WITHOUT bumping version (routine bookkeeping, not a substance update)", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const task = createTask(vaultRoot, project.slug, { title: "Do a thing" });

    const updated = updateStatus(vaultRoot, project.slug, task.id, "in_progress");
    expect(updated.version).toBe(1);
    expect(updated.updates).toHaveLength(1);
    expect(updated.status).toBe("in_progress");
    expect(updated.activity).toHaveLength(1);
    expect(updated.activity[0].note).toContain(project.statuses[0].id);
    expect(updated.activity[0].note).toContain("in_progress");
  });

  it("logs field patches to activity without bumping version", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const task = createTask(vaultRoot, project.slug, { title: "Do a thing" });

    const updated = updateFields(vaultRoot, project.slug, task.id, { priority: "high" });
    expect(updated.version).toBe(1);
    expect(updated.priority).toBe("high");
    expect(updated.activity.some((a) => a.note.includes("priority"))).toBe(true);
  });

  it("records a versioned checkpoint with summary and a full description snapshot on updateDescription", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const task = createTask(vaultRoot, project.slug, {
      title: "Do a thing",
      description: "old text",
    });

    const updated = updateDescription(
      vaultRoot,
      project.slug,
      task.id,
      "new text",
      "Переписал подход на X, т.к. старый не масштабировался."
    );
    expect(updated.description).toBe("new text");
    expect(updated.version).toBe(2);
    expect(updated.updates).toHaveLength(2);
    const [latest, initial] = updated.updates;
    expect(latest.summary).toContain("Переписал подход");
    expect(latest.description).toBe("new text");
    expect(initial.description).toBe("old text");
  });

  it("round-trips comments with author and text", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const task = createTask(vaultRoot, project.slug, { title: "Do a thing" });

    const updated = addComment(vaultRoot, project.slug, task.id, "Please clarify X", "human");
    expect(updated.comments).toHaveLength(1);
    expect(updated.comments[0]).toMatchObject({ author: "human", text: "Please clarify X" });
  });

  it("computes subtasks from children referencing parent, kept in sync via file writes", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const parent = createTask(vaultRoot, project.slug, { title: "Parent task" });
    const child = createSubtask(vaultRoot, project.slug, parent.id, { title: "Child task" });

    const reloadedParent = readTask(vaultRoot, project.slug, parent.id);
    expect(reloadedParent.subtasks).toEqual([
      { id: child.id, title: "Child task", status: project.statuses[0].id, done: false },
    ]);

    updateStatus(vaultRoot, project.slug, child.id, "done");
    const afterDone = readTask(vaultRoot, project.slug, parent.id);
    expect(afterDone.subtasks[0].done).toBe(true);
    expect(afterDone.subtasks[0].status).toBe("done");
  });

  it("recommends the next unblocked task ordered by `order`, skipping blocked ones", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const t1 = createTask(vaultRoot, project.slug, { title: "First", order: 10 });
    const t2 = createTask(vaultRoot, project.slug, {
      title: "Second, blocked",
      order: 5,
      blockedBy: [t1.id],
    });

    // t2 has lower order but is blocked by t1 (not done yet) -> t1 should be recommended.
    expect(getNextTask(vaultRoot, project.slug)?.id).toBe(t1.id);

    updateStatus(vaultRoot, project.slug, t1.id, "done");
    expect(getNextTask(vaultRoot, project.slug)?.id).toBe(t2.id);
  });

  it("flags a task as needing input independently of status, logs to activity without bumping version", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const task = createTask(vaultRoot, project.slug, { title: "Do a thing" });
    updateStatus(vaultRoot, project.slug, task.id, "in_progress");

    const flagged = setBlocked(vaultRoot, project.slug, task.id, true);
    expect(flagged.blocked).toBe(true);
    expect(flagged.status).toBe("in_progress"); // unchanged — blocked is independent of status
    expect(flagged.version).toBe(1); // routine bookkeeping, not a substance update
    expect(flagged.activity.some((a) => a.note.includes("нужен человек"))).toBe(true);

    const unflagged = setBlocked(vaultRoot, project.slug, task.id, false);
    expect(unflagged.blocked).toBe(false);
  });

  it("excludes a blocked task from getNextTask so an agent doesn't keep proposing it", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const t1 = createTask(vaultRoot, project.slug, { title: "First", order: 10 });
    createTask(vaultRoot, project.slug, { title: "Second", order: 20 });

    expect(getNextTask(vaultRoot, project.slug)?.id).toBe(t1.id);

    setBlocked(vaultRoot, project.slug, t1.id, true);
    expect(getNextTask(vaultRoot, project.slug)?.id).not.toBe(t1.id);

    setBlocked(vaultRoot, project.slug, t1.id, false);
    expect(getNextTask(vaultRoot, project.slug)?.id).toBe(t1.id);
  });

  it("deletes a task and syncs the former parent's subtask list", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const parent = createTask(vaultRoot, project.slug, { title: "Parent" });
    const child = createSubtask(vaultRoot, project.slug, parent.id, { title: "Child" });

    deleteTask(vaultRoot, project.slug, child.id);

    expect(() => readTask(vaultRoot, project.slug, child.id)).toThrow();
    const reloadedParent = readTask(vaultRoot, project.slug, parent.id);
    expect(reloadedParent.subtasks).toHaveLength(0);
  });

  it("cascades delete to all descendants (subtask acts as a checklist group)", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const parent = createTask(vaultRoot, project.slug, { title: "Parent" });
    const child = createSubtask(vaultRoot, project.slug, parent.id, { title: "Child" });
    const grandchild = createSubtask(vaultRoot, project.slug, child.id, { title: "Grandchild" });

    deleteTask(vaultRoot, project.slug, child.id);

    expect(() => readTask(vaultRoot, project.slug, child.id)).toThrow();
    expect(() => readTask(vaultRoot, project.slug, grandchild.id)).toThrow();
    const summaries = listTasks(vaultRoot, project.slug);
    expect(summaries.map((s) => s.id)).toEqual([parent.id]);
  });

  it("treats a deleted blocker as resolved instead of blocking forever", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const t1 = createTask(vaultRoot, project.slug, { title: "Blocker", order: 10 });
    const t2 = createTask(vaultRoot, project.slug, {
      title: "Blocked",
      order: 20,
      blockedBy: [t1.id],
    });

    deleteTask(vaultRoot, project.slug, t1.id);

    expect(getNextTask(vaultRoot, project.slug)?.id).toBe(t2.id);
  });

  it("listTasks reports subtask progress counts", () => {
    const project = createProject(vaultRoot, "Web", { key: "WEB" });
    const parent = createTask(vaultRoot, project.slug, { title: "Parent" });
    const c1 = createSubtask(vaultRoot, project.slug, parent.id, { title: "C1" });
    createSubtask(vaultRoot, project.slug, parent.id, { title: "C2" });
    updateStatus(vaultRoot, project.slug, c1.id, "done");

    const summaries = listTasks(vaultRoot, project.slug);
    const parentSummary = summaries.find((s) => s.id === parent.id)!;
    expect(parentSummary.subtaskProgress).toEqual({ done: 1, total: 2 });
  });
});
