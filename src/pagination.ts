/**
 * Bezstratna paginacja treści decyzji w punktach kodowych Unicode, nie UTF-16.
 * Treść jest wcześniej formatowana tylko raz przez formatDecision; złożenie
 * fragmentów według nextOffset odtwarza identyczny tekst, łącznie z nagłówkami.
 */
export interface DecisionPage {
  status: "znaleziony" | "poza_zakresem";
  offset: number;
  limit: number;
  totalLength: number;
  returnedLength: number;
  hasMore: boolean;
  nextOffset: number | null;
  tekst: string;
}

export function paginateDecision(text: string, offset: number, limit: number): DecisionPage {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
    throw new RangeError("offset musi być >= 0, a limit liczbą od 1 do 10000");
  }
  const chars = Array.from(text);
  const totalLength = chars.length;
  const chunk = chars.slice(offset, offset + limit);
  const returnedLength = chunk.length;
  const next = offset + returnedLength;
  const hasMore = next < totalLength;

  return {
    status: offset < totalLength ? "znaleziony" : "poza_zakresem",
    offset,
    limit,
    totalLength,
    returnedLength,
    hasMore,
    nextOffset: hasMore ? next : null,
    tekst: chunk.join(""),
  };
}
