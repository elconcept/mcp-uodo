import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { UodoDocument, UodoSearchItem } from "./types";

const STATUS_MAP: Record<string, string> = {
  final: "Prawomocna",
  nonfinal: "Nieprawomocna",
  suspended: "Zawieszona",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSections(text: string): { operative: string; reasoning: string | null } {
  // HTML
  const htmlIdx = text.search(/<h[1-6][^>]*>\s*UZASADNIENIE\s*<\/h[1-6]>/i);
  if (htmlIdx !== -1) {
    return {
      operative: stripHtml(text.slice(0, htmlIdx)),
      reasoning: stripHtml(text.slice(htmlIdx)),
    };
  }
  // Markdown heading or plain text heading on its own line
  const headingIdx = text.search(/^#{0,6}\s*UZASADNIENIE\s*$/im);
  if (headingIdx !== -1) {
    return {
      operative: text.slice(0, headingIdx).trim(),
      reasoning: text.slice(headingIdx).trim(),
    };
  }
  const isHtml = /<[a-z]/i.test(text);
  return { operative: isHtml ? stripHtml(text) : text.trim(), reasoning: null };
}

function stripLeadingTable(text: string): string {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i].trim().startsWith("|") || lines[i].trim() === "")) {
    i++;
  }
  return lines.slice(i).join("\n").trim();
}

function buildMetaTable(doc: UodoDocument): string {
  const status = STATUS_MAP[doc.publication?.status ?? ""] ?? doc.publication?.status ?? "brak";

  const dateAnnouncement = doc.dates?.find((d) => d.use === "announcement")?.date ?? "brak";
  const datePublication = doc.dates?.find((d) => d.use === "publication")?.date ?? "brak";
  const dateValidation = doc.dates?.find((d) => d.use === "validation")?.date ?? null;

  const entities = [
    ...new Set(doc.entities?.map((e) => e.name?.pl).filter((n): n is string => !!n) ?? []),
  ].join(", ");

  const terms = doc.terms?.map((t) => t.name?.pl).filter(Boolean).join(", ") ?? "";

  const courtRefs = (doc.refs ?? [])
    .filter((r) => r.refid?.includes(":court:"))
    .map((r) => r.name)
    .filter(Boolean)
    .join("; ");

  const legalRefs = (doc.refs ?? [])
    .filter((r) => !r.refid?.includes(":court:"))
    .map((r) => r.name)
    .filter(Boolean)
    .join("; ");

  const rows = [
    `| **Sygnatura** | ${doc.refname ?? "brak"} |`,
    `| **Tytuł** | ${doc.title?.pl ?? "brak"} |`,
    `| **Status** | ${status} |`,
    `| **Data wydania** | ${dateAnnouncement} |`,
    dateValidation ? `| **Data uprawomocnienia** | ${dateValidation} |` : null,
    `| **Data publikacji** | ${datePublication} |`,
    entities ? `| **Dział** | ${entities} |` : null,
    terms ? `| **Tematy** | ${terms} |` : null,
    legalRefs ? `| **Akty prawne i inne** | ${legalRefs} |` : null,
    courtRefs ? `| **Orzecznictwo sądowe** | ${courtRefs} |` : null,
    `| **Źródło** | [${doc.refname ?? doc.id} - UODO Portal Orzeczeń](https://orzeczenia.uodo.gov.pl/search) |`,
  ].filter((r): r is string => r !== null);

  return ["| Pole | Wartość |", "|------|---------|", ...rows].join("\n");
}

export function saveDecisionFile(doc: UodoDocument, body: string, outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });
  const safeFileName = `UODO_${(doc.refname ?? doc.id).replace(/[\\/:*?"<>|]/g, "_")}.md`;
  const filePath = join(outputDir, safeFileName);

  const cleanBody = stripLeadingTable(body);
  const { operative, reasoning } = extractSections(cleanBody);

  const lines = [
    `# Decyzja UODO ${doc.refname ?? doc.id}`,
    "",
    buildMetaTable(doc),
    "",
    "---",
    "",
    "## SENTENCJA (DECYZJA)",
    "",
    operative || "Brak sentencji.",
    "",
    "---",
    "",
    "## UZASADNIENIE",
    "",
    reasoning ?? "Brak uzasadnienia.",
  ].join("\n");

  writeFileSync(filePath, lines, "utf8");
  return filePath;
}

export function formatSearchResults(items: UodoSearchItem[]): string {
  if (items.length === 0) return "Brak wyników dla podanych kryteriów wyszukiwania.";

  const lines: string[] = [`Znaleziono wyników: ${items.length}\n`];
  for (const item of items) {
    const announcement = item.dates?.find((d) => d.use === "announcement")?.date ?? "brak";
    const publication = item.dates?.find((d) => d.use === "publication")?.date ?? "brak";
    lines.push("---");
    lines.push(`ID: ${item.id}`);
    lines.push(`Sygnatura: ${item.refname ?? "brak"}`);
    lines.push(`refid: ${item.refid ?? "brak"}`);
    lines.push(`Data ogłoszenia: ${announcement}`);
    lines.push(`Data publikacji: ${publication}`);
    lines.push("");
  }
  lines.push("---");

  return lines.join("\n");
}

export function formatDecision(doc: UodoDocument, body: string, outputDir?: string): string {
  const cleanBody = stripLeadingTable(body);
  const { operative, reasoning } = extractSections(cleanBody);
  const filePath = outputDir ? saveDecisionFile(doc, body, outputDir) : null;

  return [
    "## Metadane",
    "",
    buildMetaTable(doc),
    filePath ? `\n**Plik:** ${filePath}` : null,
    "",
    "## Sentencja / Decyzja",
    "",
    operative || "Brak sentencji.",
    "",
    "## Uzasadnienie",
    "",
    reasoning ?? "Brak uzasadnienia.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
