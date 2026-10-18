import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";
import { VERSION } from "./version";

const PORT = Number(process.env.PORT ?? 3000);
function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, mcp-protocol-version, Authorization");
}

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // This server only exposes independent, read-only tools. Stateless HTTP avoids
  // accumulating sessions when clients disconnect without sending DELETE.
  if (req.method !== "POST") {
    res.writeHead(405, {
      "Content-Type": "application/json",
      "Allow": "POST, OPTIONS",
    });
    res.end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }));
    return;
  }

  // A fresh server/transport pair is required for every stateless POST.
  const mcpServer = createMcpServer(); // no outputDir in HTTP mode
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  let closed = false;
  const cleanup = (): void => {
    if (closed) return;
    closed = true;

    // Keep resources alive until the HTTP response is finished/aborted.
    void (async () => {
      try {
        await transport.close();
      } finally {
        await mcpServer.close();
      }
    })().catch((error: unknown) => {
      process.stderr.write(`[UODO-MCP] Cleanup error: ${error}\n`);
    });
  };

  res.once("close", cleanup);
  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    cleanup();
    throw error;
  }
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
        sessions: 0,
        sessionMode: "stateless",
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
