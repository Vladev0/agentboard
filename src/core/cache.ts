import { listProjects, projectExists, readProject } from "./project.js";
import { listTasks } from "./task.js";
import type { ProjectConfig, TaskSummary } from "./types.js";
import { listProjectSlugs } from "./vault.js";

/**
 * In-memory derived index over the vault, used for fast reads by the server.
 * The markdown files are always the source of truth; this cache is rebuilt
 * on startup and patched incrementally by the file watcher.
 */
export class VaultCache {
  private projects = new Map<string, ProjectConfig>();
  private tasks = new Map<string, Map<string, TaskSummary>>();

  constructor(private vaultRoot: string) {}

  buildAll(): void {
    this.projects.clear();
    this.tasks.clear();
    for (const project of listProjects(this.vaultRoot)) {
      this.projects.set(project.slug, project);
      this.refreshProjectTasks(project.slug);
    }
  }

  refreshProjectTasks(slug: string): void {
    const summaries = listTasks(this.vaultRoot, slug);
    const map = new Map(summaries.map((t) => [t.id, t]));
    this.tasks.set(slug, map);
  }

  refreshProject(slug: string): void {
    if (!projectExists(this.vaultRoot, slug)) {
      this.projects.delete(slug);
      this.tasks.delete(slug);
      return;
    }
    this.projects.set(slug, readProject(this.vaultRoot, slug));
    this.refreshProjectTasks(slug);
  }

  removeProject(slug: string): void {
    this.projects.delete(slug);
    this.tasks.delete(slug);
  }

  getProjects(): ProjectConfig[] {
    return [...this.projects.values()];
  }

  getProject(slug: string): ProjectConfig | undefined {
    return this.projects.get(slug);
  }

  getTasks(slug: string): TaskSummary[] {
    return [...(this.tasks.get(slug)?.values() ?? [])];
  }

  knownSlugs(): string[] {
    return listProjectSlugs(this.vaultRoot);
  }
}
