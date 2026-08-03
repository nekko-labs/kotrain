// Kotrain marketing site: starfield backdrop, scroll reveals, OS highlight.
(function () {
  // ---- drifting starfield (space-travel feel, honors reduced motion) ----
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w, h, stars;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const count = Math.min(320, Math.floor((w * h) / 6500));
    stars = Array.from({ length: count }, () => spawn(true));
  }
  function spawn(anywhere) {
    return {
      // travel outward from a vanishing point slightly above center
      x: (Math.random() - 0.5) * w,
      y: (Math.random() - 0.55) * h,
      z: anywhere ? Math.random() * 1 : 1, // depth 0 (near) .. 1 (far)
      s: 0.4 + Math.random() * 1.4,
    };
  }
  function frame() {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h * 0.42;
    for (const st of stars) {
      if (!reduced) {
        st.z -= 0.0009 * st.s; // drift toward the viewer
        if (st.z <= 0.02) Object.assign(st, spawn(false), { z: 1 });
      }
      const k = 1 / st.z;
      const x = cx + st.x * k * 0.08;
      const y = cy + st.y * k * 0.08;
      if (x < -10 || x > w + 10 || y < -10 || y > h + 10) {
        Object.assign(st, spawn(false), { z: 1 });
        continue;
      }
      const r = Math.min(1.8, st.s * k * 0.045);
      const a = Math.min(0.9, 0.15 + (1 - st.z) * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(226, 238, 248, ${a})`;
      ctx.fill();
    }
    if (!reduced) requestAnimationFrame(frame);
  }
  resize();
  window.addEventListener('resize', resize);
  frame();

  // ---- scroll-driven reveals (IO + a viewport check so the hero shows even
  // where IO/rAF are throttled, e.g. embedded webviews) ----
  const reveals = [...document.querySelectorAll('.reveal')];
  function showInView() {
    const vh = window.innerHeight;
    reveals.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add('in');
    });
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.12 },
    );
    reveals.forEach((el) => io.observe(el));
  }
  window.addEventListener('scroll', showInView, { passive: true });
  showInView();
  window.addEventListener('load', showInView);

  // ---- smart download: default to the visitor's machine, menu for everything else ----
  const RELEASES = 'https://github.com/nekko-labs/kotrain/releases/latest';
  const API = 'https://api.github.com/repos/nekko-labs/kotrain/releases/latest';

  // Each build we publish, with the pattern that finds it in a release's assets.
  // `pick` is what the primary button chooses for a detected os+arch.
  const BUILDS = [
    { os: 'win', label: 'Windows', fmt: '.exe', hint: 'x64 installer', arch: 'x64', match: /-x64\.exe$/i, pick: true },
    { os: 'win', label: 'Windows', fmt: '.msi', hint: 'x64 installer', arch: 'x64', match: /-x64\.msi$/i },
    { os: 'win', label: 'Windows', fmt: '.zip', hint: 'x64 portable', arch: 'x64', match: /-x64\.zip$/i },
    { os: 'mac', label: 'macOS', fmt: '.dmg', hint: 'Apple Silicon', arch: 'arm64', match: /-arm64\.dmg$/i, pick: true },
    { os: 'mac', label: 'macOS', fmt: '.dmg', hint: 'Intel', arch: 'x64', match: /-x64\.dmg$/i, pick: true },
    { os: 'mac', label: 'macOS', fmt: '.zip', hint: 'Apple Silicon', arch: 'arm64', match: /-arm64\.zip$/i },
    { os: 'linux', label: 'Linux', fmt: '.AppImage', hint: 'x86_64, any distro', arch: 'x64', match: /\.AppImage$/i, pick: true },
    { os: 'linux', label: 'Linux', fmt: '.deb', hint: 'Debian, Ubuntu', arch: 'x64', match: /\.deb$/i },
  ];
  const OS_ORDER = ['win', 'mac', 'linux'];
  const OS_NAME = { win: 'Windows', mac: 'macOS', linux: 'Linux' };

  const pick = document.getElementById('dlPick');
  const main = document.getElementById('dlMain');
  const mainTitle = document.getElementById('dlMainTitle');
  const mainSub = document.getElementById('dlMainSub');
  const caret = document.getElementById('dlCaret');
  const menu = document.getElementById('dlMenu');
  const note = document.getElementById('dlNote');
  const heroDl = document.getElementById('heroDl');

  // ---- who's visiting ----
  const uaStr = navigator.userAgent;
  const uaPlat = navigator.userAgentData?.platform || '';
  const touchMac = /Mac/.test(uaStr) && navigator.maxTouchPoints > 1; // iPadOS lies about being a Mac
  const mobile = /Android/i.test(uaStr) || /iPhone|iPad|iPod/i.test(uaStr) || touchMac;
  let os = null;
  if (!mobile) {
    if (/Win/i.test(uaPlat) || /Windows/i.test(uaStr)) os = 'win';
    else if (/mac/i.test(uaPlat) || /Mac OS X/i.test(uaStr)) os = 'mac';
    else if (/linux/i.test(uaPlat) || /Linux|X11|CrOS/i.test(uaStr)) os = 'linux';
  }
  // Apple Silicon is the safe default on modern Macs; refined below where the
  // browser will tell us (Chromium high-entropy hints), or by the WebGL renderer.
  let arch = os === 'mac' ? 'arm64' : 'x64';

  function macIsAppleSilicon() {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
      const r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      if (/Apple\s?(M\d|GPU)/i.test(r)) return true;
      if (/Intel|AMD|Radeon/i.test(r)) return false;
    } catch (_) {}
    return null; // unknown, keep the default
  }

  let assets = null; // name -> browser_download_url, once the API answers
  let version = '';

  function urlFor(build) {
    if (!assets) return RELEASES;
    const hit = Object.keys(assets).find((name) => build.match.test(name));
    return hit ? assets[hit] : null;
  }

  function chosen() {
    if (!os) return null;
    const forOs = BUILDS.filter((b) => b.pick && b.os === os);
    return forOs.find((b) => b.arch === arch) || forOs[0] || null;
  }

  function renderMain() {
    const b = chosen();
    if (!b) {
      mainTitle.textContent = 'Download Kotrain';
      mainSub.textContent = mobile ? 'Desktop app, then pair this phone' : 'Latest release on GitHub';
      main.href = RELEASES;
      if (note) {
        note.textContent = mobile
          ? 'Kotrain runs on your computer. Install it there, then pair this phone to it over the encrypted relay.'
          : 'Pick a build from the menu, or see them all on GitHub Releases.';
      }
      return;
    }
    const href = urlFor(b);
    mainTitle.textContent = `Download for ${OS_NAME[b.os]}`;
    mainSub.textContent = `${b.fmt} · ${b.hint}${version ? ` · ${version}` : ''}`;
    main.href = href || RELEASES;
    if (note) note.textContent = 'Not your machine? Use the arrow for every other build.';
    if (heroDl) heroDl.textContent = `Download for ${OS_NAME[b.os]}`;
  }

  function renderMenu() {
    menu.textContent = '';
    const current = chosen();
    let wrote = false;
    for (const key of OS_ORDER) {
      const builds = BUILDS.filter((b) => b.os === key).filter((b) => !assets || urlFor(b));
      if (!builds.length) continue;
      const head = document.createElement('div');
      head.className = 'dl-group';
      head.textContent = OS_NAME[key];
      menu.appendChild(head);
      for (const b of builds) {
        const a = document.createElement('a');
        a.className = 'dl-item';
        a.href = urlFor(b) || RELEASES;
        a.setAttribute('role', 'menuitem');
        if (b === current) a.setAttribute('aria-current', 'true');
        a.innerHTML =
          `<span class="dl-fmt">${b.fmt}</span><span class="dl-hint">${b.hint}</span>`;
        menu.appendChild(a);
        wrote = true;
      }
    }
    if (wrote) {
      const sep = document.createElement('div');
      sep.className = 'dl-sep';
      menu.appendChild(sep);
    }
    const all = document.createElement('a');
    all.className = 'dl-item';
    all.href = RELEASES;
    all.setAttribute('role', 'menuitem');
    all.innerHTML = `<span class="dl-fmt">All downloads</span><span class="dl-hint">GitHub Releases</span>`;
    menu.appendChild(all);
  }

  function render() {
    renderMain();
    renderMenu();
  }

  // ---- menu open/close ----
  function setOpen(open) {
    menu.hidden = !open;
    pick.classList.toggle('open', open);
    caret.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('.dl-item')?.focus();
  }
  const isOpen = () => !menu.hidden;

  if (pick) {
    render();
    caret.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!isOpen());
    });
    document.addEventListener('click', (e) => {
      if (isOpen() && !pick.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        caret.focus();
      }
    });
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...menu.querySelectorAll('.dl-item')];
      const i = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
      items[(next + items.length) % items.length].focus();
    });
    menu.addEventListener('click', () => setOpen(false));

    // refine the Mac arch guess, then swap in real asset URLs when they arrive
    if (os === 'mac') {
      const hints = navigator.userAgentData?.getHighEntropyValues?.(['architecture']);
      if (hints) {
        hints
          .then((v) => {
            if (v.architecture) arch = /arm/i.test(v.architecture) ? 'arm64' : 'x64';
            render();
          })
          .catch(() => {});
      } else {
        const silicon = macIsAppleSilicon();
        if (silicon !== null) arch = silicon ? 'arm64' : 'x64';
      }
    }

    fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rel) => {
        assets = Object.fromEntries(
          (rel.assets || []).map((a) => [a.name, a.browser_download_url]),
        );
        version = rel.tag_name || '';
        render();
      })
      .catch(() => {
        /* offline or rate-limited: the static links to /releases/latest still work */
      });
  }
})();
