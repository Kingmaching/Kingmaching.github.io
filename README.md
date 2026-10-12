# Marco Ching portfolio

Static site served by GitHub Pages at https://kingmaching.github.io.

- `index.html` holds all the text. Search for `EDIT:` to find each section.
- `styles.css` holds the palette (top of file), fonts and layout. One fixed look: harbour-night and
  warm-paper bands, neon pink accent, MTR line colours for the route map.
- `story.js` holds the ME 572 data and draws the hero charts.
- `building.js` draws the scroll-driven 3D scene with Three.js (cdnjs): the tower with planted fins,
  sky gardens and a lit crown; parks, roads, cars and people; a stylised Hong Kong skyline across the
  harbour; and a night → day → sunset sky.
- `sections.js` runs everything below the hero: statement reveal, sliding tabs, the six project demos
  (envelope chart, lighting plan, seismic schematic, pitch model, crane, suspension), the MTR route,
  the toolbox, the contact form and Lenis smooth scrolling (jsDelivr).
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

## Contact form

Messages are sent through Web3Forms to marcokingching@gmail.com using the access key in
`data-access-key` on `<form id="mail-form">` in `index.html` (the key is designed to be public).
If the key is removed, the form falls back to opening the visitor's email app with the message filled in.

## Adding photos

Each project's demo sits in a `<div class="demo">`. To add a photo above it, put the file in the
repo root and add `<img class="proj-photo" src="your-image.jpg" alt="…">` inside `.proj-info`,
then style `.proj-photo { border-radius: 16px; }`.
