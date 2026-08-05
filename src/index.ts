import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { join } from "path";
import { homedir } from "os";
import { createMcpServer } from "./server";

const outputDir = process.env.UODO_OUTPUT_DIR ?? join(homedir(), "Documents", "uodo-orzeczenia");

const server = createMcpServer(outputDir);
const transport = new StdioServerTransport();

await server.connect(transport);
process.stderr.write(`[UODO-MCP] Serwer stdio gotowy. Pliki zapisywane do: ${outputDir}\n`);
