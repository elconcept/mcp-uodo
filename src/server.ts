import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { uodoGet, uodoFetchText } from "./api";
import { formatSearchResults, formatDecision } from "./format";
import { paginateDecision } from "./pagination";
import type { UodoDocument, UodoSearchItem } from "./types";
import { VERSION } from "./version";

const txt = (text: string) => ({ content: [{ type: "text" as const, text }] });

const err = (error: unknown) => {
  const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
  const text = isTimeout
    ? "UODO API nie odpowiedział w ciągu 15 sekund. Spróbuj ponownie lub zawęź zapytanie."
    : `Błąd UODO API: ${error instanceof Error ? error.message : String(error)}`;
  return { isError: true as const, content: [{ type: "text" as const, text }] };
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildCondition(query?: string, caseNumber?: string): string {
  if (caseNumber) {
    const safe = caseNumber.trim().replace(/[^a-zA-Z0-9.\-\/]/g, "");
    return `refname:glob:*${safe}*`;
  }
  if (query) {
    const terms = query.split(",").map((t) => t.trim()).filter(Boolean);
    if (terms.length === 1) {
      return `content_pl:fts:${encodeURIComponent(terms[0])}`;
    }
    const pattern = terms.map((t) => escapeRegex(t).replace(/\s+/g, "\\s+")).join("|");
    return `content_pl:regex:${encodeURIComponent(pattern)}`;
  }
  return "publicator_subtype:eq:uodo";
}

export function createMcpServer(outputDir?: string): McpServer {
  const server = new McpServer({ name: "UODO-MCP", version: VERSION });

  server.tool(
    "uodo_search_decisions",
    "Wyszukuje decyzje UODO (Prezes Urzędu Ochrony Danych Osobowych). Sortowanie: najnowsze pierwsze.\n\nParametr query — dwa tryby:\n1. Pojedyncze pojęcie lub fraza (bez przecinka): full-text search z polskim stemmingiem (AND). Przykład: 'kara pieniężna naruszenie'\n2. Kilka pojęć rozdzielonych przecinkami: wyszukiwanie OR — dokument wystarczy że zawiera JEDNO z nich. Użyj dla szerokich tematów. Przykład: 'oprogramowanie, system informatyczny, aplikacja mobilna, sklep internetowy, platforma'\n\nZasada: nie uzupełniaj wyników z własnej wiedzy — korzystaj wyłącznie z danych zwróconych przez API.\n\nInne parametry:\n- caseNumber: fragment sygnatury, np. 'DKN.5131' lub 'DS.523'\n- dateFrom/dateTo: zawężenie zakresu dat\n- Wyniki zawierają ID — podaj je do uodo_get_decision, żeby pobrać pełną treść.",
    {
      query: z.string().optional().describe("Jedno pojęcie/fraza = FTS z stemmingiem (AND). Kilka pojęć rozdzielonych przecinkami = OR, np. 'oprogramowanie, system informatyczny, aplikacja'"),
      caseNumber: z.string().optional().describe("Fragment sygnatury, np. 'DKN.5131.9' lub 'DS.523'"),
      dateFrom: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Data ogłoszenia od, format YYYY-MM-DD"),
      dateTo: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Data ogłoszenia do, format YYYY-MM-DD"),
      count: z.number().int().min(1).max(100).default(20).describe("Liczba wyników (max 100, domyślnie 20)"),
      from: z.number().int().min(0).default(0).describe("Offset paginacji (od 0)"),
    },
    async ({ query, caseNumber, dateFrom, dateTo, count, from }) => {
      try {
        const timespan = `${dateFrom ?? ""},${dateTo ?? ""}`;
        const conditions = buildCondition(query, caseNumber);
        const params = new URLSearchParams({
          order: "-id",
          count: String(count),
          from: String(from),
          fields: "id,refid,refname,dates",
        });
        const path = `/documents/search/PublicDocument/${timespan}/${conditions}?${params}`;
        const data = await uodoGet(path);
        return txt(formatSearchResults(Array.isArray(data) ? (data as UodoSearchItem[]) : []));
      } catch (error) {
        return err(error);
      }
    }
  );

  server.tool(
    "uodo_get_decision",
    "Pobiera decyzję UODO po ID bez utraty treści. Zwraca tylko fragment (domyślnie 5000 punktów kodowych Unicode), plus totalLength, returnedLength, hasMore i nextOffset. Do odczytu całości wywołuj kolejne offset=nextOffset aż hasMore=false. Pierwszy offset=0. Strony po złączeniu dają dosłownie pełny tekst sentencji, uzasadnienia i metadanych. W trybie stdio zapisuje także pełny plik .md.",
    {
      id: z.string().regex(/^PublicDocument-[A-Za-z0-9_-]{8,150}$/).describe("Dokładny ID z wyników uodo_search_decisions, np. 'PublicDocument-20260407-000000-000-abc123'"),
      offset: z.number().int().min(0).default(0).describe("Offset w punktach kodowych Unicode (od 0), kontynuuj od nextOffset"),
      limit: z.number().int().min(1).max(10_000).default(5000).describe("Liczba punktów kodowych Unicode do zwrócenia (1–10000; domyślnie 5000)"),
    },
    async ({ id, offset, limit }) => {
      try {
        const doc = await uodoGet(`/documents/events/${id}`) as UodoDocument;
        if (!doc?.refid) return txt("Nie znaleziono decyzji lub brak refid w odpowiedzi API.");
        const body = await uodoFetchText(`/documents/public/items/${doc.refid}:0/body.txt`);
        const formatted = formatDecision(doc, body, outputDir);
        const page = paginateDecision(formatted, offset, limit);
        const details = {
          identyfikator: id,
          sygnatura: doc.refname ?? null,
          zrodlo: "API portalu orzeczenia.uodo.gov.pl",
          dokument_pelny: false, // Nie potwierdzono niezależnie kompletności publikacji źródłowej.
          ...page,
        };
        const next = page.hasMore ? `Kolejny fragment: offset=${page.nextOffset}, limit=${limit}.` : "Koniec treści decyzji.";
        const header = `UODO ${doc.refname ?? id} — znaki ${page.offset}–${page.offset + page.returnedLength} z ${page.totalLength}. ${next}`;
        return {
          content: [{ type: "text" as const, text: `${header}\\n\\n${page.tekst}` }],
          structuredContent: details,
        };
      } catch (error) {
        return err(error);
      }
    }
  );

  server.tool(
    "uodo_list_search_fields",
    "Zwraca listę dostępnych pól wyszukiwania w bazie UODO wraz z typami danych. Użyj żeby poznać możliwe filtry do uodo_search_decisions.",
    {},
    async () => {
      try {
        const data = await uodoGet("/documents/search");
        const fields = (data as Record<string, Record<string, string>>)?.PublicDocument ?? {};
        const lines = ["## Dostępne pola wyszukiwania UODO\n"];
        for (const [field, type] of Object.entries(fields)) {
          lines.push(`**${field}**: ${type}`);
        }
        lines.push("\n---");
        lines.push("Użyj pól w warunku wyszukiwania: `pole:operator:wartość`");
        lines.push("Operatory: `eq` (=), `ne` (≠), `gt` (>), `lt` (<), `glob` (wzorzec *), `in` (lista), `fts` (full-text search z polskim stemmingiem, spacja = AND, frazy w cudzysłowie)");
        return txt(lines.join("\n"));
      } catch (error) {
        return err(error);
      }
    }
  );

  return server;
}
