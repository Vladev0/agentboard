import fs from "node:fs";
import path from "node:path";

export function getVaultRoot(): string {
  return process.env.AGENTBOARD_VAULT
    ? path.resolve(process.env.AGENTBOARD_VAULT)
    : path.resolve(process.cwd(), "vault");
}

export function projectsDir(vaultRoot: string): string {
  return path.join(vaultRoot, "projects");
}

export function projectDir(vaultRoot: string, slug: string): string {
  return path.join(projectsDir(vaultRoot), slug);
}

export function projectFile(vaultRoot: string, slug: string): string {
  return path.join(projectDir(vaultRoot, slug), "project.md");
}

export function tasksDir(vaultRoot: string, slug: string): string {
  return path.join(projectDir(vaultRoot, slug), "tasks");
}

export function taskFile(vaultRoot: string, slug: string, taskId: string): string {
  return path.join(tasksDir(vaultRoot, slug), `${taskId}.md`);
}

export function listProjectSlugs(vaultRoot: string): string[] {
  const dir = projectsDir(vaultRoot);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => fs.existsSync(projectFile(vaultRoot, slug)));
}

export function listTaskFiles(vaultRoot: string, slug: string): string[] {
  const dir = tasksDir(vaultRoot, slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "project";
}

/** Writes atomically: write to a temp file in the same directory, then rename over the target. */
export function atomicWriteFileSync(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, content, "utf8");
  fs.renameSync(tmpPath, filePath);
}

/** Finds the next free numeric suffix for a project's task key, e.g. WEB-7 -> 8. */
export function nextTaskNumber(vaultRoot: string, slug: string, key: string): number {
  const files = listTaskFiles(vaultRoot, slug);
  const prefix = `${key}-`;
  let max = 0;
  for (const f of files) {
    const base = path.basename(f, ".md");
    if (base.startsWith(prefix)) {
      const n = Number(base.slice(prefix.length));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}
