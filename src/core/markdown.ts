import matter from "gray-matter";
import type {
  ActivityEntry,
  CommentEntry,
  ProjectConfig,
  SubtaskRef,
  TaskFrontmatter,
  UpdateEntry,
} from "./types.js";

const SEP = " — ";
// Written in English going forward; the RU forms are still recognized on read so existing
// task files (written before the tool's text was switched to English) don't lose history.
const SNAPSHOT_LABEL = "Task text at this point:";
const SNAPSHOT_LABEL_RU = "Текст задачи на этот момент:";
const SUMMARY_PREFIX = "Summary:";
const SUMMARY_PREFIX_RE = /^(?:Summary|Резюме):\s*/;
const ACTIVITY_SECTION = "Activity";
const ACTIVITY_SECTION_RU = "Активность";

/**
 * The five structural sections are a fixed, known set. Only an H2 whose title is exactly
 * one of these acts as a section boundary — every other `##`/`###` heading is treated as
 * ordinary content. This is what lets a description or comment contain full Markdown
 * (headings, sub-headings, lists, code) without being truncated at the first heading.
 *
 * Consequence: these names are reserved. Don't use a top-level `## Description`, `## Updates`,
 * `## Comments`, `## Activity`, or `## Subtasks` heading as literal text inside a description
 * or comment — deeper (`###`+) or differently-named headings are always safe.
 */
const TOP_SECTION_NAMES = new Set<string>([
  "Description",
  "Updates",
  "Comments",
  ACTIVITY_SECTION,
  ACTIVITY_SECTION_RU,
  "Subtasks",
]);

// Shapes of the entry headers the tool writes inside a section, so a stray `### heading` in
// free text (a comment, a description snapshot) isn't mistaken for the start of a new entry.
const UPDATE_ENTRY_HEADER = /^v\d+\s*—/; //           "v3 — 2026-… — agent"
const LOG_ENTRY_HEADER = /^\d{4}-\d{2}-\d{2}/; //     "2026-07-01T… — human"

/**
 * Character ranges covered by fenced code blocks (``` or ~~~). Headings and entry-header-shaped
 * lines inside a code fence are content, not structure — an agent pasting example task-file
 * markdown or a log into a description/comment must not fracture the file. An unterminated
 * fence extends to the end of the text (matching how Markdown renderers treat it).
 */
function fencedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const fenceRe = /^[ \t]*(`{3,}|~{3,})/;
  let open: { start: number; marker: string } | null = null;
  let offset = 0;
  for (const line of text.split("\n")) {
    const m = fenceRe.exec(line);
    if (m) {
      if (!open) open = { start: offset, marker: m[1][0] };
      else if (line.trimStart().startsWith(open.marker)) {
        ranges.push([open.start, offset + line.length]);
        open = null;
      }
    }
    offset += line.length + 1; // + 1 for the "\n" consumed by split
  }
  if (open) ranges.push([open.start, text.length]);
  return ranges;
}

const notFenced = (ranges: Array<[number, number]>) => (idx: number) =>
  !ranges.some(([s, e]) => idx >= s && idx < e);

function splitTopSections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^##[ \t]+(.+?)[ \t]*$/gm;
  const outsideFence = notFenced(fencedRanges(body));
  const boundaries = [...body.matchAll(re)].filter(
    (m) => outsideFence(m.index!) && TOP_SECTION_NAMES.has(m[1].trim())
  );
  for (let i = 0; i < boundaries.length; i++) {
    const name = boundaries[i][1].trim();
    const start = boundaries[i].index! + boundaries[i][0].length;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].index! : body.length;
    out[name] = body.slice(start, end).trim();
  }
  return out;
}

function splitSubSections(section: string, isEntryHeader: RegExp): { header: string; text: string }[] {
  if (!section.trim()) return [];
  const re = /^###[ \t]+(.+?)[ \t]*$/gm;
  const outsideFence = notFenced(fencedRanges(section));
  const matches = [...section.matchAll(re)].filter(
    (m) => outsideFence(m.index!) && isEntryHeader.test(m[1].trim())
  );
  const out: { header: string; text: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const header = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : section.length;
    out.push({ header, text: section.slice(start, end).trim() });
  }
  return out;
}

function parseTimestampAuthorHeader(header: string): { timestamp: string; author: string } {
  // "2026-07-01T11:15:00Z — human"
  const idx = header.lastIndexOf(SEP.trim());
  return {
    timestamp: idx >= 0 ? header.slice(0, idx).trim() : header,
    author: idx >= 0 ? header.slice(idx + 1).trim() : "system",
  };
}

export function parseTaskFile(raw: string): {
  frontmatter: TaskFrontmatter;
  description: string;
  updates: UpdateEntry[];
  comments: CommentEntry[];
  activity: ActivityEntry[];
} {
  const { data, content } = matter(raw);
  const frontmatter: TaskFrontmatter = {
    id: data.id,
    title: data.title,
    status: data.status,
    priority: data.priority ?? "medium",
    assignee: data.assignee ?? "agent",
    parent: data.parent ?? null,
    order: data.order ?? 0,
    blockedBy: data.blockedBy ?? [],
    labels: data.labels ?? [],
    created: data.created,
    updated: data.updated,
    version: data.version ?? 1,
    blocked: data.blocked ?? false,
  };

  const sections = splitTopSections(content);

  const updates: UpdateEntry[] = splitSubSections(sections["Updates"] ?? "", UPDATE_ENTRY_HEADER).map((s) => {
    // "v3 — 2026-07-01T12:30:00Z — agent"
    const m = /^v(\d+)\s*—\s*(.+?)\s*—\s*(.+)$/.exec(s.header);
    const label = s.text.includes(SNAPSHOT_LABEL_RU) ? SNAPSHOT_LABEL_RU : SNAPSHOT_LABEL;
    const snapshotIdx = s.text.indexOf(label);
    const summaryRaw = snapshotIdx >= 0 ? s.text.slice(0, snapshotIdx) : s.text;
    const description = snapshotIdx >= 0 ? s.text.slice(snapshotIdx + label.length).trim() : "";
    const summary = summaryRaw.replace(SUMMARY_PREFIX_RE, "").trim();
    return {
      version: m ? Number(m[1]) : 0,
      timestamp: m ? m[2].trim() : "",
      author: m ? m[3].trim() : "system",
      summary,
      description,
    };
  });

  const comments: CommentEntry[] = splitSubSections(sections["Comments"] ?? "", LOG_ENTRY_HEADER).map((s) => {
    const { timestamp, author } = parseTimestampAuthorHeader(s.header);
    return { timestamp, author, text: s.text };
  });

  const activity: ActivityEntry[] = splitSubSections(
    sections[ACTIVITY_SECTION] ?? sections[ACTIVITY_SECTION_RU] ?? "",
    LOG_ENTRY_HEADER
  ).map((s) => {
    const { timestamp, author } = parseTimestampAuthorHeader(s.header);
    return { timestamp, author, note: s.text };
  });

  return {
    frontmatter,
    description: sections["Description"] ?? "",
    updates,
    comments,
    activity,
  };
}

export function serializeTaskFile(
  frontmatter: TaskFrontmatter,
  description: string,
  updates: UpdateEntry[],
  comments: CommentEntry[],
  activity: ActivityEntry[],
  subtasks: SubtaskRef[]
): string {
  const updatesBlock = updates
    .slice()
    .sort((a, b) => b.version - a.version)
    .map(
      (u) =>
        `### v${u.version}${SEP}${u.timestamp}${SEP}${u.author}\n${SUMMARY_PREFIX} ${u.summary}\n\n${SNAPSHOT_LABEL}\n${u.description}`
    )
    .join("\n\n");

  const commentsBlock = comments
    .map((c) => `### ${c.timestamp}${SEP}${c.author}\n${c.text}`)
    .join("\n\n");

  const activityBlock = activity
    .slice()
    .reverse()
    .map((a) => `### ${a.timestamp}${SEP}${a.author}\n${a.note}`)
    .join("\n\n");

  const subtasksBlock = subtasks
    .map((s) => `- [${s.done ? "x" : " "}] ${s.id}${SEP}${s.title} (${s.status})`)
    .join("\n");

  const body = [
    "## Description",
    description.trim(),
    "",
    "## Updates",
    updatesBlock,
    "",
    "## Comments",
    commentsBlock,
    "",
    `## ${ACTIVITY_SECTION}`,
    activityBlock,
    "",
    "## Subtasks",
    subtasksBlock,
    "",
  ].join("\n");

  return matter.stringify(body, frontmatter);
}

export function parseProjectFile(raw: string, slug: string): ProjectConfig {
  const { data } = matter(raw);
  return {
    slug,
    name: data.name,
    key: data.key,
    statuses: data.statuses ?? [],
    labels: data.labels ?? [],
    created: data.created,
  };
}

export function serializeProjectFile(config: ProjectConfig): string {
  const { slug, ...frontmatter } = config;
  return matter.stringify("", frontmatter);
}
