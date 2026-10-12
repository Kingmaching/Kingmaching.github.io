# Marco Ching portfolio

Static site served by GitHub Pages at https://kingmaching.github.io.

- `index.html` holds all the text. Search for `EDIT:` to find each section.
- `styles.css` holds colours (top of file, light and dark), fonts, layout and the frosted
  "liquid glass" panels (`.glass`).
- `story.js` holds the ME 572 data (from `ME572_All_Project_Data.xlsx`), draws the charts inside
  the scroll captions, and fills the stage readout. Edit numbers in its `DATA` object.
- `building.js` draws the scroll-driven 3D building with Three.js (loaded from cdnjs). The six
  scroll steps in `index.html` (`.step`) line up with the six camera keyframes in `KEYS`, and
  the scene reads the current simulation run from `story.js`.
- `script.js` runs the copy-email button.
- `Marco_Ching_Resume.pdf` is an export of the Google Doc "Marco Ching's CV".

## Adding images

No project images are attached. To add one, put the file in the repo root and add an image as
the first line inside the project's `<article class="project">`:

    <img class="project-img" src="your-image.jpg" alt="What the image shows">

and add this rule to `styles.css`:

    .project-img { width: 100%; border-radius: 14px; margin-bottom: 6px; }
