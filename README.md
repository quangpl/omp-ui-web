# omp-ui-web

Landing page for [OMP-UI](https://github.com/quangpl/omp-ui), the self-hosted kanban web UI for the omp coding agent.

Plain static site: `index.html`, `assets/main.js` and a committed `assets/styles.css`. No framework. Tailwind v4 is only used at build time.

## Develop

```sh
npm install
npm run dev      # rebuilds assets/styles.css on change
python3 -m http.server 8000   # in a second terminal, then open http://localhost:8000
```

## Build

```sh
npm run build    # writes the minified assets/styles.css
```

Commit `assets/styles.css` after changing `index.html` or `src/input.css`; the page deploys as-is.

## Deploy

`.github/workflows/pages.yml` publishes `index.html` and `assets/` to GitHub Pages on every push to `main`. In the repo, set **Settings > Pages > Source** to **GitHub Actions**. The site is then at `https://quangpl.github.io/omp-ui-web/` (the Open Graph image URLs in `index.html` assume this; change them if you use a custom domain).

Screenshots in `assets/` come from `docs/images` in the OMP-UI repo.
