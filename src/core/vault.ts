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

const RENAME_RETRY_DELAYS_MS = [10, 30, 80, 150, 300];

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Writes atomically: write to a temp file in the same directory, then rename over the
 * target. On Windows, `rename` can transiently fail with EPERM/EBUSY/EACCES if another
 * process (a watcher, an editor, antivirus scan-on-write) briefly has the destination
 * file open — this is almost always transient, so retry with backoff before giving up.
 * If every attempt fails, the orphaned temp file is removed rather than left behind.
 */
export function atomicWriteFileSync(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, content, "utf8");

  let lastError: unknown;
  for (let attempt = 0; attempt <= RENAME_RETRY_DELAYS_MS.length; attempt++) {
    try {
      fs.renameSync(tmpPath, filePath);
      return;
    } catch (err) {
      lastError = err;
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") break;
      if (attempt < RENAME_RETRY_DELAYS_MS.length) sleepSync(RENAME_RETRY_DELAYS_MS[attempt]);
    }
  }

  try {
    fs.unlinkSync(tmpPath);
  } catch {
    // Best effort — nothing more we can do if this cleanup itself fails.
  }
  throw lastError;
}

const LOCK_STALE_MS = 5000;
const LOCK_RETRY_TOTAL_MS = 3000;
const LOCK_RETRY_INTERVAL_MS = 25;

/** Paths this process currently holds the lock for — makes withFileLock reentrant. */
const heldLocks = new Set<string>();

/**
 * Cross-process advisory lock via an exclusively-created sentinel file. The REST
 * server and an MCP server are separate OS processes with no shared memory, so an
 * in-process mutex isn't enough to stop them interleaving a read-modify-write on the
 * same task file (classic lost-update: both read the old content, both write back
 * their own change, the second write silently discards the first's). A lock that
 * survives across processes — just a file on the same filesystem — closes that gap.
 * A lock older than LOCK_STALE_MS is assumed orphaned by a crashed process and stolen.
 *
 * Reentrant within a single process: e.g. a cascading delete recurses into a child
 * while still holding the parent's lock, then resyncs that same parent's subtask
 * list before returning — without the `heldLocks` check that nested call would spin
 * against a lock this same call stack already holds, until it times out.
 */
export function withFileLock<T>(targetPath: string, fn: () => T): T {
  const lockPath = `${targetPath}.lock`;
  if (heldLocks.has(lockPath)) return fn();

  const deadline = Date.now() + LOCK_RETRY_TOTAL_MS;
  for (;;) {
    try {
      fs.closeSync(fs.openSync(lockPath, "wx"));
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        continue; // Lock vanished between the failed open and this stat — just retry.
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for a lock on ${targetPath} — another process is writing to it.`);
      }
      sleepSync(LOCK_RETRY_INTERVAL_MS);
    }
  }

  heldLocks.add(lockPath);
  try {
    return fn();
  } finally {
    heldLocks.delete(lockPath);
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      // Best effort.
    }
  }
}

/**
 * Removes leftover `.tmp`/`.lock` files older than `maxAgeMs`. These can only exist if
 * a previous process crashed mid-write or mid-lock; anything genuinely in-flight is
 * only ever milliseconds old, so this is safe to run at startup without racing a
 * concurrently running process.
 */
export function cleanupStaleArtifacts(vaultRoot: string, maxAgeMs = 30_000): void {
  const now = Date.now();
  for (const slug of listProjectSlugs(vaultRoot)) {
    const dir = tasksDir(vaultRoot, slug);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".tmp") && !name.endsWith(".lock")) continue;
      const full = path.join(dir, name);
      try {
        if (now - fs.statSync(full).mtimeMs > maxAgeMs) fs.rmSync(full, { force: true });
      } catch {
        // Already gone — fine.
      }
    }
  }
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
