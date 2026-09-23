import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const bundleArg = process.argv[2];
const outputArg = process.argv[3] || join(root, ".distribution", "server.json");
if (!bundleArg) throw new Error("Usage: node scripts/write-server-json.mjs <bundle.mcpb> [server.json]");
const bundle = resolve(bundleArg);
const hash = createHash("sha256").update(readFileSync(bundle)).digest("hex");
const tag = `v${pkg.version}`;
const server = {
  $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  name: "io.github.vladev0/agentboard",
  title: "AgentBoard",
  description: pkg.description,
  version: pkg.version,
  repository: { url: "https://github.com/Vladev0/agentboard", source: "github" },
  packages: [{
    registryType: "mcpb",
    identifier: `https://github.com/Vladev0/agentboard/releases/download/${tag}/${basename(bundle)}`,
    fileSha256: hash,
    transport: { type: "stdio" }
  }]
};
writeFileSync(outputArg, JSON.stringify(server, null, 2) + "\n");
console.log(`Wrote ${outputArg} (${hash})`);
