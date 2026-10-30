// Retro desktop touches for the guest site: the animated "working in background" pointer after a click starts
// loading something, :active press states on touch screens, and the player window's full-screen button.
(() => {
  const root = document.documentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer = 0;
  let until = 0;
  let frame = 0;

  function stop() {
    clearInterval(timer);
    timer = 0;
    root.classList.remove("xp-busy");
    root.removeAttribute("data-xp-busy");
  }

  function busy(ms) {
    until = Date.now() + ms;
    root.classList.add("xp-busy");
    if (timer) return;
    const tick = () => {
      if (Date.now() > until) return stop();
      root.setAttribute("data-xp-busy", String(frame));
      if (!still) frame = (frame + 1) % 4;
    };
    tick();
    timer = setInterval(tick, 160);
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    const full = el && el.closest("[data-xp-fullscreen]");
    if (full) {
      const v = document.getElementById(full.getAttribute("data-xp-fullscreen"));
      if (v && v.requestFullscreen) v.requestFullscreen().catch(() => {});
      else if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      return;
    }
    const a = el && el.closest("a[href]");
    if (!a || (a.target && a.target !== "_self")) return;
    const url = new URL(a.href, location.href);
    if (url.hash && url.pathname === location.pathname && url.search === location.search) return; // same-page jump
    busy(a.hasAttribute("download") ? 1200 : 10000);
  });

  document.addEventListener("submit", (e) => {
    if (!e.defaultPrevented) busy(10000);
  });

  // Back/forward restores a cached page: drop the hourglass.
  addEventListener("pageshow", stop);

  // iOS Safari only applies :active styles when a touch listener exists.
  document.addEventListener("touchstart", () => {}, { passive: true });
})();
