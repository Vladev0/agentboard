import fs from "node:fs";
import { parseProjectFile, serializeProjectFile } from "./markdown.js";
import type { ProjectConfig, StatusDef } from "./types.js";
import {
  atomicWriteFileSync,
  listProjectSlugs,
  projectDir,
  projectFile,
  slugify,
  tasksDir,
} from "./vault.js";

export const DEFAULT_STATUSES: StatusDef[] = [
  { id: "backlog", name: "Backlog", color: "gray" },
  { id: "todo", name: "Todo", color: "blue" },
  { id: "in_progress", name: "In Progress", color: "yellow" },
  { id: "needs_input", name: "Needs Input", color: "red", blocksOnHuman: true },
  { id: "in_review", name: "In Review", color: "purple" },
  { id: "done", name: "Done", color: "green" },
];

export function readProject(vaultRoot: string, slug: string): ProjectConfig {
  const raw = fs.readFileSync(projectFile(vaultRoot, slug), "utf8");
  return parseProjectFile(raw, slug);
}

export function listProjects(vaultRoot: string): ProjectConfig[] {
  return listProjectSlugs(vaultRoot).map((slug) => readProject(vaultRoot, slug));
}

export function createProject(
  vaultRoot: string,
  name: string,
  opts: { key?: string; slug?: string; statuses?: StatusDef[]; labels?: string[] } = {}
): ProjectConfig {
  const slug = opts.slug ?? slugify(name);
  const key = (opts.key ?? name.slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, "") || "TSK";

  const config: ProjectConfig = {
    slug,
    name,
    key,
    statuses: opts.statuses ?? DEFAULT_STATUSES,
    labels: opts.labels ?? [],
    created: new Date().toISOString(),
  };

  fs.mkdirSync(tasksDir(vaultRoot, slug), { recursive: true });
  atomicWriteFileSync(projectFile(vaultRoot, slug), serializeProjectFile(config));
  return config;
}

export function updateProject(
  vaultRoot: string,
  slug: string,
  patch: Partial<Pick<ProjectConfig, "name" | "statuses" | "labels">>
): ProjectConfig {
  const current = readProject(vaultRoot, slug);
  const next: ProjectConfig = { ...current, ...patch };
  atomicWriteFileSync(projectFile(vaultRoot, slug), serializeProjectFile(next));
  return next;
}

export function projectExists(vaultRoot: string, slug: string): boolean {
  try {
    fs.accessSync(projectFile(vaultRoot, slug));
    return true;
  } catch {
    return false;
  }
}

/** Deletes an entire project — its config and every task file. Irreversible. */
export function deleteProject(vaultRoot: string, slug: string): void {
  fs.rmSync(projectDir(vaultRoot, slug), { recursive: true, force: true });
}

export { projectDir };
