import assert from "node:assert/strict";
import test from "node:test";
import { paginateDecision } from "../src/pagination";

test("długie decyzje UODO: bezstratna paginacja po punktach kodowych Unicode", () => {
  const text = ("Art. 1. Żółć Łódź; 😊; znak astralny 🧑‍⚖️; uzasadnienie.\n").repeat(3600);
  const expectedCodePoints = Array.from(text).length;
  assert.ok(expectedCodePoints > 100_000);
  let offset = 0;
  const pages: string[] = [];
  let count = 0;
  while (true) {
    const page = paginateDecision(text, offset, 1847);
    assert.equal(page.status, "znaleziony");
    assert.equal(page.totalLength, expectedCodePoints);
    assert.equal(page.returnedLength, Array.from(page.tekst).length);
    assert.ok(page.returnedLength <= 1847);
    assert.equal(page.offset, offset);
    pages.push(page.tekst);
    count++;
    assert.ok(count < 300);
    if (!page.hasMore) {
      assert.equal(page.nextOffset, null);
      assert.equal(offset + page.returnedLength, expectedCodePoints);
      break;
    }
    assert.equal(page.nextOffset, offset + page.returnedLength);
    offset = page.nextOffset!;
  }
  assert.equal(pages.join(""), text);
});

test("zakończenie, pusta strona i walidacja parametrów", () => {
  const text = "A😀B";
  const page = paginateDecision(text, 1, 1);
  assert.equal(page.tekst, "😀");
  assert.equal(page.returnedLength, 1);
  assert.equal(page.totalLength, 3);
  assert.equal(page.nextOffset, 2);
  const last = paginateDecision(text, 2, 5);
  assert.equal(last.tekst, "B");
  assert.equal(last.hasMore, false);
  assert.equal(last.nextOffset, null);
  assert.deepEqual(paginateDecision(text, 3, 5), {
    status: "poza_zakresem", offset: 3, limit: 5,
    totalLength: 3, returnedLength: 0, hasMore: false, nextOffset: null, tekst: "",
  });
  for (const [offset, limit] of [[-1, 5], [0, 0], [0, 10001], [0.5, 5], [0, Infinity], [Number.MAX_SAFE_INTEGER + 1, 2]]) {
    assert.throws(() => paginateDecision(text, offset, limit), RangeError);
  }
});
