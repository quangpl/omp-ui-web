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

`.github/workflows/pages.yml` publishes `index.html` and `assets/` to GitHub Pages on every push to `main`. In the repo, set **Settings > Pages > Source** to **GitHub Actions**. The site is served at https://omp-ui.quang.asia (the `CNAME` file sets the custom domain; DNS has a CNAME record for `omp-ui` pointing to `quangpl.github.io`).

Screenshots in `assets/` come from `docs/images` in the OMP-UI repo.
