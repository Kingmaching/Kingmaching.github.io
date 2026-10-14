# Marco Ching portfolio

Static site served by GitHub Pages at https://kingmaching.github.io.

- `index.html` holds all the text. Search for `EDIT:` to find each section. Page order: intro, background
  and what's next over the 3D tower in the early morning, Project 3.1's steps around the tower (morning →
  day → golden hour, all runs side by side as it closes back up), Project 3.2 looking straight down into
  the top floor at night, then projects 3.3 to 3.6, experience, skills, contact.
- `styles.css` holds the palette (top of file), fonts and layout. One bright clear-water look from five
  swatches (celestial blue, May green, yellow-green, pearl aqua, Cal Poly Pomona green); demo panels and
  the toolbox sit in deep green (the `.deep` scope). Display face Readex Pro with a short extrusion on
  the main titles, body Funnel Sans.
- `story.js` holds the ME572 data, draws the hero charts and turns scroll into story progress (−3 to 7).
- `building.js` draws the scroll-driven 3D scene with Three.js (cdnjs): the street-level tower with
  planted fins and sky gardens in the middle of the screen; parks, roads, cars and people that move with
  the scroll; a stylised Hong Kong skyline drawn on a second canvas that CSS blurs so the tower stays in
  focus; and, for Project 3.2, night and the top floor as the 48 × 34 ft office with its luminaires and
  the light they put on the floor. It also measures how wide the tower is on screen so the cards keep clear of it.
- `sections.js` runs everything below the hero: statement reveal, sliding tabs, the project demos
  (envelope chart, lighting meters, seismic schematic, pitch model, crane, suspension), the MTR route,
  the toolbox, the contact form, the top-bar underline that follows the
  section you're in, slide-in reveals and Lenis smooth scrolling (jsDelivr).
- `Marco_Ching_Resume.pdf` is an export of the Google Doc "Marco Ching's CV".

## Where the numbers come from

| Demo | Source |
|---|---|
| Hero charts, envelope chart, runs table | ME572_All_Project_Data.xlsx (Project 2) |
| Lighting room (3D), lighting chart | ME572_All_Project_Data.xlsx (Project 1) |
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
