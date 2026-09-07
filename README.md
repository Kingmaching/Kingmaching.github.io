# Marco Ching Engineering Portfolio

A responsive static portfolio website built with plain HTML, CSS, and JavaScript.

## Files

- `index.html` — site content
- `styles.css` — layout and visual design
- `script.js` — mobile navigation and scroll-in animations
- `assets/` — project images and favicon
- `Marco_Ching_Resume.pdf` — resume linked from the site

## Preview locally

Open `index.html` directly in your browser.

For the most reliable local preview, run a small local server from this folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish for free

### GitHub Pages
1. Create a new GitHub repository.
2. Upload all files in this folder to the repository root.
3. In the repository, open **Settings → Pages**.
4. Set the source to **Deploy from a branch**, choose `main` and `/root`.
5. GitHub will provide your public portfolio URL.

### Netlify
Drag the entire portfolio folder into Netlify's site deploy page.

### Vercel
Create a new Vercel project from the GitHub repository. No build command is needed for this static site.

## What to update later

When your Chevalier experience is complete, add it as the newest `.timeline-item` inside the `#experience` section in `index.html`.

You can also add new projects by duplicating one of the `<article class="project">...</article>` blocks.


## Version 2 additions

- Full LinkedIn project archive
- Awards section
- Engineering-relevant certifications
- Navigation links for the expanded portfolio
- LinkedIn-derived earthquake project date aligned to 2021
