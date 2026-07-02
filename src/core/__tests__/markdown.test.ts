import { describe, expect, it } from "vitest";
import { parseTaskFile } from "../markdown.js";

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
