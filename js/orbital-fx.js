/**
 * Orbital FX — drives the orbital command ring nav (Concept A).
 *
 * dashboard.css already defines every visual state for the ring
 * (boot → fan-in, active bead, magnetic hover, scroll-hide, mode
 * colors) but nothing ever triggered them, because this file was
 * empty. The ring's nodes start at `opacity: 0; scale: 0.35`
 * (`.orbital-nav.orbital-boot .orbital-node`) and only the
 * `.orbital-ready` class plays the fan-in animation that reveals
 * them — with no JS to add that class, the ring simply never showed.
 *
 * This file:
 *   1. Plays the boot animation once, then drops the boot/ready
 *      classes so the ring's normal (idle-pulse, hover, active-halo)
 *      styles take over permanently.
 *   2. Keeps the sliding "bead" and hub color in sync with whichever
 *      page is active (App.navigate already calls OrbitalFX.onNavigate).
 *   3. Auto-hides the ring + status chip on scroll-down and brings
 *      them back on scroll-up / near the top of the page, using the
 *      `.orbital-nav--hidden` / `.status-chip--hidden` classes that
 *      dashboard.css already ships but nothing was toggling.
 *   4. Adds a light pointer-magnetism nudge on hover, using the
 *      `--mag-r` / `--mag-lean` vars dashboard.css already reads.
 */
const OrbitalFX = {
  nav: null,
  ring: null,
  bead: null,
  statusChip: null,
  nodes: [],
  reduceMotion: false,
  lastScrollY: 0,

  init() {
    this.nav = document.getElementById('orbital-nav');
    if (!this.nav) return;
    this.ring = document.getElementById('orbital-ring');
    this.bead = document.getElementById('orbital-bead');
    this.statusChip = document.getElementById('status-chip');
    this.nodes = Array.from(this.nav.querySelectorAll('.orbital-node'));
    this.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    this.boot();
    this.syncBead(this.nav.querySelector('.orbital-node.active') || this.nodes[0], false);
    this.bindMagnetism();
    this.bindScrollHide();
  },

  /** Play the fan-in reveal once, then hand off to the normal (non-boot) styles for good. */
  boot() {
    const settle = () => {
      this.nav.classList.remove('orbital-boot', 'orbital-ready');
    };
    if (this.reduceMotion) {
      settle();
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.nav.classList.remove('orbital-boot');
        this.nav.classList.add('orbital-ready');
        setTimeout(settle, 500); // covers the longest per-node stagger delay + animation length
      });
    });
  },

  /** Called by App.navigate(page) whenever the active page changes. */
  onNavigate(page) {
    if (!this.nav) return;
    const active = this.nodes.find(n => n.dataset.page === page);
    if (!active) return;
    this.nav.dataset.mode = active.dataset.mode || 'home';
    this.syncBead(active, true);
    if (!this.reduceMotion) {
      active.classList.remove('orbital-pop');
      void active.offsetWidth; // restart the animation
      active.classList.add('orbital-pop');
    }
  },

  /** Slide the active-indicator bead to sit behind whichever node is current. */
  syncBead(activeNode, animate) {
    if (!this.bead || !activeNode) return;
    const angle = activeNode.style.getPropertyValue('--a');
    if (angle) this.bead.style.setProperty('--a', angle);
    if (animate && !this.reduceMotion) {
      this.bead.classList.remove('orbital-bead--move');
      void this.bead.offsetWidth;
      this.bead.classList.add('orbital-bead--move');
    }
  },

  /** Subtle pointer-follow nudge: nodes closest to the cursor drift outward slightly. */
  bindMagnetism() {
    if (!this.ring || this.reduceMotion) return;
    const RADIUS = 90;   // px of pointer influence around a node
    const MAX_R = 8;     // px outward nudge at closest approach
    const MAX_LEAN = 5;  // deg of lean at closest approach

    const onMove = (e) => {
      this.nodes.forEach(node => {
        const rect = node.getBoundingClientRect();
        const nx = rect.left + rect.width / 2;
        const ny = rect.top + rect.height / 2;
        const dx = e.clientX - nx;
        const dy = e.clientY - ny;
        const dist = Math.hypot(dx, dy);
        const pull = Math.max(0, 1 - dist / RADIUS);
        if (pull <= 0) {
          node.style.removeProperty('--mag-r');
          node.style.removeProperty('--mag-lean');
          return;
        }
        node.style.setProperty('--mag-r', (pull * MAX_R).toFixed(1) + 'px');
        node.style.setProperty('--mag-lean', (pull * MAX_LEAN * (dx >= 0 ? 1 : -1)).toFixed(1) + 'deg');
      });
    };

    const clear = () => {
      this.nodes.forEach(node => {
        node.style.removeProperty('--mag-r');
        node.style.removeProperty('--mag-lean');
      });
    };

    this.ring.addEventListener('pointermove', onMove);
    this.ring.addEventListener('pointerleave', clear);
  },

  /** Hide the ring + status chip while scrolling down; bring them back on scroll-up or near the top. */
  bindScrollHide() {
    this.lastScrollY = window.scrollY || 0;
    const THRESHOLD = 10;   // px of movement before reacting, avoids jitter
    const TOP_MARGIN = 80;  // always show near the top of the page
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY || 0;
      const delta = y - this.lastScrollY;

      if (y < TOP_MARGIN || delta < -THRESHOLD) {
        this.setHidden(false);
      } else if (delta > THRESHOLD) {
        this.setHidden(true);
      }
      this.lastScrollY = y;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
  },

  setHidden(hidden) {
    if (this.nav) this.nav.classList.toggle('orbital-nav--hidden', hidden);
    if (this.statusChip) this.statusChip.classList.toggle('status-chip--hidden', hidden);
  }
};

window.OrbitalFX = OrbitalFX;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => OrbitalFX.init());
} else {
  OrbitalFX.init();
}