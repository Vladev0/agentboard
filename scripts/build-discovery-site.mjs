import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(root, ".distribution");
const output = join(outputRoot, "site");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const siteUrl = "https://vladev0.github.io/agentboard/";
const updated = new Date().toISOString();

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(join(root, "site"), output, { recursive: true });
mkdirSync(join(output, "screenshots"), { recursive: true });
for (const name of ["board-overview.png", "task-detail.png", "subtasks.png"]) {
  cpSync(join(root, "docs", "screenshots", name), join(output, "screenshots", name));
}

const htmlPath = join(output, "index.html");
const html = readFileSync(htmlPath, "utf8")
  .replaceAll("{{VERSION}}", pkg.version)
  .replaceAll("{{UPDATED}}", updated);
writeFileSync(htmlPath, html);

writeFileSync(
  join(output, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}</loc><lastmod>${updated.slice(0, 10)}</lastmod><changefreq>weekly</changefreq></url>\n</urlset>\n`
);

writeFileSync(
  join(output, "feed.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <title>AgentBoard releases</title>\n  <id>${siteUrl}</id>\n  <link href="${siteUrl}feed.xml" rel="self"/>\n  <link href="${siteUrl}"/>\n  <updated>${updated}</updated>\n  <entry>\n    <title>AgentBoard ${pkg.version}</title>\n    <id>https://github.com/Vladev0/agentboard/releases/tag/v${pkg.version}</id>\n    <link href="https://github.com/Vladev0/agentboard/releases/tag/v${pkg.version}"/>\n    <updated>${updated}</updated>\n    <summary>Local-first task and memory board for humans and autonomous coding agents.</summary>\n  </entry>\n</feed>\n`
);

const key = readFileSync(join(root, "site", "indexnow-key.txt"), "utf8").trim();
writeFileSync(join(outputRoot, "indexnow.json"), JSON.stringify({
  host: "vladev0.github.io",
  key,
  keyLocation: `${siteUrl}indexnow-key.txt`,
  urlList: [siteUrl, `${siteUrl}feed.xml`, `${siteUrl}llms.txt`],
}, null, 2));

console.log(`Built discovery site ${pkg.version} at ${output}`);
