# Marco Ching portfolio

Static site served by GitHub Pages at https://kingmaching.github.io.

- `index.html` holds all the text. Search for `EDIT:` to find each section.
- `styles.css` holds the palette (top of file), fonts and layout. One fixed look: harbour-night and
  warm-paper bands, neon pink accent, MTR line colours for the route map.
- `story.js` holds the ME 572 data and draws the hero charts.
- `building.js` draws the scroll-driven 3D tower with Three.js (cdnjs).
- `sections.js` runs everything below the hero: counters, statement reveal, the six project demos
  (envelope chart, lighting plan, seismic schematic, pitch model, crane, suspension), the MTR route,
  the Matter.js skill chips (cdnjs), the neon footer and the copy-email button.
- `Marco_Ching_Resume.pdf` is an export of the Google Doc "Marco Ching's CV".

## Where the numbers come from

| Demo | Source |
|---|---|
| Hero charts, envelope chart, runs table | ME572_All_Project_Data.xlsx (Project 2) |
| Lighting plan, lighting chart | ME572_All_Project_Data.xlsx (Project 1) |
| Pitch model | ME 362 report: Table 1 constants, Tables 3–6 inputs, Table 7 MLB ranges |
| Suspension | ME 481 FDR §3.4 and §4.3 (131 N/mm shock, MR 0.316, 263 mm arm, 50 mm travel) |
| Crane | Robotic crane report + CV (51 cm reach, ±5 mm) |
| Seismic schematic | IEEE poster (stations, Cheung Chau, HKO threshold). Traces are illustrative. |

## Adding photos

Each project's demo sits in a `<div class="demo">`. To add a photo above it, put the file in the
repo root and add `<img class="proj-photo" src="your-image.jpg" alt="…">` inside `.proj-info`,
then style `.proj-photo { border-radius: 16px; }`.
