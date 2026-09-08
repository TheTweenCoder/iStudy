/**
 * Liquid Glass Parallax — subtle 3D spatial layering on scroll
 * Sets --depth (roughly -1 at the top edge of the viewport to +1 at the
 * bottom) on each glass panel as it scrolls through, which the CSS turns
 * into a small lift + tilt via the shared perspective on .content-area.
 * rAF-throttled, re-queries panels on scroll (cheap for the handful of
 * cards a single page shows) and skips entirely under reduced-motion.
 */
(function () {
  var SELECTOR = '.card, .suggest-card, .pomodoro-widget, .task-card, .auth-card';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  var ticking = false;

  function update() {
    ticking = false;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var els = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var rect = el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > vh + 200) continue; // skip far offscreen
      var center = rect.top + rect.height / 2;
      var depth = (center - vh / 2) / (vh / 2); // -1 (top) .. 0 (center) .. 1 (bottom)
      if (depth > 1) depth = 1;
      if (depth < -1) depth = -1;
      el.style.setProperty('--depth', depth.toFixed(3));
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  document.addEventListener('DOMContentLoaded', update);
  // App re-renders pages via innerHTML swaps that don't fire scroll —
  // recompute shortly after any click on nav/tabs so new panels get a value.
  document.addEventListener('click', function () {
    setTimeout(update, 50);
  }, { passive: true });

  update();
})();