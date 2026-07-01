import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getVaultRoot } from "../core/vault.js";
import { registerTools } from "./tools.js";

const vaultRoot = getVaultRoot();

const server = new McpServer({ name: "agentboard", version: "0.1.0" });
registerTools(server, vaultRoot);

const transport = new StdioServerTransport();
await server.connect(transport);
