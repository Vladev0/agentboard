import path from "node:path";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import Fastify from "fastify";
import { VaultCache } from "../core/cache.js";
import { cleanupStaleArtifacts, getVaultRoot } from "../core/vault.js";
import { VaultWatcher } from "../core/watcher.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerTaskRoutes } from "./routes/tasks.js";

const vaultRoot = getVaultRoot();
cleanupStaleArtifacts(vaultRoot);
const cache = new VaultCache(vaultRoot);
cache.buildAll();

const watcher = new VaultWatcher(vaultRoot, cache);
watcher.start();

const app = Fastify({ logger: true });

await app.register(fastifyWebsocket);

const sockets = new Set<import("ws").WebSocket>();

app.get("/ws", { websocket: true }, (socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});

watcher.on("change", (event) => {
  const payload = JSON.stringify({ type: "change", ...event });
  for (const socket of sockets) socket.send(payload);
});

app.decorate("vaultRoot", vaultRoot);
app.decorate("cache", cache);

await registerProjectRoutes(app);
await registerTaskRoutes(app);

const webDist = path.resolve(process.cwd(), "web", "dist");
await app.register(fastifyStatic, { root: webDist, wildcard: false });
app.setNotFoundHandler((req, reply) => {
  if (req.raw.url?.startsWith("/api") || req.raw.url?.startsWith("/ws")) {
    reply.code(404).send({ error: "not_found" });
    return;
  }
  reply.sendFile("index.html");
});

const port = Number(process.env.PORT ?? 4173);
app.listen({ port, host: "127.0.0.1" }).then(() => {
  app.log.info(`AgentBoard vault: ${vaultRoot}`);
});
