import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { cleanupStaleArtifacts, getVaultRoot } from "../core/vault.js";
import { registerTools } from "./tools.js";

const vaultRoot = getVaultRoot();
cleanupStaleArtifacts(vaultRoot);

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};
const server = new McpServer({ name: "agentboard", version: packageJson.version });
registerTools(server, vaultRoot);

const transport = new StdioServerTransport();
await server.connect(transport);
