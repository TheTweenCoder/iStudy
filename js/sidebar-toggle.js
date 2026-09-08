/**
 * Sidebar collapse toggle
 * Independent of the app's existing "hideNavbar" preference (which also
 * hides the topbar) — this only collapses the sidebar itself, and the
 * topbar's reveal button stays usable so getting the sidebar back is
 * always one click away. State persists in localStorage across visits.
 */
(function () {
  var STORAGE_KEY = 'studyApp_sidebarCollapsed';
  var body = document.body;

  function apply(collapsed) {
    body.classList.toggle('sidebar-collapsed', collapsed);
    var collapseBtn = document.getElementById('sidebar-collapse-btn');
    var revealBtn = document.getElementById('sidebar-reveal-btn');
    var label = collapsed ? 'Show sidebar' : 'Hide sidebar';
    if (collapseBtn) {
      collapseBtn.title = label;
      collapseBtn.setAttribute('aria-label', label);
    }
    if (revealBtn) {
      revealBtn.setAttribute('aria-hidden', collapsed ? 'false' : 'true');
    }
  }

  function toggle() {
    var collapsed = !body.classList.contains('sidebar-collapsed');
    apply(collapsed);
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch (e) {}
  }

  function init() {
    var stored = false;
    try { stored = localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) {}
    apply(stored);

    var collapseBtn = document.getElementById('sidebar-collapse-btn');
    var revealBtn = document.getElementById('sidebar-reveal-btn');
    if (collapseBtn) collapseBtn.addEventListener('click', toggle);
    if (revealBtn) revealBtn.addEventListener('click', toggle);

    // Keyboard shortcut: [ to toggle, matching common editor conventions
    document.addEventListener('keydown', function (e) {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        var tag = (e.target && e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
        toggle();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();