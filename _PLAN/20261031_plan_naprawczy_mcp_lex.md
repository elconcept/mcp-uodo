# UODO — plan utrzymaniowy i testy regresyjne wyszukiwania

> Audyt 2026-10-31: testy narzędzi przez portal `lex`, wywołania bezpośrednie w kontenerach, inspekcja kodu elconcept. **Plan**, nie wdrożenie. **POTWIERDZONE** = fakt testowy lub z kodu; **DO SPRAWDZENIA** = hipoteza.

## Reguły wdrożeniowe
- Polskie zapytania, polska treść, polskie tytuły i polskie błędy. Brak selektora języka w publicznym MCP. Identyfikatory (CELEX/ELI/ECLI, sygnatury, techniczne nazwy) pozostają zgodne ze źródłem.
- `content` i `structuredContent` muszą być zachowane przez kontener, Cloudflare, portal `lex` i klienta. Tekst urzędowy należy oddzielić od komentarza, a stan prawny oznaczyć datą/źródłem.
- Przed produkcyjnym wdrożeniem: test fixture i regresja → staging → smoke end-to-end → kopia stanu → bezpieczny rollout i rollback. Nie ujawniać danych identyfikujących, tokenów ani pełnych logów dostępu.

## Materiał dowodowy
- **POTWIERDZONE:** `uodo_search_decisions(query='monitoring', count=3, from=0)` zwróciło 3 wyniki: `DKE.561.5.2026`, `DKN.5131.5.2025`, `DKE.561.4.2026` (z ID i datami). Po `caseNumber='DKE.561.5.2026'` zwróciło pojedynczy dokument.
- **POTWIERDZONE:** `uodo_get_decision(id='PublicDocument-20260905-000000-000-b6de6a4d933e4772888d87bbdab18fbe')` zwróciło 98 241 znaków polskiej treści: metadane, sentencję i uzasadnienie. `uodo_list_search_fields` zwróciło listę 16 pól i operatory `eq/ne/gt/lt/glob/in/fts`.
- **POTWIERDZONE W KODZIE:** `src/server.ts` pojedynczą frazę kieruje do `content_pl:fts:`, wieloterminowe zapytanie rozdzielone przecinkami do regex OR. Przy `caseNumber` `buildCondition()` zastępuje zapytanie pełnotekstowe — łączenie filtrów `caseNumber` i `query` nie jest zaimplementowane. Wyniki listy zwracają głównie ID/sygnatury/daty.
- **DO SPRAWDZENIA:** łączenie filtrów daty + sygnatura + fraza w tekście; rozmiar i wydajność odpowiedzi ~100 KB; czy portal przy długich odpowiedziach zachowuje wszystkie znaki; czy źródło UODO zwraca liczbę wszystkich trafień do rzetelnej paginacji.

## Plan
1. **P0 — zachować działający serwis:** brak podstaw do pilnej przebudowy. Dodać testy oparte na dotychczasowych przypadkach pojęcia, sygnatury, pobrania całej decyzji i katalogu pól, oraz sprawdzanie zgodności z oryginałem.
2. **P1 — pełna treść na każdym poziomie:** end-to-end `get_decision` przez `lex` i kontener porównujący checksum/rozmiar/nagłówki, bez przepisywania ani streszczania decyzji na poziomie konektora; przy dużych dokumentach opcjonalna bezstratna paginacja.
3. **P1 — filtry:** wyraźnie udokumentować priorytet `caseNumber` nad `query`, albo dodać logiczne AND i testy parametrów. Testy dat granicznych, polskiego stemmingu/odmiany, przecinków OR, diakrytyków i paginacji `count/from`. Błędy/walidacja wyłącznie PL.
4. **P2 — rezultat wyszukiwania:** bez dodatkowego masowego pobierania dokumentów uzupełnić wynik o dostępny polski tytuł/fragment lub metadane, liczbę wszystkich rekordów (jeśli API udostępnia), jasne `hasMore` i źródłowy URL. Brak pól jawnie oznaczyć, nie wymyślać.
5. **P2 — prywatność i monitoring:** nie utrwalać treści decyzji w logach pośrednika; cache TTL i ograniczenie zapytań zgodnie z API UODO; oznaczać datę publikacji i status prawomocności ze źródła.

## Akceptacja
- Oba rodzaje wyszukiwania, odczyt decyzji i lista pól bez regresji; pełna treść wraca po polsku i nie jest ucinana przez `lex`.
- W wynikach widać reguły AND/OR oraz faktyczny zakres filtrów; brak fałszywych zer przy błędzie API.
- Brak selektora języka i nieudokumentowanego tłumaczenia, czytelne kody błędów po polsku.

## Pliki / dowody
`src/server.ts`, `src/api.ts`, `src/format.ts`, `src/http-server.ts`, kontener `mcp-uodo`.
