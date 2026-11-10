# Defense tech-karta USA

En statisk webbsida som visar defense tech- och hårdvaruproduktionsbolag på en zoombar USA-karta. Inget byggsteg behövs.

## Köra lokalt

`fetch` av `data/companies.json` fungerar inte när man öppnar `index.html` direkt (file://), så starta en enkel server i projektmappen:

```
python -m http.server 8000
```

Öppna sedan http://localhost:8000.

## Filter

- **Kategori** (Produktionsteknik, AI, Vapen, Flyg): OR-logik. Ett bolag visas om någon av dess taggar är ikryssad. Om alla kategorier är avbockade visas inga bolag.
- **Årlig omsättning**: intervall, inte exakta siffror. Värdena är uppskattningar.
- **Visa näraliggande**: döljer bolag med `"adjacent": true` (t.ex. SendCutSend, Xometry, Protolabs) när den är avbockad.

## Lägga till eller ändra bolag

Redigera `data/companies.json`. Varje post ser ut så här:

```json
{ "name": "Exempel AB", "city": "Austin, TX", "lat": 30.27, "lng": -97.74,
  "tags": ["production", "ai"], "revenueBand": "100m-1b", "adjacent": false,
  "description": "Kort beskrivning.", "url": "https://example.com" }
```

- `tags`: `production`, `ai`, `weapons`, `aerospace`. Första taggen styr markörens färg.
- `revenueBand`: `<10m`, `10-100m`, `100m-1b` eller `>1b`.
- `adjacent`: `true` för aktörer som inte är strikt defense.

## Mässor

`data/events.json` innehåller mässor och konferenser (lila rutor på kartan). De påverkas inte av bolagsfiltren och kan döljas med en kryssruta. Fält: `name`, `city`, `lat`, `lng`, `startDate`/`endDate` (`YYYY-MM-DD`, eller `null` om datum saknas), `dateNote`, `description`, `url`. Datumen är hämtade från webbsökning i november 2026, delvis från sammanställningssajter, så kontrollera dem hos arrangören.

## Viktigt om datan

Koordinater (ungefärlig huvudort), omsättningsintervall, taggar och webbadresser är **handkurerade uppskattningar** gjorda utan att kontrollera mot källor. Verifiera dem innan du använder kartan för beslut. Omsättning för privata bolag är sällan publik.
