# AgentBoard — conventions for agents

AgentBoard is a task tracker for humans and AI agents, built on plain markdown files.
There are two ways to work with tasks: **MCP tools** (the primary path) and **direct file
access** (a fallback, if MCP isn't available). Both paths write the same format, so files
stay consistent no matter which one you use.

## Quick start for a new agent

1. `list_projects` — if the list is empty, there's no project yet: `create_project(name, key?)`,
   then `create_task` for the first tasks. If projects already exist, pick one by `slug`.
2. `get_next_task(project)` — don't read the whole task list, just ask what to do.
3. For the task returned — `get_task(project, id)` to see the full description, updates,
   comments, and subtasks before starting work.
4. Work (see the tool table below), logging updates/comments as you go.
5. Planning to work in cycles/iterations without a human in the loop each time? See
   "Protocol for long loop/cycle sessions" below — it's written for exactly that case.

## Three different kinds of entries on a task — don't confuse them

| Type | Lives in | When to use |
|---|---|---|
| **Comment** | `## Comments` | Discussion, a clarifying question, a passing remark while working. Not versioned. |
| **Update (big)** | `## Updates`, versions `vN` | A deliberate checkpoint: the task's substance (its description) was rewritten after work/discussion led somewhere. Requires a summary of "what and why." Versioned, shown in the UI as the task's main evolution history. |
| **Activity** | `## Activity` | Routine technical bookkeeping: status changes, priority/field changes. Generated automatically, not versioned, collapsed in the UI by default. |

Practical rule: if you're just replying or clarifying, that's a comment (`add_comment`). If
the task's actual substance changes as a result of the discussion, that's an update
(`update_description` with a required `summary`). Never log an "update" without an actual
description change — that's what comments are for.

If a description is saved with an empty summary (typically a human touching up wording in
the UI), the system records the standard summary `Minor edit.` — so every text change still
gets a version, but you can tell deliberate, explained updates apart from cosmetic ones
when reading history. As an agent, always provide a real summary.

## 1. Primary path — MCP tools

| Tool | When to use |
|---|---|
| `list_projects` | See which projects exist and how many tasks each has, by status |
| `create_project(name, key?)` | Create a new project. `key` is the task-ID prefix (e.g. WEB); derived from the name if omitted |
| `list_tasks(project)` | Quickly view a project's task list without extra context |
| `get_task(project, id)` | Get the full card for a specific task, when you need details |
| `get_next_task(project, parent?)` | **Start here** — instead of scanning the list, ask what to do next. With no `parent` it searches the whole project at every depth; pass a `parent` id to step through that task's subtasks |
| `create_task` / `create_subtask` | Create a task, or break one into subtasks |
| `update_status` | Change status — goes into technical activity, not updates |
| `update_task` | Change fields on an existing task (priority, labels, order, blockers, title, assignee) — also goes into activity, not updates |
| `update_description(description, summary)` | **The big update** — rewrite the task's substance with a required "what and why" summary. Creates a new version with a full snapshot of the description |
| `add_comment` | Discussion / a question for the human / a passing remark |
| `set_needs_input(blocked)` | Flag or unflag "needs a human" — independent of status, work can stall at any stage. A task flagged this way drops out of `get_next_task` |
| `delete_task` | Permanently delete a task (a duplicate, no longer needed). Cascades to subtasks. Irreversible |
| `delete_project` | Permanently delete an entire project — all tasks and history. Irreversible, only on an explicit human request |

**Main rule:** don't call `list_tasks`/`get_task` for the whole project if you just need the
next single task — use `get_next_task`. It saves context and keeps you from losing the plan.

## Protocol for long loop/cycle sessions

If you're launched repeatedly — on a schedule, in a loop, with no human in the loop on every
iteration — follow this protocol. It exists so that after a context reset ("cold start") you
can reconstruct the plan in seconds through the system instead of holding it in your head
between iterations, and so a human checking in after many cycles immediately understands
what happened.

**Cold start (beginning of a new session/iteration):**
1. `get_next_task(project)` — don't page through the task list by hand, ask the system what's
   next. It already accounts for status, order, and blockers, and searches the whole project
   at every depth, so nested subtasks are covered too — you don't have to walk the tree.
2. If a task comes back — `get_task` on it, read `description` and the last 1-2
   `updates[].summary` entries. That's almost always enough to understand what's been done
   and why, without reading the whole comment/activity history.
3. If `get_next_task` returns `null` — every task everywhere in the project is either done or
   stuck on a human (see below). Don't invent work for yourself — that's a signal to stop.

**Each iteration:**
- Take one meaningful step per iteration, don't try to close out the whole task at once.
- If the task's substance changed as a result of the step → `update_description` with a
  summary. If you just made routine progress (status, a field) → `update_status`/`update_task`
  — no update needed, the system logs it to activity on its own.
- Need to break work down? → `create_subtask`, rather than holding the plan in your own
  context. The system is your memory between iterations — don't rely on "remembering it
  yourself."

**If you're stuck and need a human decision:**
- **Don't change status** — work can stall at any stage (in Backlog just as easily as In
  Progress), it isn't a separate pipeline stage. Call `set_needs_input(project, id,
  blocked=true)` — the task stays where it was, but stops being suggested by `get_next_task`,
  and the human sees a 🚩 indicator on the card and a counter in the sidebar.
- Leave `add_comment` with a precise question — not vague "need help," but exactly what's
  unclear and what options you see.
- Keep the loop going on the next task via `get_next_task` — don't block the whole cycle
  waiting on an answer for one task.
- Once the human has answered (a new comment) — clear the flag: `set_needs_input(project, id,
  blocked=false)`. The task will show up in `get_next_task` again.

**End of session/cycle:** no separate action needed — updates and activity are already the
session's log. If you want to leave a summary of the whole cycle, one `add_comment` on the
most significant task touched ("this cycle: did X and Y, stuck on Z") is enough.

## 2. Fallback — direct file access

If MCP isn't available, you can read and edit files directly. Structure:

```
vault/projects/<slug>/project.md         # project config: name, key, statuses, labels
vault/projects/<slug>/tasks/<KEY-N>.md   # one task = one file
```

Task file format:

```yaml
---
id: WEB-1
title: Implement login form
status: in_progress        # id from project.md → statuses[]
priority: medium            # low | medium | high | urgent
assignee: agent              # agent | human
parent: null                 # parent task id, or null
order: 10                     # for sorting and get_next_task
blockedBy: []                 # ids of blocking tasks
blocked: false                 # true = waiting on a human decision, independent of status
labels:
  - frontend
