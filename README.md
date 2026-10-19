# UODO MCP — decyzje Prezesa UODO w Claude

[![npm version](https://img.shields.io/npm/v/@thescalablelegalmarketer/uodo-mcp)](https://www.npmjs.com/package/@thescalablelegalmarketer/uodo-mcp)
[![Licencja: Apache-2.0](https://img.shields.io/badge/Licencja-Apache%202.0-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-green)](https://modelcontextprotocol.io)

Serwer MCP, którym podłączysz Claude Desktop (oraz inne rozwiązania wspierające MCP) do [orzeczenia.uodo.gov.pl](https://orzeczenia.uodo.gov.pl) — oficjalnego portalu decyzji Prezesa Urzędu Ochrony Danych Osobowych. Zamiast ręcznie przeszukiwać portal i kopiować fragmenty decyzji, pytasz Claude'a w języku naturalnym w Claude Desktop, a on przeszukuje bazę, pobiera pełne treści do plików markdown i cytuje sentencję i uzasadnienie.

To narzędzie do wyszukiwania i pracy na treści decyzji. Nie interpretuje prawa za Ciebie i nie zastępuje analizy prawnika — patrz [Zastrzeżenie](#zastrzeżenie).

## Dla kogo

Dla każdego, kto na co dzień szuka precedensów, argumentacji albo wysokości kar w orzecznictwie UODO:

- **prawnicy i kancelarie** przygotowujące opinie, pisma czy analizy ryzyka opartych na praktyce decyzyjnej UODO,
- **inspektorzy ochrony danych (IOD)**, którzy sprawdzają, jak Prezes UODO oceniał podobne naruszenia w innych podmiotach,
- **działy compliance**, które potrzebują szybkiego przeglądu kar w danym sektorze albo za dany typ naruszenia,
- **badacze i studenci prawa** analizujący linię orzeczniczą UODO.

Nie musisz znać składni zapytań ani struktury API — piszesz do Claude w języku naturalnym, on tłumaczy to na wywołania narzędzi.

## Bezpieczeństwo i audyt kodu

Sekcja dla prawników, radców prawnych, adwokatów i IOD oceniających ryzyko wdrożenia tego serwera MCP w kancelarii lub dziale prawnym.

**Zweryfikuj kod samodzielnie, zanim go podłączysz.** Nie musisz mieć zaplecza programistycznego — audyt możesz zlecić narzędziu AI (np. Claude Code, Codex, Cursor):

1. Pobierz repozytorium na dysk (plik `.zip` lub `git clone`).
2. Otwórz je w wybranym narzędziu AI do analizy kodu.
3. Poproś o audyt, np.: *"Przeanalizuj ten kod pod kątem bezpieczeństwa i prywatności danych. Sprawdź, dokąd wysyłane są dane, czy są ślady złośliwego kodu oraz podatności typu prompt injection."*

To kilka minut pracy, a dają pełną kontrolę nad tym, co serwer faktycznie robi, zanim zaufasz mu instalując go na swoim urządzeniu.

Jeśli chcesz lepiej zrozumieć serwery MCP i dowiedzieć się, jak działają oraz jakie zagrożenia za sobą niosą, polecamy szkolenie r.pr. Michała Pietrzyka (AI Lead, Kancelaria JDP) "Claude AI w pracy prawnika" — mec. Pietrzyk ma tam spory blok poświęcony właśnie tej kwestii: [Claude AI w pracy prawnika – warsztaty online](https://prawnikwit.pl/claude-w-pracy-prawnika-warsztaty-online/).

## Co potrafi ten serwer MCP?

- **Pełnotekstowe wyszukiwanie** w decyzjach UODO — kary administracyjne, upomnienia, nakazy dostosowania przetwarzania do RODO
- **Filtrowanie** po sygnaturze (`DKN`, `DS`, `DKE`, …) i zakresie dat
- **Pobieranie pełnej treści decyzji** — metadane, sentencja/decyzja i pełne uzasadnienie
- **Bogate metadane** — kategorie tematyczne, podstawy prawne (artykuły RODO, ustawy krajowe, orzecznictwo), Prezes wydający decyzję, status publikacji
- **Lokalne archiwum** — w trybie stdio każda pobrana decyzja zapisuje się jako plik `.md` do `~/Documents/uodo-orzeczenia` (zmienisz przez zmienną środowiskową `UODO_OUTPUT_DIR`) do dalszej pracy offline
- **Cache w pamięci** (15 minut) ograniczający liczbę zapytań do API
- **Ochrona przed zawieszeniem** — 15-sekundowy limit czasu na każde zapytanie do API
- **Dwa tryby pracy** — stdio do lokalnego użytku w Claude Desktop, HTTP do wdrożenia zdalnego/hostowanego (patrz [Dla programistów](#dla-programistów))

## Instalacja (Claude Desktop)

**Krok 1.** Zainstaluj [Node.js](https://nodejs.org) w wersji 20 lub nowszej.

**Krok 2.** Otwórz plik konfiguracyjny Claude Desktop:
- Windows: `Win + R` → wpisz `%APPDATA%\Claude` → otwórz `claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Krok 3.** Dodaj poniższy wpis do sekcji `mcpServers` (jeśli plik jest pusty, wklej całość):

```json
{
  "mcpServers": {
    "UODO": {
      "command": "npx",
      "args": ["-y", "@thescalablelegalmarketer/uodo-mcp"]
    }
  }
}
```

**Krok 4.** Zapisz plik i zrestartuj Claude Desktop. Przy pierwszym uruchomieniu Claude sam pobierze serwer — nie trzeba nic dodatkowo instalować.

Klucz API nie jest potrzebny — API portalu UODO jest publicznie dostępne.

## Przykładowe zapytania

```
Wyszukaj w bazie UODO 5 decyzji dotyczących niezgłoszenia naruszenia
ochrony danych w terminie 72 godzin. Dla każdej podaj:
- sygnaturę i datę decyzji
- sentencję (dosłowny cytat)
- wysokość nałożonej kary
- główny argument Prezesa UODO
```

```
Znajdź decyzje UODO dotyczące sektora mieszkaniowego (wspólnoty
mieszkaniowe, spółdzielnie). Jakie naruszenia RODO były najczęstsze
i jakie kary były nakładane?
```

```
Pobierz decyzję DKN.5131.16.2025 i przeanalizuj, jakie kryteria
Prezes UODO zastosował przy ustalaniu wysokości kary pieniężnej.
```

## Narzędzia (Tools)

### `uodo_search_decisions`

Wyszukuje decyzje UODO. Wyniki sortowane od najnowszych. Wszystkie parametry opcjonalne.

| Parametr | Typ | Opis |
|-----------|------|-------------|
| `query` | string | Wyszukiwanie pełnotekstowe w treści decyzji, np. `kara pieniężna naruszenie` |
| `caseNumber` | string | Fragment sygnatury, np. `DKN.5131` lub `DS.523` |
| `dateFrom` | string | Format `RRRR-MM-DD` — data ogłoszenia od |
| `dateTo` | string | Format `RRRR-MM-DD` — data ogłoszenia do |
| `count` | number | Maks. 100, domyślnie 20 |
| `from` | number | Przesunięcie stronicowania, licząc od 0 |

**Wskazówka:** sygnatury mają postać `DKN.5131.X.RRRR` (postępowania w sprawie kar), `DS.523.X.RRRR` (postępowania skargowe), `DKE.561.X.RRRR` (postępowania kontrolne). Prefiks typu `DKN.5131` zwróci wszystkie decyzje danego rodzaju postępowania.

### `uodo_get_decision`

Pobiera pełną decyzję po ID. Zwraca metadane, dosłowną sentencję/decyzję i pełne uzasadnienie. W trybie stdio dodatkowo zapisuje plik `.md` do `UODO_OUTPUT_DIR`.

| Parametr | Typ | Opis |
|-----------|------|-------------|
| `id` | string | **Wymagany.** ID decyzji z wyników `uodo_search_decisions`, np. `PublicDocument-20260407-000000-000-abc123` |

### `uodo_list_search_fields`

Zwraca listę dostępnych pól wyszukiwania wraz z ich typami danych. Przydaje się przy budowaniu bardziej złożonych zapytań.

## Znane ograniczenia

- **Limit terminów w wyszukiwaniu OR** — przy wyszukiwaniu wielu terminów rozdzielonych przecinkiem bardzo szerokie zapytania mogą przekroczyć limit długości URL; w razie problemu podziel zapytanie na kilka osobnych wywołań
- **Puste pola `title_pl`/`keywords` w wynikach wyszukiwania** — indeks portalu UODO obecnie ich nie uzupełnia; pełne metadane (w tym kategorie tematyczne) są dostępne dopiero po pobraniu konkretnej decyzji przez `uodo_get_decision`
- **Cache w pamięci** — 15 minut TTL, czyści się przy restarcie procesu
- **Tryb HTTP** nie zapisuje plików `.md` (brak dostępu do systemu plików użytkownika)

## O UODO

*Urząd Ochrony Danych Osobowych* to polski organ nadzorczy w rozumieniu art. 51 RODO. Prezes UODO wydaje wiążące decyzje w postępowaniach dotyczących naruszeń ochrony danych osobowych — w tym kary administracyjne (art. 83 RODO), upomnienia (art. 58 ust. 2 lit. a), nagany (art. 58 ust. 2 lit. b) oraz nakazy dostosowania przetwarzania do przepisów.

Portal [orzeczenia.uodo.gov.pl](https://orzeczenia.uodo.gov.pl) publikuje pełne treści tych decyzji. API portalu jest publicznie dostępne, bez uwierzytelniania.

## Zastrzeżenie

To narzędzie służy wyłącznie do wyszukiwania i analizy orzecznictwa — nie stanowi porady prawnej i jej nie zastępuje. Zawsze weryfikuj cytaty względem źródła pierwotnego (portalu UODO) przed użyciem ich w piśmie procesowym, opinii prawnej czy dokumentacji compliance.

## Dla programistów

### Rozwój

```bash
npm run dev          # serwer stdio (TypeScript, bez builda)
npm run dev:http     # serwer HTTP na porcie 3000
npm run build        # type-check + bundlowanie esbuild → dist/
npm run start        # uruchomienie skompilowanego bundla stdio
npm run start:http   # uruchomienie skompilowanego serwera HTTP
```

### Wdrożenie

Build i uruchomienie przez Docker:

```bash
docker build -t uodo-mcp .
docker run -p 3000:3000 uodo-mcp
```

Endpoint MCP: `http://localhost:3000/mcp`
Health check: `http://localhost:3000/health`

Do wdrożenia nadaje się dołączony `Dockerfile` — np. na Railway, Render lub Fly.io.

### Struktura projektu

```
uodo-mcp/
├── src/
│   ├── types.ts        ← interfejsy TypeScript dla API UODO
│   ├── api.ts          ← klient API UODO + cache w pamięci
│   ├── format.ts       ← parsowanie HTML, formatowanie tekstu, zapis plików
│   ├── server.ts       ← fabryka createMcpServer() — rejestracja narzędzi
│   ├── index.ts        ← punkt wejścia dla trybu stdio
│   └── http-server.ts  ← punkt wejścia dla trybu HTTP + endpoint /health
├── dist/               ← wynik builda (gitignored)
│   ├── index.js        ← bundle stdio (z shebangiem #!/usr/bin/env node)
│   └── http-server.js  ← bundle HTTP
├── build.mjs           ← konfiguracja esbuild (dwa buildy równolegle)
├── tsconfig.json       ← tylko type-check (noEmit), bundlowanie przez esbuild
├── server.json         ← manifest dla marketplace MCP
├── Dockerfile          ← multi-stage build → obraz z http-server.js
└── package.json
```

## Licencja

Apache-2.0 © [Paweł Ojdowski](https://afterlegal.pl/) — pełna treść w pliku [LICENSE](LICENSE), informacja o autorstwie w [NOTICE](NOTICE).

Możesz kopiować, modyfikować i wykorzystywać ten kod, także komercyjnie, pod warunkiem zachowania powyższych plików i oznaczenia wprowadzonych zmian.
