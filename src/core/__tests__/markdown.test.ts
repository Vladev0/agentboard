import { describe, expect, it } from "vitest";
import { parseTaskFile, serializeTaskFile } from "../markdown.js";
import type { TaskFrontmatter } from "../types.js";

function fm(overrides: Partial<TaskFrontmatter> = {}): TaskFrontmatter {
  return {
    id: "WEB-1",
    title: "A task",
    status: "in_progress",
    priority: "medium",
    assignee: "agent",
    parent: null,
    order: 10,
    blockedBy: [],
    labels: [],
    created: "2026-07-01T10:00:00Z",
    updated: "2026-07-01T12:30:00Z",
    version: 1,
    blocked: false,
    ...overrides,
  };
}

describe("parseTaskFile structural robustness", () => {
  it("keeps Markdown headings, lists, and code inside a description (no truncation)", () => {
    const description = [
      "Intro paragraph.",
      "",
      "## Design",
      "",
      "Some detail with a `code` span.",
      "",
      "### Sub-point",
      "",
      "- bullet one",
      "- bullet two",
      "",
      "```ts",
      "const x = 1; // ## not a heading",
      "```",
      "",
      "## Rollout",
      "",
      "Final paragraph.",
    ].join("\n");

    const file = serializeTaskFile(
      fm(),
      description,
      [{ version: 1, timestamp: "2026-07-01T10:00:00Z", author: "agent", summary: "Task created.", description }],
      [],
      [],
      []
    );
    const parsed = parseTaskFile(file);
    expect(parsed.description).toBe(description);
    // The full snapshot in the update must survive the same way.
    expect(parsed.updates).toHaveLength(1);
    expect(parsed.updates[0].description).toBe(description);
  });

  it("keeps a ### heading inside a comment body as part of the comment", () => {
    const commentText = "Here's my plan:\n\n### Step 1\n\nDo the thing.\n\n### Step 2\n\nShip it.";
    const file = serializeTaskFile(
      fm(),
      "Desc.",
      [{ version: 1, timestamp: "2026-07-01T10:00:00Z", author: "agent", summary: "Task created.", description: "Desc." }],
      [{ timestamp: "2026-07-01T11:15:00Z", author: "human", text: commentText }],
      [],
      []
    );
    const parsed = parseTaskFile(file);
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].text).toBe(commentText);
  });

  it("ignores reserved names and entry headers that appear inside a fenced code block", () => {
    // A description that documents the file format itself — the fence contains lines that
    // would otherwise read as a section boundary (## Comments) or a log entry (### 2026-…).
    const description = [
      "How the format looks:",
      "",
      "```md",
      "## Comments",
      "### 2026-07-01T11:15:00Z — human",
      "A sample comment.",
      "```",
      "",
      "That's the whole thing.",
    ].join("\n");

    const file = serializeTaskFile(
      fm(),
      description,
      [{ version: 1, timestamp: "2026-07-01T10:00:00Z", author: "agent", summary: "Task created.", description }],
      [{ timestamp: "2026-07-02T09:00:00Z", author: "human", text: "Looks right." }],
      [],
      []
    );
    const parsed = parseTaskFile(file);
    expect(parsed.description).toBe(description);
    // The fenced "## Comments" must NOT have leaked a phantom comment; only the real one exists.
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].text).toBe("Looks right.");
  });

  it("round-trips a description that begins directly with a heading", () => {
    const description = "## Overview\n\nText under an immediate heading.";
    const file = serializeTaskFile(
      fm(),
      description,
      [{ version: 1, timestamp: "2026-07-01T10:00:00Z", author: "agent", summary: "Task created.", description }],
      [],
      [],
      []
    );
    expect(parseTaskFile(file).description).toBe(description);
  });
});

describe("parseTaskFile backward compatibility", () => {
  it("reads an old-format file written with the Russian section/label text", () => {
    const raw = `---
id: WEB-1
title: "Legacy task"
status: in_progress
priority: medium
assignee: agent
parent: null
order: 10
blockedBy: []
labels: []
created: 2026-07-01T10:00:00Z
updated: 2026-07-01T12:30:00Z
version: 2
---
## Description
Current text.

## Updates
### v2 — 2026-07-01T12:30:00Z — agent
Резюме: Switched approach.

Текст задачи на этот момент:
Current text.

### v1 — 2026-07-01T10:00:00Z — agent
Резюме: Task created.

Текст задачи на этот момент:
Original text.

## Comments
### 2026-07-01T11:15:00Z — human
A comment.

## Активность
### 2026-07-01T12:30:00Z — agent
Status changed: todo → in_progress

## Subtasks
`;

    const parsed = parseTaskFile(raw);
    expect(parsed.updates).toHaveLength(2);
    expect(parsed.updates[0]).toMatchObject({ version: 2, summary: "Switched approach.", description: "Current text." });
    expect(parsed.updates[1]).toMatchObject({ version: 1, summary: "Task created.", description: "Original text." });
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.activity).toHaveLength(1);
    expect(parsed.activity[0].note).toContain("Status changed");
  });
});
