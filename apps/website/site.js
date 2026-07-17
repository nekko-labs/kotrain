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

  // ---- highlight the download card matching the visitor's OS ----
  const ua = navigator.userAgent;
  const os = /Win/.test(ua) ? 'win' : /Mac/.test(ua) ? 'mac' : /Linux|X11/.test(ua) ? 'linux' : null;
  if (os) {
    const card = document.querySelector(`.dl[data-os="${os}"]`);
    if (card) card.style.borderColor = 'var(--accent)';
  }
})();
