import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/server";
import { formatDecision } from "../src/format";
import type { UodoDocument } from "../src/types";

test("MCP uodo_get_decision: content + structuredContent z pełną treścią w kolejnych stronach", async () => {
  const id = "PublicDocument-20261031-000000-000-paginationtest1";
  const doc: UodoDocument = {
    id, refid: "pl:uodo:test:decision",
    refname: "DKN.5131.5.2026",
    title: { pl: "Decyzja testowa" },
    dates: [{ date: "2026-10-31", use: "announcement", type: "date", status: "ok" }],
  };
  const body = "# SENTENCJA\nNa podstawie RODO 🧑‍⚖️.\n# UZASADNIENIE\n"
    + "Uzasadnienie szczegółowe, zażółć gęślą jaźń 😃. ".repeat(150);
  const expected = formatDecision(doc, body);

  const oldFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCount++;
    const url = String(input);
    if (url.endsWith("/documents/events/" + id)) {
      return new Response(JSON.stringify(doc), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/documents/public/items/") && url.endsWith("/body.txt")) {
      return new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    throw new Error("Nieoczekiwany fetch " + url);
  }) as typeof fetch;

  const mcp = createMcpServer();
  const client = new Client({ name: "uodo-pagination-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([mcp.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    const get = tools.tools.find(t => t.name === "uodo_get_decision");
    assert.ok(get);
    assert.ok(get.inputSchema.properties?.offset);
    assert.ok(get.inputSchema.properties?.limit);

    let offset = 0;
    const chunks: string[] = [];
    for (let i = 0; i < 100; i++) {
      const result = await client.callTool({ name: "uodo_get_decision", arguments: { id, offset, limit: 220 } });
      assert.equal(result.isError, undefined);
      assert.ok(Array.isArray(result.content));
      const structured = result.structuredContent as Record<string, unknown>;
      assert.equal(structured.identyfikator, id);
      assert.equal(structured.sygnatura, doc.refname);
      assert.equal(structured.dokument_pelny, false);
      assert.equal(structured.offset, offset);
      assert.equal(structured.limit, 220);
      assert.equal(structured.totalLength, Array.from(expected).length);
      assert.ok(String((result.content[0] as {text:string}).text).includes(String(structured.tekst)));
      chunks.push(structured.tekst as string);
      if (structured.hasMore === false) {
        assert.equal(structured.nextOffset, null);
        break;
      }
      assert.equal(structured.nextOffset, offset + (structured.returnedLength as number));
      offset = structured.nextOffset as number;
    }
    assert.equal(chunks.join(""), expected);
    assert.equal(fetchCount, 2, "15-minutowy cache API zapobiega pobraniom dla każdej strony");
  } finally {
    globalThis.fetch = oldFetch;
    await Promise.allSettled([client.close(), mcp.close()]);
  }
});
