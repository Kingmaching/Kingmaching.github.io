# Marco Ching portfolio

Static site served by GitHub Pages at https://kingmaching.github.io.

- `index.html` holds all the text. Search for `EDIT:` to find each section.
- `styles.css` holds colours (top of file, light and dark), fonts, layout and the frosted
  "liquid glass" panels (`.glass`).
- `building.js` draws the scroll-driven 3D building with Three.js (loaded from cdnjs). The five
  scroll steps in `index.html` (`.step`) line up with the five camera keyframes in `KEYS`.
- `script.js` runs the copy-email button.
- `Marco_Ching_Resume.pdf` is an export of the Google Doc "Marco Ching's CV".

## Adding images

No project images are attached. To add one, put the file in the repo root and add an image as
the first line inside the project's `<article class="project">`:

    <img class="project-img" src="your-image.jpg" alt="What the image shows">

and add this rule to `styles.css`:

    .project-img { width: 100%; border-radius: 14px; margin-bottom: 6px; }
