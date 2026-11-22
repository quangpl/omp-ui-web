import { marked } from 'marked';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://omp-ui.quang.asia';
const GH = 'https://github.com/quangpl/omp-ui';

const GROUPS = [
  ['Start', [['', 'Overview', 'README.md']]],
  ['Guides', [
    ['advanced', 'Advanced', 'ADVANCED.md'],
    ['cluster', 'Cluster mode', 'CLUSTER.md'],
    ['task-cleanup', 'Task cleanup', 'TASK-CLEANUP.md'],
  ]],
  ['Reference', [
    ['api', 'REST API', 'API.md'],
    ['changelog', 'Changelog', 'CHANGELOG.md'],
  ]],
];
const pages = GROUPS.flatMap(([group, items]) => items.map(([slug, title, file]) => ({ group, slug, title, file })));
const bySrc = Object.fromEntries(pages.map((p) => [p.file, p]));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const slugify = (s) => s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
const url = (p) => (p.slug ? `${p.slug}/` : '');
// Prefix from a page's directory back to docs/.
const up = (p) => (p.slug ? '../' : '');
const to = (from, q) => up(from) + url(q) || './';

function render(p) {
  let md = readFileSync(join(root, 'docs-src', p.file), 'utf8');
  md = md.replace(/^# .*\n/m, '').replace(/^\[!\[.*\n/gm, '');
  let html = marked.parse(md, { gfm: true });

  const ids = new Set();
  const toc = [];
  html = html.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (_, tag, inner) => {
    let id = slugify(text(inner)) || 'section';
    for (let n = 2, base = id; ids.has(id); n++) id = `${base}-${n}`;
    ids.add(id);
    if (tag === 'h2') toc.push([id, text(inner)]);
    return `<${tag} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to section">#</a>${inner}</${tag}>`;
  });

  html = html.replace(/(href|src)="([^"]*)"/g, (m, attr, v) => {
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(v)) return m;
    const [path, hash] = v.split('#');
    if (attr === 'src' || /(^|\/)images\//.test(path)) return `${attr}="${up(p)}images/${basename(path)}"`;
    const target = bySrc[basename(path)];
    if (target) return `${attr}="${to(p, target)}${hash ? '#' + hash : ''}"`;
    if (attr === 'href' && path) return `href="${GH}/blob/main/${posix.join(p.file === 'README.md' || p.file === 'CHANGELOG.md' ? '' : 'docs', path)}${hash ? '#' + hash : ''}"`;
    return m;
  });
  html = html.replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, '</table></div>');

  let lead = '';
  html = html.replace(/^\s*<p>([\s\S]*?)<\/p>/, (_, inner) => ((lead = inner), ''));
  return { html, lead, toc };
}

const icon = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';

function template(p, i) {
  const { html, lead, toc } = render(p);
  const u = up(p);
  const prev = pages[i - 1], next = pages[i + 1];
  const nav = (cur) => `<nav class="doc-nav" aria-label="Documentation">
    <p class="doc-label">Documentation</p>
    ${GROUPS.map(([g, items]) => `<p class="doc-group">${g}</p><ul>${items.map(([slug, title]) => {
      const t = pages.find((x) => x.slug === slug);
      return `<li><a href="${to(p, t)}"${t === cur ? ' aria-current="page"' : ''}>${title}</a></li>`;
    }).join('')}</ul>`).join('')}
  </nav>`;
  const desc = esc(text(lead).replace(/\s+/g, ' ').slice(0, 160));
  const canonical = `${SITE}/docs/${url(p)}`;
  const n = String(i + 1).padStart(2, '0');
  const link = (q, dir) => q ? `<a class="doc-pn doc-pn-${dir}" href="${to(p, q)}"><span>${dir === 'prev' ? 'Previous' : 'Next'}</span>${dir === 'prev' ? '← ' : ''}${q.title}${dir === 'next' ? ' →' : ''}</a>` : '<span></span>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(p.title)} · OMP-UI docs</title>
  <meta name="description" content="${desc}">
  <meta name="theme-color" content="#09090b">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="OMP-UI">
  <meta property="og:title" content="${esc(p.title)} · OMP-UI docs">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonical}">
  <link rel="icon" type="image/svg+xml" href="${u}../assets/logo.svg">
  <link rel="apple-touch-icon" href="${u}../assets/icon.png">
  <link rel="preload" href="${u}../assets/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${u}../assets/fonts/geist-mono.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${u}../assets/styles.css">
</head>
<body class="bg-bg font-sans text-fg antialiased selection:bg-acc selection:text-acc-ink doc-body">
  <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-acc focus:px-4 focus:py-2 focus:text-acc-ink">Skip to content</a>
  <header class="doc-top">
    <a href="${u}../" class="doc-brand"><img src="${u}../assets/logo.svg" alt="" width="24" height="24">OMP-UI</a>
    <nav aria-label="Primary" class="doc-top-links">
      <a href="${u || './'}" aria-current="page">Docs</a>
      <a href="${GH}" rel="noopener">GitHub ${icon}</a>
    </nav>
  </header>
  <div class="doc-shell">
    <aside class="doc-side">
      <details class="doc-mobile"><summary>Documentation</summary>${nav(p)}</details>
      <div class="doc-desktop">${nav(p)}</div>
    </aside>
    <main id="main" class="doc-main">
      <div class="doc-crumb"><span>§ ${n}&nbsp;&nbsp;${p.group}</span><i aria-hidden="true"></i>${next ? `<a href="${to(p, next)}">${next.title} →</a>` : '<span></span>'}</div>
      <h1>${esc(p.title)}</h1>
      ${lead ? `<p class="doc-lead">${lead}</p>` : ''}
      <div class="doc-grid">
        <article class="doc-prose">
${html}
          <footer class="doc-foot">${link(prev, 'prev')}${link(next, 'next')}</footer>
        </article>
        ${toc.length > 1 ? `<nav class="doc-toc" aria-label="On this page"><p class="doc-label">On this page</p><ul>${toc.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}</ul></nav>` : ''}
      </div>
    </main>
  </div>
</body>
</html>
`;
}

pages.forEach((p, i) => {
  const dir = join(root, 'docs', p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), template(p, i));
});
cpSync(join(root, 'docs-src/images'), join(root, 'docs/images'), { recursive: true });
console.log(`built ${pages.length} docs pages`);
