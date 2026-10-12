# Marco Ching portfolio

Static site served by GitHub Pages at https://kingmaching.github.io.

- `index.html` holds all the text. Search for `EDIT:` to find each section.
- `styles.css` holds colours (top of file, light and dark), fonts and layout.
- `arm.js` draws the interactive 3D robot arm in the hero with Three.js (loaded from cdnjs).
  If WebGL is unavailable it shows `robotic-crane-photos.png` instead.
- `script.js` runs the project filter chips (deep-linkable as `#design`, `#research`, `#ai`)
  and the copy-email button.

To add a project image, add an `<img class="project-img" ...>` as the first child of the
project's `<article>` (copy the one in the Robotic Crane project).
