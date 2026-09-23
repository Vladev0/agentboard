import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const requiredSiteFiles = ["index.html", "styles.css", "robots.txt", "sitemap.xml", "feed.xml", "llms.txt", "indexnow-key.txt"];
for (const file of requiredSiteFiles) {
  if (!existsSync(join(root, ".distribution", "site", file))) throw new Error(`Missing site artifact: ${file}`);
}
const html = readFileSync(join(root, ".distribution", "site", "index.html"), "utf8");
for (const expected of [pkg.version, "application/ld+json", "AgentBoard", "canonical"]) {
  if (!html.includes(expected)) throw new Error(`Site is missing expected value: ${expected}`);
}
const manifestPath = join(root, ".distribution", "mcpb", "manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version !== pkg.version) throw new Error("MCPB version does not match package.json");
  if (manifest.server?.mcp_config?.env?.AGENTBOARD_VAULT !== "${user_config.vault}") {
    throw new Error("MCPB vault configuration is missing");
  }
}
console.log("Distribution artifacts are valid");
