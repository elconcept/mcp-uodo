import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";
import { VERSION } from "./version";

const PORT = Number(process.env.PORT ?? 3000);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SESSIONS = 100;

const sessions = new Map<string, StreamableHTTPServerTransport>();

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
}

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId) {
    if (!UUID_RE.test(sessionId) || !sessions.has(sessionId)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }
    await sessions.get(sessionId)!.handleRequest(req, res);
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "New sessions must be initialized via POST" }));
    return;
  }

  if (sessions.size >= MAX_SESSIONS) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Too many active sessions" }));
    return;
  }

  const newSessionId = randomUUID();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => newSessionId,
  });

  sessions.set(newSessionId, transport);
  transport.onclose = () => sessions.delete(newSessionId);

  const mcpServer = createMcpServer(); // no outputDir — HTTP mode has no local file system
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);
}

const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        server: "UODO-MCP",
        version: VERSION,
        sessions: sessions.size,
      }));
      return;
    }

    if (url.pathname === "/mcp") {
      await handleMcp(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
    process.stderr.write(`[UODO-MCP] Błąd: ${err}\n`);
  }
});

httpServer.listen(PORT, () => {
  process.stderr.write(`[UODO-MCP] HTTP server nasłuchuje na porcie ${PORT}\n`);
  process.stderr.write(`[UODO-MCP] Endpoint MCP: http://localhost:${PORT}/mcp\n`);
  process.stderr.write(`[UODO-MCP] Health check: http://localhost:${PORT}/health\n`);
});

process.on("SIGINT", () => { httpServer.close(); process.exit(0); });
process.on("SIGTERM", () => { httpServer.close(); process.exit(0); });
