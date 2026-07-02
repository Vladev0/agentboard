import { EventEmitter } from "node:events";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type { VaultCache } from "./cache.js";
import { projectsDir } from "./vault.js";

export interface VaultChangeEvent {
  slug: string;
  reason: "project" | "task";
}

export class VaultWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;

  constructor(
    private vaultRoot: string,
    private cache: VaultCache
  ) {
    super();
  }

  start(): void {
    const root = projectsDir(this.vaultRoot);
    this.watcher = chokidar.watch(root, {
      ignoreInitial: true,
      ignored: (p) => p.endsWith(".tmp"),
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });

    // A burst of filesystem events (e.g. deleting or reseeding a whole project directory)
    // can race a refresh against a file that disappears mid-read. That must never crash
    // the process — worst case the cache is briefly stale until the next event settles it.
    const handle = (filePath: string) => {
      try {
        const rel = path.relative(root, filePath);
        const [slug] = rel.split(path.sep);
        if (!slug) return;
        if (rel === path.join(slug, "project.md")) {
          this.cache.refreshProject(slug);
          this.emit("change", { slug, reason: "project" } satisfies VaultChangeEvent);
        } else if (rel.startsWith(path.join(slug, "tasks"))) {
          this.cache.refreshProject(slug);
          this.emit("change", { slug, reason: "task" } satisfies VaultChangeEvent);
        }
      } catch (err) {
        console.error(`[watcher] failed to process change for ${filePath}:`, err);
      }
    };

    const handleRemoveDir = (dirPath: string) => {
      try {
        const rel = path.relative(root, dirPath);
        const [slug] = rel.split(path.sep);
        if (slug && rel === slug) {
          this.cache.removeProject(slug);
          this.emit("change", { slug, reason: "project" } satisfies VaultChangeEvent);
        }
      } catch (err) {
        console.error(`[watcher] failed to process removal of ${dirPath}:`, err);
      }
    };

    this.watcher.on("add", handle).on("change", handle).on("unlink", handle).on("unlinkDir", handleRemoveDir);
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
  }
}
