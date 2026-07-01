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
const SNAPSHOT_LABEL = "Текст задачи на этот момент:";

function splitTopSections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^##\s+(.+)$/gm;
  const matches = [...body.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    out[name] = body.slice(start, end).trim();
  }
  return out;
}

function splitSubSections(section: string): { header: string; text: string }[] {
  if (!section.trim()) return [];
  const re = /^###\s+(.+)$/gm;
  const matches = [...section.matchAll(re)];
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
  };

  const sections = splitTopSections(content);

  const updates: UpdateEntry[] = splitSubSections(sections["Updates"] ?? "").map((s) => {
    // "v3 — 2026-07-01T12:30:00Z — agent"
    const m = /^v(\d+)\s*—\s*(.+?)\s*—\s*(.+)$/.exec(s.header);
    const snapshotIdx = s.text.indexOf(SNAPSHOT_LABEL);
    const summaryRaw = snapshotIdx >= 0 ? s.text.slice(0, snapshotIdx) : s.text;
    const description = snapshotIdx >= 0 ? s.text.slice(snapshotIdx + SNAPSHOT_LABEL.length).trim() : "";
    const summary = summaryRaw.replace(/^Резюме:\s*/, "").trim();
    return {
      version: m ? Number(m[1]) : 0,
      timestamp: m ? m[2].trim() : "",
      author: m ? m[3].trim() : "system",
      summary,
      description,
    };
  });

  const comments: CommentEntry[] = splitSubSections(sections["Comments"] ?? "").map((s) => {
    const { timestamp, author } = parseTimestampAuthorHeader(s.header);
    return { timestamp, author, text: s.text };
  });

  const activity: ActivityEntry[] = splitSubSections(sections["Активность"] ?? "").map((s) => {
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
        `### v${u.version}${SEP}${u.timestamp}${SEP}${u.author}\nРезюме: ${u.summary}\n\n${SNAPSHOT_LABEL}\n${u.description}`
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
    "## Активность",
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
