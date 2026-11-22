(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Scroll reveal
  const revealIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el) => revealIO.observe(el));

  // Hero tilt follows the pointer (transform via CSS vars only)
  const stage = $('[data-tilt]');
  if (stage && !reduced && matchMedia('(pointer: fine)').matches) {
    const tilt = $('.tilt', stage);
    let raf;
    $('#top').addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.setProperty('--ry', `${-12 + x * 10}deg`);
        tilt.style.setProperty('--rx', `${6 - y * 8}deg`);
      });
    });
    $('#top').addEventListener('pointerleave', () => { tilt.style.removeProperty('--ry'); tilt.style.removeProperty('--rx'); });
  }

  // Copy to clipboard with feedback
  $$('[data-copy]').forEach((btn) => {
    const hint = $('[data-label]', btn);
    const idle = hint.textContent;
    hint.setAttribute('aria-live', 'polite');
    let t;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try { await navigator.clipboard.writeText(text); }
      catch {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      btn.classList.add('ok'); hint.textContent = 'Copied';
      clearTimeout(t);
      t = setTimeout(() => { btn.classList.remove('ok'); hint.textContent = idle; }, 1600);
    });
  });

  // Install tabs: swap the shown command and what COPY copies
  const instCmd = $('#inst-cmd'), instCopy = $('#inst-copy');
  const tabs = $$('.inst-tabs [data-cmd]');
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((o) => o.setAttribute('aria-pressed', String(o === tab)));
    instCmd.textContent = instCopy.dataset.copy = tab.dataset.cmd;
    instCopy.setAttribute('aria-label', `Copy command: ${tab.dataset.cmd}`);
  }));

  // Section rail: mark the section under the viewport middle
  const railLinks = $$('.rail a');
  const railIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      railLinks.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${e.target.id}`)));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  railLinks.forEach((a) => { const s = $(a.hash); if (s) railIO.observe(s); });

  // Kanban demo: one card walks plan -> build -> review -> ship
  const board = $('#kb');
  if (board) {
    const card = $('#demo-card');
    const meta = $('#demo-meta');
    const log = $('#kb-log');
    const steps = $$('.step');
    const cols = $$('[data-col]', board);
    const base = [1, 1, 1];
    const target = [0, 1, 1, 2];
    const logs = [
      'Write a card and the agent picks it up.',
      'Agent is working in your repo.',
      'Feedback sent. The agent keeps going.',
      'Pull request opened.',
    ];
    const chips = [
      '',
      '<span class="kb-chip"><span class="kb-spin animate-spin-slow"></span>Agent running</span>',
      '<span class="kb-chip"><span class="kb-spin animate-spin-slow"></span>Agent running</span><span class="kb-chip warn">1 comment</span>',
      '<span class="kb-chip">PR opened</span>',
    ];
    let cur = 0, timer;

    const render = (n, animate) => {
      const list = cols[target[n]].lastElementChild;
      const first = card.getBoundingClientRect();
      if (card.parentElement !== list) list.appendChild(card);
      meta.innerHTML = chips[n];
      log.textContent = logs[n];
      cols.forEach((c, i) => { $('[data-count]', c).textContent = base[i] + (i === target[n] ? 1 : 0); });
      steps.forEach((s, i) => { s.classList.toggle('on', i === n); s.setAttribute('aria-pressed', i === n); });
      if (animate && !reduced) {
        const last = card.getBoundingClientRect();
        const dx = first.left - last.left, dy = first.top - last.top;
        if (dx || dy) card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
      cur = n;
    };

    const play = () => { clearInterval(timer); if (!reduced) timer = setInterval(() => render((cur + 1) % 4, true), 2800); };
    steps.forEach((s) => s.addEventListener('click', () => { render(+s.dataset.step, true); play(); }));
    new IntersectionObserver(([e]) => (e.isIntersecting ? play() : clearInterval(timer)), { threshold: 0.3 }).observe(board);
    render(0, false);
  }

  // Terminal typing demo
  const term = $('#term');
  if (term && !reduced) {
    const rows = [...term.children];
    const saved = new Map();
    rows.forEach((r) => { r.hidden = true; });
    $$('.t', term).forEach((t) => { saved.set(t, t.textContent); t.textContent = ''; });
    const caret = $('.caret', term);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const run = async () => {
      for (const r of rows) {
        r.hidden = false;
        const t = $('.t', r);
        if (t) {
          if (caret) r.insertBefore(caret, t.nextSibling);
          for (const ch of saved.get(t)) { t.textContent += ch; await wait(45 + Math.random() * 45); }
          await wait(380);
        } else await wait(160);
      }
    };
    new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); run(); } }, { threshold: 0.4 }).observe(term);
  }
})();
