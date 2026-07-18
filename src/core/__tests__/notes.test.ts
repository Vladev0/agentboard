import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getNote, listNotes, upsertNote } from "../notes.js";
import { createProject } from "../project.js";

let vaultRoot: string;

beforeEach(() => {
  vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentboard-test-"));
});

afterEach(() => {
  fs.rmSync(vaultRoot, { recursive: true, force: true });
});

describe("memory notes", () => {
  it("creates a note (v1) and reads it back", () => {
    const p = createProject(vaultRoot, "Web", { key: "WEB" });
    const { note, created } = upsertNote(vaultRoot, p.slug, {
      id: "rating-formula",
      title: "Final rating formula",
      body: "score = 0.6*z(econ) + 0.4*z(promo)",
      summary: "Settled after Q2 rebuild.",
      sources: ["WEB-3"],
    });
    expect(created).toBe(true);
    expect(note.version).toBe(1);
    expect(note.sources).toEqual(["WEB-3"]);

    const back = getNote(vaultRoot, p.slug, "rating-formula");
    expect(back.body).toBe("score = 0.6*z(econ) + 0.4*z(promo)");
    expect(back.history).toHaveLength(1);
    expect(back.history[0].summary).toBe("Settled after Q2 rebuild.");
  });

  it("updates bump the version, snapshot the new body, and merge sources", () => {
    const p = createProject(vaultRoot, "Web", { key: "WEB" });
    upsertNote(vaultRoot, p.slug, {
      id: "rating-formula",
      title: "Final rating formula",
      body: "w = 0.7/0.3",
      summary: "Initial.",
      sources: ["WEB-3"],
    });
    const { note, created } = upsertNote(vaultRoot, p.slug, {
      id: "rating-formula",
      title: "Final rating formula",
      body: "w = 0.6/0.4",
      summary: "0.7→0.6: Q2 showed format skew.",
      sources: ["WEB-9"],
    });
    expect(created).toBe(false);
    expect(note.version).toBe(2);
    expect(note.body).toBe("w = 0.6/0.4");
    expect(note.sources).toEqual(["WEB-3", "WEB-9"]);
    // History: latest first, snapshots intact — the "how we got here" survives.
    expect(note.history.map((h) => h.version)).toEqual([2, 1]);
    expect(note.history[1].description).toBe("w = 0.7/0.3");
  });

  it("rejects bad ids and empty summaries", () => {
    const p = createProject(vaultRoot, "Web", { key: "WEB" });
    expect(() =>
      upsertNote(vaultRoot, p.slug, { id: "Bad Slug!", title: "x", body: "y", summary: "z" })
    ).toThrow(/kebab-case/);
    expect(() =>
      upsertNote(vaultRoot, p.slug, { id: "ok-slug", title: "x", body: "y", summary: "  " })
    ).toThrow(/summary/);
    expect(() => listNotes(vaultRoot, "no-such-project")).toThrow(/not found/);
  });

  it("generates the index from files: hook from first body line, newest first", () => {
    const p = createProject(vaultRoot, "Web", { key: "WEB" });
    upsertNote(vaultRoot, p.slug, {
      id: "older-note",
      title: "Older",
      body: "# Heading\nActual first prose line.\nSecond line.",
      summary: "Initial.",
    });
    upsertNote(vaultRoot, p.slug, {
      id: "newer-note",
      title: "Newer",
      body: "The one-line hook.",
      summary: "Initial.",
    });

    const index = listNotes(vaultRoot, p.slug);
    expect(index.map((n) => n.id)).toEqual(["newer-note", "older-note"]);
    // Markdown headings are skipped when deriving the hook.
    expect(index[1].hook).toBe("Actual first prose line.");
  });

  it("touch on read refreshes lastUsed at most once per day", () => {
    const p = createProject(vaultRoot, "Web", { key: "WEB" });
    upsertNote(vaultRoot, p.slug, { id: "a-note", title: "A", body: "x", summary: "Initial." });

    // Backdate lastUsed on disk to simulate an old note.
    const file = path.join(vaultRoot, "projects", p.slug, "memory", "a-note.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/lastUsed: .*/g, "lastUsed: '2020-01-01T00:00:00.000Z'"));

    const touched = getNote(vaultRoot, p.slug, "a-note", { touch: true });
    expect(touched.lastUsed.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
    const mtimeAfterFirst = fs.statSync(file).mtimeMs;

    // Second touched read the same day must NOT rewrite the file.
    getNote(vaultRoot, p.slug, "a-note", { touch: true });
    expect(fs.statSync(file).mtimeMs).toBe(mtimeAfterFirst);
  });

  it("keeps markdown with reserved-looking headings inside the body (fenced and plain)", () => {
    const p = createProject(vaultRoot, "Web", { key: "WEB" });
    const body = [
      "Intro.",
      "",
      "## Approach", // non-reserved H2 — plain content for notes
      "",
      "```md",
      "## Body", // reserved name, but fenced — must stay content
      "## History",
      "```",
      "",
      "Tail line.",
    ].join("\n");
    upsertNote(vaultRoot, p.slug, { id: "hostile", title: "Hostile md", body, summary: "Initial." });
    const back = getNote(vaultRoot, p.slug, "hostile");
    expect(back.body).toBe(body);
    expect(back.history[0].description).toBe(body);
  });

  it("warns (not errors) when the body exceeds the soft size limit", () => {
    const p = createProject(vaultRoot, "Web", { key: "WEB" });
    const { sizeWarning } = upsertNote(vaultRoot, p.slug, {
      id: "big-note",
      title: "Big",
      body: "x".repeat(4000),
      summary: "Initial.",
    });
    expect(sizeWarning).toMatch(/splitting/);
  });
});