created: '2026-07-01T10:00:00Z'
updated: '2026-07-01T12:30:00Z'
version: 2                    # only grows with big updates (## Updates), not with status changes
---
## Description
Current description (= the text of the latest update below).

## Updates
### v2 — 2026-07-01T12:30:00Z — agent
Summary: Switched to an event-driven approach, the old one didn't scale.

Task text at this point:
Current description (= the text of the latest update below).

### v1 — 2026-07-01T10:00:00Z — agent
Summary: Task created.

Task text at this point:
(original description)

## Comments
### 2026-07-01T11:15:00Z — human
A comment.

## Activity
### 2026-07-01T12:30:00Z — agent
Status changed: todo → in_progress

## Subtasks
- [ ] WEB-4 — Child task (todo) (auto-generated, don't edit by hand)
```

**Structure — how the file is divided.** A task file is YAML frontmatter followed by exactly
five reserved sections, always in this order: `## Description`, `## Updates`, `## Comments`,
`## Activity`, `## Subtasks`. Only an `##` heading whose text is exactly one of those five
names divides the file — so the **description and comment bodies are full Markdown** and may
contain their own headings, sub-headings, lists, tables, and code blocks freely. The one
constraint: inside free text, don't use a *top-level* `## Description`/`## Updates`/`##
Comments`/`## Activity`/`## Subtasks` heading (these names are reserved); use a different
name or a deeper level (`###`+), which is always safe. Write real Markdown — you don't need
to flatten or compress it.

Rules for editing directly:

1. **A big update to the task's substance** (rewrote the description after doing the work)
   → increment `version` by 1, add an entry `### vN — <ISO timestamp> — agent` at the top of
   `## Updates` in the format `Summary: <what and why>` + a blank line + `Task text at this
   point:` + the full text of the new description.
2. **A routine change** (status, priority, fields, `blocked`) → **don't touch `version`**, add
   an entry to `## Activity` in the format `### <ISO timestamp> — agent` + a short technical
   note.
3. **Don't edit the `## Subtasks` section by hand** — it's automatically recomputed from the
   child tasks' files (via the `parent` field) every time any of them is written.
4. Update the `updated` field to the current ISO timestamp on any change.
5. Don't change `id`, and don't create files with an id that already exists — find the next
   free number from the highest `<KEY-N>` among the files in `tasks/`.
6. Write atomically (create a temp file and rename it) — the server runs in parallel and might
   read the file mid-write otherwise.

Files written before this convention switched to English may still have `Активность` as the
section name, `Резюме:` instead of `Summary:`, and `Текст задачи на этот момент:` instead of
`Task text at this point:` — the parser reads both, so nothing is lost. Prefer the English
forms and the MCP tools going forward.

If you forget to update `version`/`Updates` when editing the description directly, the server
can't invent a "what and why" summary on its own — prefer the MCP tools when they're available.

## Registering the MCP server

Most MCP-compatible agents use the same config shape. Replace the paths with the absolute
path to your copy of the repo and your vault — the values below are just an example:

```json
{
  "mcpServers": {
    "agentboard": {
      "command": "npx",
      "args": ["tsx", "C:\\hermes\\Others\\linear\\src\\mcp\\index.ts"],
      "cwd": "C:\\hermes\\Others\\linear",
      "env": { "AGENTBOARD_VAULT": "C:\\hermes\\Others\\linear\\vault" }
    }
  }
}
```

Set `cwd` to the repo root explicitly if your client supports it. Without it, the server
process inherits whatever directory the agent happens to be rooted in at the time — if
that's a different project, `npx` won't find this repo's local `tsx`/dependencies. Pinning
`cwd` avoids that regardless of which project the agent is working in when it starts.

`AGENTBOARD_VAULT` — path to the vault folder. If not set, `vault` is read from
`agentboard.config.json` in the repo root (see `agentboard.config.example.json`); if that's
missing too, `./vault` relative to the process's working directory is used.

Before the first run, `npm install` needs to have been run in the repo root — otherwise `npx
tsx` won't find the dependencies (`@modelcontextprotocol/sdk`, `gray-matter`, etc.).
