import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { atomicWriteFileSync, cleanupStaleArtifacts, withFileLock } from "../vault.js";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentboard-vault-test-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("atomicWriteFileSync", () => {
  it("writes content and leaves no temp file behind", () => {
    const target = path.join(dir, "task.md");
    atomicWriteFileSync(target, "hello");
    expect(fs.readFileSync(target, "utf8")).toBe("hello");
    expect(fs.readdirSync(dir)).toEqual(["task.md"]);
  });

  it("overwrites existing content on repeated writes without leaving tmp files", () => {
    const target = path.join(dir, "task.md");
    atomicWriteFileSync(target, "v1");
    atomicWriteFileSync(target, "v2");
    atomicWriteFileSync(target, "v3");
    expect(fs.readFileSync(target, "utf8")).toBe("v3");
    expect(fs.readdirSync(dir)).toEqual(["task.md"]);
  });
});

describe("withFileLock", () => {
  it("runs the callback and cleans up the lock file afterwards", () => {
    const target = path.join(dir, "task.md");
    const result = withFileLock(target, () => 42);
    expect(result).toBe(42);
    expect(fs.existsSync(`${target}.lock`)).toBe(false);
  });

  it("is reentrant within the same call stack (a cascading operation re-locking its own path doesn't deadlock)", () => {
    const target = path.join(dir, "task.md");
    const result = withFileLock(target, () => withFileLock(target, () => "inner ran"));
    expect(result).toBe("inner ran");
    expect(fs.existsSync(`${target}.lock`)).toBe(false);
  });

  it("cleans up the lock file even if the callback throws", () => {
    const target = path.join(dir, "task.md");
    expect(() =>
      withFileLock(target, () => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(fs.existsSync(`${target}.lock`)).toBe(false);
  });

  it("steals a stale lock left behind by a crashed process instead of waiting out the full timeout", () => {
    const target = path.join(dir, "task.md");
    const lockPath = `${target}.lock`;
    fs.writeFileSync(lockPath, "");
    const old = new Date(Date.now() - 10_000);
    fs.utimesSync(lockPath, old, old);

    const start = Date.now();
    const result = withFileLock(target, () => "acquired");
    expect(result).toBe("acquired");
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe("cleanupStaleArtifacts", () => {
  it("removes old .tmp/.lock files but leaves fresh ones and real files alone", () => {
    const vaultRoot = dir;
    const tasksDir = path.join(vaultRoot, "projects", "demo", "tasks");
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(vaultRoot, "projects", "demo", "project.md"), "---\nname: Demo\nkey: DEMO\n---\n");

    const staleTmp = path.join(tasksDir, "DEMO-1.md.123.tmp");
    const staleLock = path.join(tasksDir, "DEMO-2.md.lock");
    const freshTmp = path.join(tasksDir, "DEMO-3.md.456.tmp");
    const realFile = path.join(tasksDir, "DEMO-4.md");
    fs.writeFileSync(staleTmp, "");
    fs.writeFileSync(staleLock, "");
    fs.writeFileSync(freshTmp, "");
    fs.writeFileSync(realFile, "content");

    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(staleTmp, old, old);
    fs.utimesSync(staleLock, old, old);

    cleanupStaleArtifacts(vaultRoot, 30_000);

    const remaining = fs.readdirSync(tasksDir);
    expect(remaining).toContain("DEMO-3.md.456.tmp");
    expect(remaining).toContain("DEMO-4.md");
    expect(remaining).not.toContain("DEMO-1.md.123.tmp");
    expect(remaining).not.toContain("DEMO-2.md.lock");
  });
});
