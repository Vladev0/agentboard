import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, ".distribution", "mcpb");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const name of ["dist", "LICENSE", "README.md", "package.json", "package-lock.json"]) {
  cpSync(join(root, name), join(output, name), { recursive: true });
}

const manifest = {
  manifest_version: "0.3",
  name: "agentboard",
  display_name: "AgentBoard",
  version: pkg.version,
  description: pkg.description,
  long_description: "A local-first kanban board and durable project memory for humans and autonomous coding agents. Tasks and knowledge stay in a portable Markdown vault, while agents work through MCP tools.",
  author: { name: "Vladev0", url: "https://github.com/Vladev0" },
  repository: { type: "git", url: "https://github.com/Vladev0/agentboard.git" },
  homepage: "https://vladev0.github.io/agentboard/",
  documentation: "https://github.com/Vladev0/agentboard#readme",
  support: "https://github.com/Vladev0/agentboard/issues",
  license: "MIT",
  keywords: ["mcp", "ai agents", "kanban", "local-first", "task management", "project memory"],
  compatibility: {
    platforms: ["darwin", "win32", "linux"],
    runtimes: { node: ">=20" }
  },
  server: {
    type: "node",
    entry_point: "dist/mcp/index.js",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/dist/mcp/index.js"],
      env: { AGENTBOARD_VAULT: "${user_config.vault}" }
    }
  },
  user_config: {
    vault: {
      type: "directory",
      title: "AgentBoard vault",
      description: "Choose where AgentBoard should keep projects, tasks, history, and memory notes.",
      required: true,
      default: "${DOCUMENTS}/AgentBoard"
    }
  },
  tools: [
    { name: "list_projects", description: "List projects and task counts." },
    { name: "create_project", description: "Create a project." },
    { name: "delete_project", description: "Delete a project after explicit confirmation." },
    { name: "list_tasks", description: "List lightweight task summaries." },
    { name: "get_task", description: "Read one full task card." },
    { name: "get_next_task", description: "Choose the next actionable task." },
    { name: "create_task", description: "Create a top-level task." },
    { name: "create_subtask", description: "Create a nested task." },
    { name: "update_status", description: "Move a task through the workflow." },
    { name: "set_needs_input", description: "Flag work that needs a human decision." },
    { name: "update_task", description: "Update task fields." },
    { name: "update_description", description: "Create a versioned task-description checkpoint." },
    { name: "add_comment", description: "Add task discussion." },
    { name: "list_notes", description: "List durable project-memory notes." },
    { name: "get_note", description: "Read a project-memory note." },
    { name: "upsert_note", description: "Create or update durable project memory." },
    { name: "delete_task", description: "Delete a task after explicit confirmation." }
  ]
};

writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Prepared MCPB stage ${pkg.version} at ${output}`);
