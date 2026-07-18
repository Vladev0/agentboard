import fs from "node:fs";
import path from "node:path";
import { parseNoteFile, serializeNoteFile } from "./markdown.js";
import { projectExists } from "./project.js";
import type { Note, NoteFrontmatter, NoteSummary, UpdateEntry } from "./types.js";
import { atomicWriteFileSync, memoryDir, noteFile, withFileLock } from "./vault.js";

/**
 * Project memory as a graph of notes: one markdown file per knowledge node in
 * `memory/<id>.md`, addressed by `[[id]]` wikilinks from task descriptions, comments,
 * and other notes. The body is the current truth; History records how it evolved
 * (same versioned-snapshot mechanism as a task's updates). The index is always
 * GENERATED from the files — there is nothing to maintain by hand.
 */

/** Wikilink target and filename: immutable kebab-case ASCII, e.g. "rating-formula". */
const NOTE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Soft size ceiling (~800 tokens). Not enforced — surfaced to the writer as a warning. */
export const NOTE_BODY_SOFT_LIMIT_CHARS = 3500;

export interface UpsertNoteInput {
  id: string;
  title: string;
  body: string;
  /** What/why changed — the commit message of the knowledge graph. */
  summary: string;
  /** Task ids this knowledge came from; merged (union) with existing sources. */
  sources?: string[];
  author?: string;
}

export interface UpsertNoteResult {
  note: Note;
  created: boolean;
  /** Set when the body exceeds the soft size limit — a nudge to split, not an error. */
  sizeWarning?: string;
}

function assertProject(vaultRoot: string, slug: string): void {
  if (!projectExists(vaultRoot, slug)) throw new Error(`Project not found: ${slug}`);
}

export function noteExists(vaultRoot: string, slug: string, id: string): boolean {
  return fs.existsSync(noteFile(vaultRoot, slug, id));
}

export function listNotes(vaultRoot: string, slug: string): NoteSummary[] {
  assertProject(vaultRoot, slug);
  const dir = memoryDir(vaultRoot, slug);
  if (!fs.existsSync(dir)) return [];
  const summaries: NoteSummary[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    try {
      const note = parseNoteFile(fs.readFileSync(path.join(dir, f), "utf8"));
      const hook = note.body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))[0] ?? "";
      summaries.push({
        id: note.id,
        title: note.title,
        hook: hook.length > 160 ? `${hook.slice(0, 157)}…` : hook,
        sources: note.sources,
        updated: note.updated,
        version: note.version,
      });
    } catch {
      // A malformed note must not take down the whole index.
    }
  }
  return summaries.sort((a, b) => (a.updated < b.updated ? 1 : -1));
}

/**
 * Reads a note. When `touch` is set (the agent read path), `lastUsed` is refreshed —
 * at most once per day, so reads don't churn files — feeding future relevance ranking.
 */
export function getNote(vaultRoot: string, slug: string, id: string, opts: { touch?: boolean } = {}): Note {
  assertProject(vaultRoot, slug);
  const file = noteFile(vaultRoot, slug, id);
  const note = parseNoteFile(fs.readFileSync(file, "utf8"));

  if (opts.touch) {
    const today = new Date().toISOString().slice(0, 10);
    if ((note.lastUsed ?? "").slice(0, 10) !== today) {
      const now = new Date().toISOString();
      withFileLock(file, () => {
        const fresh = parseNoteFile(fs.readFileSync(file, "utf8"));
        const { body, history, ...frontmatter } = fresh;
        atomicWriteFileSync(file, serializeNoteFile({ ...frontmatter, lastUsed: now }, body, history));
      });
      note.lastUsed = now;
    }
  }
  return note;
}

/** Creates or updates a note; every change is a new version with a full body snapshot. */
export function upsertNote(vaultRoot: string, slug: string, input: UpsertNoteInput): UpsertNoteResult {
  assertProject(vaultRoot, slug);
  if (!NOTE_ID_RE.test(input.id)) {
    throw new Error(
      `Invalid note id "${input.id}": must be kebab-case ASCII (a-z, 0-9, hyphens), e.g. "rating-formula"`
    );
  }
  if (!input.summary.trim()) throw new Error("summary is required: say what changed and why");

  const dir = memoryDir(vaultRoot, slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = noteFile(vaultRoot, slug, input.id);
  const author = input.author ?? "agent";
  const now = new Date().toISOString();
  const body = input.body.trim();

  const result = withFileLock(file, () => {
    const existing = fs.existsSync(file) ? parseNoteFile(fs.readFileSync(file, "utf8")) : null;

    const frontmatter: NoteFrontmatter = existing
      ? {
          ...existing,
          title: input.title.trim() || existing.title,
          sources: [...new Set([...existing.sources, ...(input.sources ?? [])])],
          updated: now,
          version: existing.version + 1,
        }
      : {
          id: input.id,
          title: input.title.trim(),
          sources: [...new Set(input.sources ?? [])],
          created: now,
          updated: now,
          lastUsed: now,
          version: 1,
        };

    const entry: UpdateEntry = {
      version: frontmatter.version,
      timestamp: now,
      author,
      summary: input.summary.trim(),
      description: body,
    };
    const history = [entry, ...(existing?.history ?? [])];

    atomicWriteFileSync(file, serializeNoteFile(frontmatter, body, history));
    return { created: !existing };
  });

  const note = parseNoteFile(fs.readFileSync(file, "utf8"));
  const sizeWarning =
    body.length > NOTE_BODY_SOFT_LIMIT_CHARS
      ? `Note body is ${body.length} chars (> ${NOTE_BODY_SOFT_LIMIT_CHARS}). One note = one idea: consider splitting it into linked [[notes]].`
      : undefined;

  return { note, created: result.created, sizeWarning };
}
