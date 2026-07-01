import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, deleteProject, listProjects, projectExists } from "../project.js";
import { createTask } from "../task.js";

let vaultRoot: string;

beforeEach(() => {
  vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentboard-project-test-"));
});

afterEach(() => {
  fs.rmSync(vaultRoot, { recursive: true, force: true });
});

describe("deleteProject", () => {
  it("removes the project directory entirely, including its tasks", () => {
    const project = createProject(vaultRoot, "Website Redesign", { key: "WEB" });
    createTask(vaultRoot, project.slug, { title: "Do a thing" });
    expect(projectExists(vaultRoot, project.slug)).toBe(true);

    deleteProject(vaultRoot, project.slug);

    expect(projectExists(vaultRoot, project.slug)).toBe(false);
    expect(listProjects(vaultRoot)).toHaveLength(0);
  });

  it("leaves other projects untouched", () => {
    const a = createProject(vaultRoot, "Project A", { key: "A" });
    const b = createProject(vaultRoot, "Project B", { key: "B" });

    deleteProject(vaultRoot, a.slug);

    expect(projectExists(vaultRoot, a.slug)).toBe(false);
    expect(projectExists(vaultRoot, b.slug)).toBe(true);
  });
});
