/**
 * Main Application Controller
 */

const App = {
  currentPage: 'dashboard',

  init() {
    try {
      if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
      }

      this.applyCustomization();
      this.bindNavigation();
      this.bindGlobalEvents();
      this.updateDateTime();
      setInterval(() => this.updateDateTime(), 1000);

      if (typeof Pomodoro !== 'undefined') Pomodoro.init();
    this.updateStatusChip();
      this.navigate('dashboard');
      try { this.checkReminders(); } catch (e) { console.warn('reminders', e); }
      this.updateTopbarAvatar();
    } catch (err) {
      console.error('App init failed', err);
      const area = document.querySelector('.content-area');
      if (area) {
        area.innerHTML = '<div class="card" style="margin:2rem 0"><h2>Something went wrong</h2><p class="text-secondary" style="margin:0.75rem 0">' + (err && err.message ? err.message : err) + '</p><button class="btn btn-primary" onclick="location.reload()">Reload</button> <button class="btn btn-secondary" onclick="localStorage.clear();location.href=\'login.html\'">Reset data & log in</button></div>';
      }
    }
  },

  applyTheme() {
    this.applyCustomization();
  },

  applyCustomization() {
    const data = Storage.getUserData();
    if (!data) return;
    const p = data.profile.preferences || {};

    const theme = p.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    // Accent: only apply custom if user set one; otherwise use theme defaults (minimal mono)
    if (p.accentColor && p.accentColor !== '#6366f1' && p.accentColor !== 'default') {
      this.setAccentColor(p.accentColor);
    } else {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-hover');
      document.documentElement.style.removeProperty('--accent-light');
    }

    document.body.classList.toggle('reduce-motion', p.animations === false || p.reducedMotion === true);
    document.body.classList.toggle('compact-mode', !!p.compactMode);
    document.body.classList.toggle('nav-hidden', !!p.hideNavbar);
  },

  toggleNavbar() {
    const data = Storage.getUserData();
    if (!data) return;
    if (!data.profile.preferences) data.profile.preferences = {};
    data.profile.preferences.hideNavbar = !data.profile.preferences.hideNavbar;
    Storage.saveUserData(data);
    document.body.classList.toggle('nav-hidden', !!data.profile.preferences.hideNavbar);
    const cb = document.getElementById('pref-hide-nav');
    if (cb) cb.checked = !!data.profile.preferences.hideNavbar;
  },

  setAccentColor(hex) {
    const root = document.documentElement;
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-hover', this.shadeColor(hex, -12));
    // Light tint for backgrounds
    root.style.setProperty('--accent-light', this.hexToRgba(hex, 0.12));
  },

  shadeColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(2.55 * percent)));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + Math.round(2.55 * percent)));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + Math.round(2.55 * percent)));
    return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  hexToRgba(hex, alpha) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

    toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  },
  
  toggleTheme() {
    const data = Storage.getUserData();
    if (!data) return;
    if (!data.profile.preferences) data.profile.preferences = {};
    const current = data.profile.preferences.theme || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    data.profile.preferences.theme = next;
    Storage.saveUserData(data);
    document.documentElement.setAttribute('data-theme', next);
    const themeSelect = document.getElementById('pref-theme');
    if (themeSelect) themeSelect.value = next;
  },

  updateTopbarAvatar() {
    const profile = Auth.getProfile();
    const name = profile?.name || Storage.getCurrentUser() || 'S';
    const el = document.getElementById('topbar-avatar');
    if (el) el.textContent = name.charAt(0).toUpperCase();
  },

  animateValue(el, end, duration = 600, decimals = 0) {
    if (!el) return;
    const data = Storage.getUserData();
    if (data?.profile?.preferences?.animations === false) {
      el.textContent = typeof end === 'number' ? end.toFixed(decimals) : end;
      return;
    }
    const start = 0;
    const startTime = performance.now();
    const isNum = typeof end === 'number';
    const target = isNum ? end : parseFloat(end) || 0;

    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (target - start) * eased;
      el.textContent = decimals > 0 ? current.toFixed(decimals) : Math.round(current);
      if (t < 1) requestAnimationFrame(tick);
      else {
        el.textContent = isNum && decimals > 0 ? target.toFixed(decimals) : (isNum ? Math.round(target) : end);
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
    };
    requestAnimationFrame(tick);
  },

  bindNavigation() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const page = el.getAttribute('data-page');
        this.navigate(page);
        // Close mobile sidebar
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
      });
    });

    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebar-overlay')?.classList.toggle('active');
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('active');
    });
  },

  bindGlobalEvents() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());
  },


  updateStatusChip() {
    const data = Storage.getUserData();
    const av = document.getElementById('status-avatar');
    const nameEl = document.getElementById('status-name');
    const streakEl = document.getElementById('status-streak');
    const nextEl = document.getElementById('status-next');
    if (!data) return;

    const name = data.profile?.name || data.username || 'Student';
    const initial = (name.trim()[0] || 'S').toUpperCase();
    if (av) av.textContent = initial;
    if (nameEl) nameEl.textContent = name.split(' ')[0];
    const streak = data.statistics?.studyStreak || 0;
    if (streakEl) streakEl.textContent = streak === 1 ? '1 day streak' : `${streak} day streak`;

    // Closest upcoming deadline among tasks / exams / sport events
    let best = null;
    const consider = (title, date, page, extra) => {
      if (!date) return;
      const d = new Date(date + 'T12:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      if (d < today) return;
      const days = Math.round((d - today) / 86400000);
      if (!best || days < best.days) best = { title, date, days, page, extra };
    };

    (data.assignments || []).forEach(t => {
      if (t.status === 'Completed') return;
      consider(t.title, t.dueDate, 'tasks');
    });
    (data.calendarEvents || []).forEach(e => {
      if (e.completed) return;
      if (['exam', 'test'].includes(e.type)) consider(e.title, e.date, 'schedule');
    });
    if (typeof Hobbies !== 'undefined' && Hobbies.getClosestEvent) {
      const se = Hobbies.getClosestEvent(30);
      if (se) consider(se.title, se.date, 'hobbies');
    }

    if (nextEl) {
      if (!best) {
        nextEl.textContent = 'All clear';
        nextEl.onclick = () => this.navigate('dashboard');
      } else {
        const when = best.days === 0 ? 'today' : best.days === 1 ? 'tomorrow' : `in ${best.days}d`;
        nextEl.textContent = `${best.title} · ${when}`;
        nextEl.onclick = () => this.navigate(best.page);
      }
    }

    // Sync topbar avatar if present
    const topAv = document.getElementById('topbar-avatar');
    if (topAv) topAv.textContent = initial;
  },

  focusGlobalSearch() {
    const input = document.getElementById('global-search') || document.querySelector('input[type="search"], .search-input, #search-input');
    if (input) {
      input.focus();
      input.select?.();
    } else if (typeof this.openSearch === 'function') {
      this.openSearch();
    } else {
      this.toast('Press / or use search in the top bar', 'info');
    }
  },

  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) {
      pageEl.classList.add('active');
      // Re-trigger stagger on dashboard grid
      const grid = pageEl.querySelector('.dashboard-grid');
      if (grid) {
        grid.classList.remove('stagger-children');
        void grid.offsetWidth;
        grid.classList.add('stagger-children');
      }
    }

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.orbital-node').forEach(n => n.classList.remove('active'));
    document.querySelectorAll(`[data-page="${page}"]`).forEach(n => n.classList.add('active'));
    this.updateStatusChip();
    if (window.OrbitalFX && typeof OrbitalFX.onNavigate === 'function') {
      try { OrbitalFX.onNavigate(page); } catch (e) { console.warn('OrbitalFX', e); }
    }

    const titles = {
      dashboard: 'Dashboard',
      schedule: 'Schedule',
      tasks: 'Tasks',
      grades: 'Grades',
      study: 'Study',
      hobbies: 'Sports & Hobbies',
      profile: 'Profile'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[page] || page;

    const renderers = {
      dashboard: () => this.renderDashboard(),
      schedule: () => { this.renderCalendar(); this.renderSchoolSchedule(); this.renderPlanner(); },
      tasks: () => this.renderTasks(),
      grades: () => this.renderGrades(),
      study: () => { this.renderPomodoroPage(); this.renderActiveRecall(); this.renderSessions(); },
      hobbies: () => { this.renderHobbies(); this.renderSportEvents(); },
      profile: () => this.renderProfile()
    };
    if (renderers[page]) {
      try { renderers[page](); } catch (err) {
        console.error('Render failed', page, err);
        this.toast('Could not load ' + page, 'error');
      }
    }
  },

  scheduleTab(name) {
    document.querySelectorAll('#page-schedule .sub-tab').forEach(t => t.classList.toggle('active', t.dataset.sub === name));
    document.querySelectorAll('#page-schedule .sub-panel').forEach(p => p.classList.remove('active'));
    const id = name === 'cal' ? 'schedule-cal' : name === 'school' ? 'schedule-school' : 'schedule-study';
    document.getElementById(id)?.classList.add('active');
    if (name === 'cal') this.renderCalendar();
    if (name === 'school') this.renderSchoolSchedule();
    if (name === 'study') this.renderPlanner();
  },

  studyTab(name) {
    document.querySelectorAll('#page-study .sub-tab').forEach(t => t.classList.toggle('active', t.dataset.sub === name));
    document.querySelectorAll('#page-study .sub-panel').forEach(p => p.classList.remove('active'));
    const map = {
      focus: 'study-focus',
      recall: 'study-recall',
      sessions: 'study-sessions',
      prep: 'study-prep',
      freetime: 'study-freetime',
      replay: 'study-replay'
    };
    document.getElementById(map[name])?.classList.add('active');
    if (name === 'recall') this.renderActiveRecall();
    if (name === 'sessions') this.renderSessions();
    if (name === 'focus') Pomodoro.updateUI();
    if (name === 'prep') this.renderExamPrep();
    if (name === 'freetime') this.renderFreeTime();
    if (name === 'replay') this.renderWeekReplay();
  },

  openExamPrep() {
    this.navigate('study');
    this.studyTab('prep');
  },

  renderExamPrep() {
    const exams = Tasks.getExamsAndTests(45);
    const list = document.getElementById('prep-exam-list');
    if (list) {
      if (!exams.length) {
        list.innerHTML = '<p class="text-muted">No upcoming exams. Add a Test/Exam task or calendar event first.</p>';
      } else {
        list.innerHTML = exams.map(e => {
          const cd = Tasks.countdown(e.date);
          const id = this.esc(e.id || '');
          return `<div class="plan-row">
            <div class="plan-body">
              <div class="plan-title">${this.esc(e.subject || e.title)}</div>
              <div class="plan-meta">${this.esc(e.title)} · ${e.date} · ${cd.label}</div>
            </div>
            <button class="btn btn-primary btn-sm" data-exam-id="${id}" data-exam-title="${this.esc(e.title)}" data-exam-subject="${this.esc(e.subject || '')}" data-exam-date="${e.date}" onclick="App.startExamPrepFromBtn(this)">Prepare</button>
          </div>`;
        }).join('');
      }
    }
    const plansEl = document.getElementById('prep-plans');
    if (!plansEl) return;
    const plans = ExamPrep.getPlans().filter(p => new Date(p.examDate + 'T23:59:59') >= new Date());
    if (!plans.length) {
      plansEl.innerHTML = '<p class="text-muted plan-empty">No active prep plans.</p>';
      return;
    }
    plansEl.innerHTML = plans.map(plan => {
      const daysLeft = Math.max(0, Math.ceil((new Date(plan.examDate + 'T12:00:00') - new Date()) / 86400000));
      const days = plan.days.map((d, i) => `
        <div class="prep-day ${d.done ? 'done' : ''}">
          <span class="prep-day-n">Day ${d.day}</span>
          <span class="prep-day-focus">${this.esc(d.focus)}</span>
          <span class="prep-day-date">${d.date}</span>
          ${d.done ? '<span class="text-muted">✓</span>' : `<button class="btn btn-ghost btn-sm" onclick="App.completePrepDay('${plan.id}',${i})">Done</button>`}
        </div>`).join('');
      return `<div class="card mb-2">
        <div class="forecast-head">
          <div>
            <div class="section-label" style="margin:0">Exam</div>
            <strong>${this.esc(plan.subject || plan.examTitle)}</strong>
            <div class="plan-meta">${plan.examDate} · ${daysLeft} days</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.deleteExamPlan('${plan.id}')">Remove</button>
        </div>
        <div class="forecast-bar mt-1"><div class="forecast-fill ok" style="width:${plan.progress || 0}%"></div></div>
        <div class="plan-meta mb-1">${plan.progress || 0}% of plan complete</div>
        <div class="prep-days">${days}</div>
      </div>`;
    }).join('');
  },

  startExamPrepFromBtn(btn) {
    this.startExamPrep({
      title: btn.getAttribute('data-exam-title') || 'Exam',
      subject: btn.getAttribute('data-exam-subject') || '',
      date: btn.getAttribute('data-exam-date')
    });
  },

  startExamPrep(exam) {
    if (!exam || !exam.date) return this.toast('Invalid exam', 'error');
    if (typeof ExamPrep === 'undefined') return this.toast('Exam prep module missing — check examPrep.js is loaded', 'error');
    const plan = ExamPrep.createPlan(exam);
    this.toast('Prep plan created for ' + (exam.subject || exam.title), 'success');
    this.renderExamPrep();
    this.refreshDashboard();
  },

  completePrepDay(planId, dayIndex) {
    ExamPrep.markDayDone(planId, dayIndex);
    this.renderExamPrep();
  },

  deleteExamPlan(id) {
    if (!confirm('Delete this prep plan?')) return;
    ExamPrep.deletePlan(id);
    this.renderExamPrep();
  },

  renderFreeTime() {
    const list = document.getElementById('busy-blocks-list');
    const blocks = ExamPrep.getBusyBlocks();
    if (list) {
      list.innerHTML = blocks.length ? blocks.map(b => `
        <div class="plan-row">
          <div class="plan-body">
            <div class="plan-title">${this.esc(b.label)}</div>
            <div class="plan-meta">${b.startTime}–${b.endTime}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.deleteBusyBlock('${b.id}')">✕</button>
        </div>`).join('') : '<p class="text-muted">No busy blocks yet (e.g. Taekwondo, dinner).</p>';
    }
    const slots = ExamPrep.findFreeSlotsToday('07:00', '22:00', 25);
    const slotsEl = document.getElementById('free-slots-list');
    if (slotsEl) {
      if (!slots.length) {
        slotsEl.innerHTML = '<p class="text-muted">No free blocks of 25+ min found today.</p>';
      } else {
        const suggestion = typeof this.computeStudySuggestion === 'function' ? this.computeStudySuggestion() : null;
        slotsEl.innerHTML = slots.map(s => `
          <div class="plan-row">
            <div class="plan-time">${s.start}</div>
            <div class="plan-body">
              <div class="plan-title">${s.start}–${s.end}</div>
              <div class="plan-meta">${s.minutes} minutes free</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="App.enterFocusMode('${this.esc(suggestion?.subject || 'Study')}','${this.esc(suggestion?.topic || 'Session')}',${Math.min(s.minutes, 50)})">Use</button>
          </div>`).join('');
      }
    }
  },

  showAddBusyBlock() {
    this.showModal('Busy block', `
      <div class="form-group">
        <label class="form-label">Label</label>
        <input class="form-input" id="busy-label" placeholder="Taekwondo / Dinner / School">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start</label>
          <input class="form-input" type="time" id="busy-start" value="18:00">
        </div>
        <div class="form-group">
          <label class="form-label">End</label>
          <input class="form-input" type="time" id="busy-end" value="19:30">
        </div>
      </div>
      <p class="text-muted" style="font-size:0.75rem">Applied Mon–Fri by default (with school schedule).</p>
    `, () => {
      const label = document.getElementById('busy-label').value.trim();
      if (!label) return this.toast('Label required', 'error');
      ExamPrep.addBusyBlock({
        label,
        startTime: document.getElementById('busy-start').value,
        endTime: document.getElementById('busy-end').value,
        days: [1, 2, 3, 4, 5]
      });
      this.closeModal();
      this.renderFreeTime();
      this.toast('Busy block added', 'success');
    });
  },

  deleteBusyBlock(id) {
    ExamPrep.deleteBusyBlock(id);
    this.renderFreeTime();
  },

  renderWeekReplay() {
    const el = document.getElementById('week-replay-report');
    if (!el) return;
    const r = ExamPrep.getWeekReport();
    if (!r) {
      el.innerHTML = '<p class="text-muted">No data yet.</p>';
      return;
    }
    el.innerHTML = `
      <div class="replay-hero">
        <div class="section-label">Your week</div>
        <div class="replay-time">${Tasks.formatMinutes(r.studyMinutes)}</div>
        <div class="text-secondary">studied</div>
      </div>
      <div class="replay-stats">
        <div class="quiet-stat"><span>${r.pomodoros}</span> pomodoros</div>
        <div class="quiet-stat"><span>${r.tasksCompleted}</span> tasks done</div>
        <div class="quiet-stat"><span>${r.recallSessions}</span> recall sessions</div>
      </div>
      ${r.bestImprovement ? `<div class="replay-block"><div class="section-label">Biggest improvement</div><p><strong>${this.esc(r.bestImprovement.name)}</strong> ${r.bestImprovement.delta > 0 ? '+' : ''}${r.bestImprovement.delta.toFixed(1)}</p></div>` : ''}
      ${r.weakest ? `<div class="replay-block"><div class="section-label">Weakest area</div><p><strong>${this.esc(r.weakest.name)}</strong> · avg ${r.weakest.avg.toFixed(1)}${r.weakTopic ? `<br><span class="text-muted">${this.esc(r.weakTopic)}</span>` : ''}</p></div>` : ''}
      <div class="replay-block"><div class="section-label">Most productive</div><p>${this.esc(r.productive)}</p></div>
      <div class="replay-block">
        <div class="section-label">Next week — recommended focus</div>
        <p><strong>${r.nextFocus.length ? r.nextFocus.map(f => this.esc(f)).join(' + ') : 'Keep a steady routine'}</strong></p>
      </div>
    `;
  },

  // Guided break overlay
  showBreakOverlay(minutes, nextLabel) {
    const el = document.getElementById('break-mode');
    if (!el) return;
    let left = (minutes || 5) * 60;
    document.getElementById('break-next').textContent = nextLabel ? 'Next: ' + nextLabel : '';
    el.classList.add('active');
    el.setAttribute('aria-hidden', 'false');
    if (this._breakTimer) clearInterval(this._breakTimer);
    const tick = () => {
      const m = Math.floor(left / 60);
      const s = left % 60;
      const tEl = document.getElementById('break-timer');
      if (tEl) tEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
      if (left <= 0) {
        clearInterval(this._breakTimer);
        this.skipBreak();
        this.toast('Break over — back to it', 'info');
        return;
      }
      left--;
    };
    tick();
    this._breakTimer = setInterval(tick, 1000);
  },

  skipBreak() {
    if (this._breakTimer) clearInterval(this._breakTimer);
    const el = document.getElementById('break-mode');
    el?.classList.remove('active');
    el?.setAttribute('aria-hidden', 'true');
  },


  updateDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
  },

  // ========== DASHBOARD ==========
  // ----- Custom dashboard layout -----
  DASH_MODULES: [
    { id: 'highlights', label: 'Closest test / homework / tournaments' },
    { id: 'suggest', label: 'What should I study?' },
    { id: 'actions', label: 'Quick actions' },
    { id: 'today', label: 'Today' },
    { id: 'upnext', label: 'Up next' },
    { id: 'overdue', label: 'Overdue banner' },
    { id: 'exams', label: 'Exam countdown' },
    { id: 'forecast', label: 'Study forecast' },
    { id: 'workload', label: 'Workload this week' },
    { id: 'stats', label: 'Quiet stats' }
  ],

  getDashboardLayout() {
    const data = Storage.getUserData();
    const prefs = data?.profile?.preferences || {};
    const defaultOrder = this.DASH_MODULES.map(m => m.id);
    let order = Array.isArray(prefs.dashboardOrder) ? prefs.dashboardOrder.filter(id => defaultOrder.includes(id)) : [];
    defaultOrder.forEach(id => { if (!order.includes(id)) order.push(id); });
    const pinned = Array.isArray(prefs.dashboardPinned) ? prefs.dashboardPinned.filter(id => defaultOrder.includes(id)) : [];
    const hidden = Array.isArray(prefs.dashboardHidden) ? prefs.dashboardHidden.filter(id => defaultOrder.includes(id)) : [];
    // Pinned first (stable), then the rest in order
    const pinSet = new Set(pinned);
    const head = order.filter(id => pinSet.has(id));
    const tail = order.filter(id => !pinSet.has(id));
    return { order: head.concat(tail), pinned, hidden };
  },

  saveDashboardLayout({ order, pinned, hidden }) {
    const data = Storage.getUserData();
    if (!data) return;
    if (!data.profile) data.profile = {};
    if (!data.profile.preferences) data.profile.preferences = {};
    data.profile.preferences.dashboardOrder = order;
    data.profile.preferences.dashboardPinned = pinned;
    data.profile.preferences.dashboardHidden = hidden;
    Storage.saveUserData(data);
  },

  applyDashboardLayout() {
    const root = document.getElementById('dash-modules');
    if (!root) return;
    const { order, pinned, hidden } = this.getDashboardLayout();
    const hide = new Set(hidden);
    const pin = new Set(pinned);
    order.forEach(id => {
      const el = root.querySelector(`[data-dash-module="${id}"]`);
      if (!el) return;
      root.appendChild(el);
      el.classList.toggle('dash-pinned', pin.has(id));
      if (id === 'overdue') {
        // visibility controlled by render logic; only force hide if user hid module
        if (hide.has(id)) el.style.display = 'none';
      } else {
        el.style.display = hide.has(id) ? 'none' : '';
      }
    });
  },

  showDashboardLayoutModal() {
    const layout = this.getDashboardLayout();
    const rows = layout.order.map((id, idx) => {
      const meta = this.DASH_MODULES.find(m => m.id === id) || { id, label: id };
      const isPin = layout.pinned.includes(id);
      const isHide = layout.hidden.includes(id);
      return `<div class="dash-layout-row" data-id="${id}">
        <div class="dash-layout-main">
          <strong>${this.esc(meta.label)}</strong>
          ${isPin ? '<span class="pin-badge-inline">📌</span>' : ''}
          ${isHide ? '<span class="text-muted" style="font-size:12px">hidden</span>' : ''}
        </div>
        <div class="dash-layout-actions">
          <button type="button" class="btn btn-ghost btn-sm" onclick="App.moveDashModule('${id}',-1)">↑</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="App.moveDashModule('${id}',1)">↓</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="App.toggleDashPin('${id}')">${isPin ? 'Unpin' : 'Pin'}</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="App.toggleDashHide('${id}')">${isHide ? 'Show' : 'Hide'}</button>
        </div>
      </div>`;
    }).join('');
    this.showModal('Customize dashboard', `
      <p class="text-muted" style="font-size:0.85rem;margin-bottom:12px">Reorder cards, pin favorites to the top, or hide what you don’t need.</p>
      <div id="dash-layout-list">${rows}</div>
      <button class="btn btn-secondary btn-sm w-full mt-2" onclick="App.resetDashboardLayout()">Reset to default</button>
    `, () => {
      this.closeModal();
      this.applyDashboardLayout();
      this.toast('Dashboard layout saved', 'success');
    });
  },

  _mutateDashboardLayout(fn) {
    const layout = this.getDashboardLayout();
    fn(layout);
    const pinSet = new Set(layout.pinned);
    const head = layout.order.filter(id => pinSet.has(id));
    const tail = layout.order.filter(id => !pinSet.has(id));
    layout.order = head.concat(tail);
    this.saveDashboardLayout(layout);
    this.applyDashboardLayout();
    const list = document.getElementById('dash-layout-list');
    if (list) {
      // Rebuild rows without stacking modals
      list.innerHTML = layout.order.map(id => {
        const meta = this.DASH_MODULES.find(m => m.id === id) || { id, label: id };
        const isPin = layout.pinned.includes(id);
        const isHide = layout.hidden.includes(id);
        return `<div class="dash-layout-row" data-id="${id}">
          <div class="dash-layout-main">
            <strong>${this.esc(meta.label)}</strong>
            ${isPin ? '<span class="pin-badge-inline">📌</span>' : ''}
            ${isHide ? '<span class="text-muted" style="font-size:12px">hidden</span>' : ''}
          </div>
          <div class="dash-layout-actions">
            <button type="button" class="btn btn-ghost btn-sm" onclick="App.moveDashModule('${id}',-1)">↑</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="App.moveDashModule('${id}',1)">↓</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="App.toggleDashPin('${id}')">${isPin ? 'Unpin' : 'Pin'}</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="App.toggleDashHide('${id}')">${isHide ? 'Show' : 'Hide'}</button>
          </div>
        </div>`;
      }).join('');
    }
  },

  moveDashModule(id, dir) {
    this._mutateDashboardLayout(layout => {
      const i = layout.order.indexOf(id);
      if (i < 0) return;
      const j = i + dir;
      if (j < 0 || j >= layout.order.length) return;
      const tmp = layout.order[i];
      layout.order[i] = layout.order[j];
      layout.order[j] = tmp;
    });
  },

  toggleDashPin(id) {
    this._mutateDashboardLayout(layout => {
      if (layout.pinned.includes(id)) layout.pinned = layout.pinned.filter(x => x !== id);
      else layout.pinned.push(id);
    });
  },

  toggleDashHide(id) {
    this._mutateDashboardLayout(layout => {
      if (layout.hidden.includes(id)) layout.hidden = layout.hidden.filter(x => x !== id);
      else layout.hidden.push(id);
    });
  },

  resetDashboardLayout() {
    this.saveDashboardLayout({
      order: this.DASH_MODULES.map(m => m.id),
      pinned: [],
      hidden: []
    });
    this.applyDashboardLayout();
    this._mutateDashboardLayout(() => {});
    this.toast('Dashboard reset', 'success');
  },

  renderDashboard() {
    const data = Storage.getUserData();
    if (!data) return;
    const p = data.profile.preferences || {};

    // Greeting
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = data.profile.name ? ', ' + data.profile.name.split(' ')[0] : '';
    const gEl = document.getElementById('greeting-text');
    if (gEl) gEl.textContent = greet + name + '.';
    const dEl = document.getElementById('greeting-date');
    if (dEl) {
      dEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
    }

    // Quiet stats (hide if distraction-free or hide-stats)
    const statsEl = document.getElementById('dash-quiet-stats');
    if (statsEl) {
      statsEl.style.display = (p.distractionFree || p.hideStats) ? 'none' : 'flex';
    }
    const avg = Grades.calculateOverallAverage();
    const gpaEl = document.getElementById('dash-gpa');
    if (gpaEl) gpaEl.textContent = avg !== null ? avg.toFixed(1) : '—';
    const streakEl = document.getElementById('dash-streak');
    if (streakEl) streakEl.textContent = data.statistics.studyStreak || 0;
    const pomoEl = document.getElementById('dash-pomodoros');
    if (pomoEl) pomoEl.textContent = data.statistics.pomodorosCompleted || 0;

    // Highlight cards + rest of dashboard
    this.renderDashHighlights();
    this.renderTodayPlan();
    this.renderUpNext();
    this.askWhatToStudy(true);
    this.renderExamCountdown();
    this.renderStudyForecast();
    this.renderWorkloadHeatmap();
    this.renderOverdueBanner();
    this.applyDashboardLayout();
    this.updateStatusChip();
  },

  renderDashHighlights() {
    this.renderDashNextTest();
    this.renderDashHomework();
    this.renderDashTournaments();
  },

  renderDashNextTest() {
    const el = document.getElementById('dash-next-test-body');
    if (!el) return;
    // Only the single closest exam/test/quiz/assignment within 30 days
    const limit = 30;
    const exams = Tasks.getExamsAndTests(limit);
    const assignments = Tasks.getAll()
      .filter(t => t.status !== 'Completed' && t.dueDate && ['Assignment', 'Project', 'Essay', 'Presentation'].includes(t.type))
      .map(t => ({
        id: t.id,
        title: t.title,
        subject: t.subject,
        date: t.dueDate,
        type: t.type,
        priority: t.priority,
        source: 'task'
      }));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const max = new Date(today);
    max.setDate(max.getDate() + limit);
    const combined = [...exams, ...assignments]
      .filter(i => {
        if (!i.date) return false;
        const d = new Date(i.date + 'T00:00:00');
        return d >= today && d <= max;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const next = combined[0];
    if (!next) {
      el.innerHTML = '<p class="text-muted plan-empty">None in the next 30 days</p>';
      return;
    }
    const cd = Tasks.countdown(next.date);
    el.innerHTML = `
      <div class="plan-title">${this.esc(next.subject || next.title)}</div>
      <div class="plan-meta">${this.esc(next.title)} · ${this.esc(next.type || '')} · ${next.date}</div>
      <div class="countdown-badge ${cd.overdue ? 'overdue' : cd.days <= 2 ? 'urgent' : ''}">${cd.label}</div>
    `;
  },

  renderDashHomework() {
    const el = document.getElementById('dash-homework-body');
    if (!el) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const max = new Date(today);
    max.setDate(max.getDate() + 30);
    const hw = Tasks.getAll()
      .filter(t => {
        if (t.status === 'Completed' || !t.dueDate || t.type !== 'Homework') return false;
        const d = new Date(t.dueDate + 'T00:00:00');
        return d >= today && d <= max;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const next = hw[0];
    if (!next) {
      el.innerHTML = '<p class="text-muted plan-empty">None in the next 30 days</p>';
      return;
    }
    const cd = Tasks.countdown(next.dueDate);
    el.innerHTML = `
      <div class="plan-title">${this.esc(next.title)}</div>
      <div class="plan-meta">${this.esc(next.subject || '')} · ${next.dueDate}</div>
      <div class="countdown-badge ${cd.overdue ? 'overdue' : cd.days <= 1 ? 'urgent' : ''}">${cd.label}</div>
    `;
  },

  renderDashTournaments() {
    const el = document.getElementById('dash-tournaments-body');
    if (!el) return;
    if (typeof Hobbies === 'undefined') {
      el.innerHTML = '<p class="text-muted plan-empty">None in the next 30 days</p>';
      return;
    }
    const next = Hobbies.getClosestEvent ? Hobbies.getClosestEvent(30) : (Hobbies.getUpcomingEvents(30)[0] || null);
    if (!next) {
      el.innerHTML = '<p class="text-muted plan-empty">None in the next 30 days</p>';
      return;
    }
    const cd = Tasks.countdown(next.date);
    const range = next.endDate && next.endDate !== next.date ? ` · until ${next.endDate}` : '';
    const typeLabel = Hobbies.displayType ? Hobbies.displayType(next) : next.type;
    el.innerHTML = `
      <div class="plan-title">${this.esc(next.title)}${next.pinned ? ' 📌' : ''}</div>
      <div class="plan-meta">${this.esc(typeLabel)}${next.hobbyName ? ' · ' + this.esc(next.hobbyName) : ''} · ${next.date}${range}</div>
      <div class="countdown-badge ${cd.overdue ? 'overdue' : cd.days <= 2 ? 'urgent' : ''}">${cd.label}</div>
    `;
  },

  renderExamCountdown() {
    const el = document.getElementById('exam-countdown');
    if (!el) return;
    // Only the closest exam/test within 30 days
    const exams = Tasks.getExamsAndTests(30);
    const next = exams[0];
    if (!next) {
      el.innerHTML = '<p class="text-muted plan-empty">No tests or exams in the next 30 days.</p>';
      return;
    }
    const cd = Tasks.countdown(next.date);
    const color = Grades.getColor(next.subject);
    el.innerHTML = `<div class="plan-row">
      <div class="subject-chip" style="--chip:${color}"></div>
      <div class="plan-body">
        <div class="plan-title">${this.esc(next.subject || next.title)}</div>
        <div class="plan-meta">${this.esc(next.title)} · ${next.date}</div>
      </div>
      <div class="countdown-badge ${cd.overdue ? 'overdue' : cd.days <= 2 ? 'urgent' : ''}">${cd.label}</div>
    </div>`;
  },

  renderStudyForecast() {
    const el = document.getElementById('study-forecast');
    if (!el) return;
    const exams = Tasks.getExamsAndTests(21).slice(0, 3);
    if (!exams.length) {
      el.innerHTML = '<p class="text-muted plan-empty">Add an exam or test to see a forecast.</p>';
      return;
    }
    el.innerHTML = exams.map(e => {
      const f = Tasks.forecastForExam(e);
      if (!f) return '';
      const cls = f.score >= 70 ? 'ok' : f.score >= 45 ? 'warn' : 'risk';
      return `<div class="forecast-card">
        <div class="forecast-head">
          <strong>${this.esc(e.subject || e.title)}</strong>
          <span class="forecast-status ${cls}">${f.status}</span>
        </div>
        <div class="forecast-bar"><div class="forecast-fill ${cls}" style="width:${f.score}%"></div></div>
        <div class="plan-meta">${f.daysLeft} day(s) left · readiness ${f.score}%${f.relatedCount ? ` · ${f.relatedCount} open task(s)` : ''}</div>
      </div>`;
    }).join('');
  },

  renderWorkloadHeatmap() {
    const el = document.getElementById('workload-heatmap');
    if (!el) return;
    const wl = Tasks.workloadByDay(7);
    const days = Object.keys(wl).sort();
    const max = Math.max(...days.map(d => wl[d].minutes), 1);
    const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let html = '<div class="heatmap">';
    let heaviest = { key: null, minutes: 0 };
    days.forEach(d => {
      const m = wl[d].minutes;
      if (m > heaviest.minutes) heaviest = { key: d, minutes: m };
      const day = names[new Date(d + 'T12:00:00').getDay()];
      const blocks = Math.min(10, Math.ceil((m / max) * 10));
      const bar = '█'.repeat(blocks) || '·';
      html += `<div class="heatmap-row"><span class="heatmap-day">${day}</span><span class="heatmap-bar" title="${m} min">${bar}</span><span class="heatmap-min">${m ? Tasks.formatMinutes(m) : '—'}</span></div>`;
    });
    html += '</div>';
    if (heaviest.minutes > 180) {
      const light = days.find(d => wl[d].minutes < heaviest.minutes * 0.4);
      const lightName = light ? names[new Date(light + 'T12:00:00').getDay()] : 'another day';
      const heavyName = names[new Date(heaviest.key + 'T12:00:00').getDay()];
      html += `<p class="workload-tip">⚠️ ${heavyName} is overloaded (${Tasks.formatMinutes(heaviest.minutes)}). Consider moving ~45 min of work to ${lightName}.</p>`;
    }
    el.innerHTML = html;
  },

  renderOverdueBanner() {
    const overdue = Tasks.getOverdue();
    const banner = document.getElementById('overdue-banner');
    if (!banner) return;
    if (!overdue.length) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    banner.innerHTML = `<div class="smart-banner-item">Overdue: ${overdue.slice(0, 3).map(t => this.esc(t.title)).join(' · ')}${overdue.length > 3 ? ` (+${overdue.length - 3})` : ''}</div>`;
  },

  renderTodayPlan() {
    const today = new Date().toISOString().split('T')[0];
    const items = [];

    // Study schedule for today
    (Planner.getStudySchedule() || []).filter(s => s.date === today).forEach(s => {
      items.push({
        time: s.startTime || '',
        title: s.title,
        meta: s.subject || (s.type === 'active-recall' ? 'Active recall' : 'Study'),
        duration: s.endTime && s.startTime ? this.minsBetween(s.startTime, s.endTime) + ' min' : '',
        action: () => this.enterFocusMode(s.subject || s.title, s.title)
      });
    });

    // Calendar events today
    Calendar.getEventsForDate(today).forEach(e => {
      if (items.some(i => i.title === e.title && i.time === (e.time || ''))) return;
      items.push({
        time: e.time || '',
        title: e.title,
        meta: e.subject || Calendar.TYPE_LABELS[e.type] || e.type,
        duration: '',
        type: e.type
      });
    });

    // Recall due today
    ActiveRecall.getDueToday().forEach(({ topic, review }) => {
      items.push({
        time: '',
        title: topic.topic,
        meta: 'Active recall' + (topic.subject ? ' · ' + topic.subject : ''),
        duration: '15 min',
        recall: { topicId: topic.id, reviewId: review.id }
      });
    });

    items.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));

    const el = document.getElementById('today-plan-list');
    if (!el) return;
    if (items.length === 0) {
      el.innerHTML = '<p class="text-muted plan-empty">Nothing scheduled for today. Generate a study plan or add a task.</p>';
      return;
    }
    el.innerHTML = items.map((item, idx) => `
      <div class="plan-row" data-idx="${idx}">
        <div class="plan-time">${item.time || '—'}</div>
        <div class="plan-body">
          <div class="plan-title">${this.esc(item.title)}</div>
          <div class="plan-meta">${this.esc(item.meta)}${item.duration ? ' · ' + item.duration : ''}</div>
        </div>
        ${item.recall ? `<button class="btn btn-ghost btn-sm" onclick="App.startRecallSession('${item.recall.topicId}','${item.recall.reviewId}')">Review</button>` :
          `<button class="btn btn-ghost btn-sm" onclick="App.enterFocusMode('${this.esc(item.meta)}','${this.esc(item.title)}')">Start</button>`}
      </div>
    `).join('');
  },

  renderUpNext() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.toISOString().split('T')[0];
    const week = Calendar.getUpcoming(7).filter(e => e.date !== new Date().toISOString().split('T')[0]);
    const tasks = Tasks.getUpcoming(7);

    const lines = [];
    week.filter(e => ['exam', 'test'].includes(e.type)).slice(0, 4).forEach(e => {
      const label = e.date === tomStr ? 'Tomorrow' : e.date;
      lines.push({ label, text: `${e.subject ? e.subject + ' ' : ''}${Calendar.TYPE_LABELS[e.type] || e.type}: ${e.title}` });
    });
    tasks.slice(0, 4).forEach(t => {
      const label = t.dueDate === tomStr ? 'Tomorrow' : t.dueDate;
      if (!lines.some(l => l.text.includes(t.title))) {
        lines.push({ label, text: t.title + (t.subject ? ` (${t.subject})` : '') });
      }
    });

    const el = document.getElementById('up-next-list');
    if (!el) return;
    if (lines.length === 0) {
      el.innerHTML = '<p class="text-muted plan-empty">No upcoming deadlines in the next week.</p>';
      return;
    }
    el.innerHTML = lines.slice(0, 6).map(l => `
      <div class="plan-row simple">
        <div class="plan-time">${this.esc(l.label)}</div>
        <div class="plan-body"><div class="plan-title">${this.esc(l.text)}</div></div>
      </div>
    `).join('');
  },

  minsBetween(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  },

  askWhatToStudy(silent) {
    const suggestion = this.computeStudySuggestion();
    const el = document.getElementById('suggest-content');
    if (!el) return;
    if (!suggestion) {
      el.innerHTML = `<p class="text-secondary">Add a test, assignment, or active-recall topic so I can recommend what to study.</p>`;
      return;
    }
    el.innerHTML = `
      <p class="suggest-main">You should study <strong>${this.esc(suggestion.subject)}</strong>.</p>
      <p class="text-secondary suggest-reason">${this.esc(suggestion.reason)}</p>
      <button class="btn btn-primary btn-sm mt-1" onclick="App.enterFocusMode('${this.esc(suggestion.subject)}','${this.esc(suggestion.topic)}',${suggestion.minutes || 30})">
        Start ${suggestion.minutes || 30} min session
      </button>
    `;
    if (!silent) this.toast(suggestion.subject + ' — ' + suggestion.reason, 'info');
  },

  computeStudySuggestion() {
    const candidates = [];
    const data = Storage.getUserData();
    const score = (daysUntil, base, difficulty) =>
      (typeof Planner.scoreItem === 'function')
        ? Planner.scoreItem({ daysUntil, baseUrgency: base, difficulty })
        : Planner.calcUrgency(daysUntil, base) * (difficulty || 5);

    // Exams / tests — same bases as Planner.generate
    Calendar.getUpcoming(14).forEach(e => {
      if (!['exam', 'test'].includes(e.type)) return;
      const days = Planner.daysUntil(e.date);
      if (days < 0) return;
      const difficulty = Planner.getSubjectDifficulty(e.subject, data || {});
      const base = e.type === 'exam' ? 10 : 8;
      candidates.push({
        subject: e.subject || e.title,
        topic: e.title,
        score: score(days, base, difficulty),
        reason: days <= 1 ? `Your ${e.type} is ${days === 0 ? 'today' : 'tomorrow'}.` :
          days <= 3 ? `Your ${e.type} is in ${days} days.` :
          `Upcoming ${e.type} in ${days} days.`,
        minutes: days <= 2 ? 40 : 30
      });
    });

    // Active recall due today (boost if previously difficult)
    ActiveRecall.getDueToday().forEach(({ topic, review }) => {
      const hard = (topic.reviews || []).some(r =>
        r.difficulty === 'Difficult' || r.difficulty === 'Need to review again'
      );
      candidates.push({
        subject: topic.subject || 'Review',
        topic: topic.topic,
        score: score(0, 6, hard || review?.isExtra ? 8 : 5),
        reason: hard ? 'Difficult recall due — worth revisiting today.' : 'Active recall due today.',
        minutes: 15
      });
    });

    // Tasks due soon
    Tasks.getUpcoming(7).forEach(t => {
      const days = Planner.daysUntil(t.dueDate);
      if (days < 0) return;
      const base = t.priority === 'High' ? 7 : t.priority === 'Low' ? 4 : 5;
      const difficulty = t.difficulty != null
        ? Math.min(9, Math.max(2, t.difficulty * 1.5))
        : Planner.getSubjectDifficulty(t.subject, data || {});
      const remaining = t.estimatedTime != null
        ? Math.max(15, (t.estimatedTime || 0) - (t.actualTime || 0))
        : 30;
      candidates.push({
        subject: t.subject || t.title,
        topic: t.title,
        score: score(days, base, difficulty),
        reason: `Due ${days === 0 ? 'today' : 'in ' + days + ' day(s)'} (${t.type || 'task'}).`,
        minutes: Math.min(50, remaining)
      });
    });

    // Sport exams (prep)
    if (typeof Hobbies !== 'undefined') {
      (Hobbies.getSportExams ? Hobbies.getSportExams(14) : []).forEach(e => {
        const days = Planner.daysUntil(e.date);
        if (days < 0) return;
        candidates.push({
          subject: e.hobbyName || e.title,
          topic: e.title,
          score: score(days, 7, 5),
          reason: days <= 1 ? 'Sport exam is imminent.' : `Sport exam in ${days} day(s).`,
          minutes: 25
        });
      });
    }

    // Weak subjects (lower weight than deadlines)
    if (data) {
      Grades.getSubjects().forEach(s => {
        const avg = Grades.getSubjectAverage(s.id, data.grades);
        if (avg !== null && avg < 12) {
          const difficulty = Planner.getSubjectDifficulty(s.name, data);
          candidates.push({
            subject: s.name,
            topic: s.name + ' revision',
            score: score(5, 3, difficulty), // soft urgency ~5 days out
            reason: `Average is ${avg.toFixed(1)} — could use more practice.`,
            minutes: 25
          });
        }
      });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  },

  startStudyingFlow() {
    const subjects = Grades.getSubjects();
    const subjectOpts = subjects.map(s => `<option value="${this.esc(s.name)}">${this.esc(s.name)}</option>`).join('');
    const openTasks = Tasks.getAll().filter(t => t.status !== 'Completed');
    const taskOpts = openTasks.slice(0, 40).map(t =>
      `<option value="${t.id}">${this.esc(t.title)}${t.subject ? ' · ' + this.esc(t.subject) : ''}</option>`
    ).join('');
    this.showModal('What are you working on?', `
      <div class="form-group">
        <label class="form-label">Link to task (optional)</label>
        <select class="form-select" id="focus-pick-task" onchange="App._focusTaskPicked()">
          <option value="">— none —</option>
          ${taskOpts}
        </select>
        <p class="text-muted" style="font-size:0.75rem;margin-top:4px">When the pomodoro finishes, minutes are added to this task’s actual time.</p>
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <select class="form-select" id="focus-pick-subject">
          <option value="">—</option>
          ${subjectOpts}
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Topic / task</label>
        <input class="form-input" id="focus-pick-topic" placeholder="e.g. Newton's Laws">
      </div>
      <div class="form-group">
        <label class="form-label">Duration (minutes)</label>
        <input class="form-input" type="number" id="focus-pick-mins" value="${Pomodoro.studyDuration || 25}" min="5" max="120">
      </div>
    `, () => {
      const taskId = document.getElementById('focus-pick-task')?.value || null;
      let subject = document.getElementById('focus-pick-subject').value || 'Study';
      let topic = document.getElementById('focus-pick-topic').value.trim() || subject;
      if (taskId) {
        const t = Tasks.getById(taskId);
        if (t) {
          subject = t.subject || subject;
          topic = t.title || topic;
        }
      }
      const mins = parseInt(document.getElementById('focus-pick-mins').value) || 25;
      this.closeModal();
      this.enterFocusMode(subject, topic, mins, taskId || null);
    });
  },

  _focusTaskPicked() {
    const id = document.getElementById('focus-pick-task')?.value;
    if (!id) return;
    const t = Tasks.getById(id);
    if (!t) return;
    const subj = document.getElementById('focus-pick-subject');
    const topic = document.getElementById('focus-pick-topic');
    if (subj && t.subject) {
      // ensure option exists
      let found = false;
      for (const o of subj.options) if (o.value === t.subject) found = true;
      if (!found && t.subject) {
        const opt = document.createElement('option');
        opt.value = t.subject; opt.textContent = t.subject;
        subj.appendChild(opt);
      }
      subj.value = t.subject || subj.value;
    }
    if (topic) topic.value = t.title || '';
  },

  enterFocusMode(subject, topic, minutes, taskId) {
    subject = subject || Pomodoro.currentSubject || 'Focus';
    topic = topic || subject;
    if (minutes) {
      Pomodoro.studyDuration = minutes;
      Pomodoro.setMode('study');
    }
    Pomodoro.linkedTaskId = taskId || null;
    Pomodoro.currentSubject = subject + (topic && topic !== subject ? ' — ' + topic : '');
    Pomodoro.start(Pomodoro.currentSubject, Pomodoro.linkedTaskId);

    const fm = document.getElementById('focus-mode');
    if (!fm) return;
    document.getElementById('focus-subject').textContent = subject;
    document.getElementById('focus-topic').textContent = topic;
    document.getElementById('focus-timer').textContent = Pomodoro.formatTime(Pomodoro.remaining);
    const linkNote = Pomodoro.linkedTaskId ? ' · logging to task' : '';
    document.getElementById('focus-meta').textContent = `Pomodoro ${Pomodoro.sessionCount + 1}${linkNote}`;
    document.getElementById('focus-pause').textContent = 'Pause';
    fm.classList.add('active');
    fm.setAttribute('aria-hidden', 'false');
    document.body.classList.add('focus-active');

    if (this._focusInterval) clearInterval(this._focusInterval);
    this._focusInterval = setInterval(() => {
      const t = document.getElementById('focus-timer');
      if (t) t.textContent = Pomodoro.formatTime(Pomodoro.remaining);
      const total = (Pomodoro.mode === 'study' ? Pomodoro.studyDuration : Pomodoro.mode === 'shortBreak' ? Pomodoro.shortBreak : Pomodoro.longBreak) * 60;
      const pct = total ? ((total - Pomodoro.remaining) / total) * 100 : 0;
      const fill = document.getElementById('focus-progress-fill');
      if (fill) fill.style.width = pct + '%';
      const meta = document.getElementById('focus-meta');
      if (meta) {
        const labels = { study: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' };
        meta.textContent = `${labels[Pomodoro.mode] || ''} · Pomodoro ${Pomodoro.sessionCount + (Pomodoro.mode === 'study' ? 1 : 0)}`;
      }
      if (!Pomodoro.isRunning && !Pomodoro.isPaused) {
        // session completed naturally
      }
    }, 500);
  },

  focusPauseToggle() {
    if (Pomodoro.isPaused) {
      Pomodoro.resume();
      document.getElementById('focus-pause').textContent = 'Pause';
    } else if (Pomodoro.isRunning) {
      Pomodoro.pause();
      document.getElementById('focus-pause').textContent = 'Resume';
    } else {
      Pomodoro.start(Pomodoro.currentSubject);
      document.getElementById('focus-pause').textContent = 'Pause';
    }
  },

  exitFocusMode() {
    if (this._focusInterval) clearInterval(this._focusInterval);
    document.getElementById('focus-mode')?.classList.remove('active');
    document.getElementById('focus-mode')?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('focus-active');
    Pomodoro.pause();
    // keep linkedTaskId until session completes so pause/resume still logs
    this.refreshDashboard();
  },

  openQuickAdd() {
    this.showModal('Add', `
      <div class="quick-add-grid">
        <button class="quick-add-item" onclick="App.closeModal();App.showAddTaskModal()"><span>Assignment</span></button>
        <button class="quick-add-item" onclick="App.closeModal();App.showAddEventModal();setTimeout(()=>{const t=document.getElementById('ev-type');if(t)t.value='test'},50)"><span>Test</span></button>
        <button class="quick-add-item" onclick="App.closeModal();App.showAddEventModal();setTimeout(()=>{const t=document.getElementById('ev-type');if(t)t.value='exam'},50)"><span>Exam</span></button>
        <button class="quick-add-item" onclick="App.closeModal();App.showAddTaskModal()"><span>Homework</span></button>
        <button class="quick-add-item" onclick="App.closeModal();App.showAddTaskModal()"><span>Project</span></button>
        <button class="quick-add-item" onclick="App.closeModal();App.startStudyingFlow()"><span>Study session</span></button>
        <button class="quick-add-item" onclick="App.closeModal();App.showAddRecallModal()"><span>Active recall</span></button>
        <button class="quick-add-item" onclick="App.closeModal();App.showAddEventModal()"><span>Calendar event</span></button>
        <button class="quick-add-item" onclick="App.closeModal();App.showAddGradeModal()"><span>Grade</span></button>
      </div>
    `, null, true);
  },

  openSearch() {
    this.showModal('Search', `
      <input class="form-input" id="global-search" placeholder="Search subjects, tasks, events…" autofocus>
      <div id="search-results" class="search-results mt-2"></div>
    `, null, true);
    setTimeout(() => {
      const input = document.getElementById('global-search');
      if (!input) return;
      input.focus();
      input.addEventListener('input', () => this.runSearch(input.value.trim()));
    }, 100);
  },

  runSearch(q) {
    const box = document.getElementById('search-results');
    if (!box) return;
    if (!q || q.length < 1) { box.innerHTML = ''; return; }
    const ql = q.toLowerCase();
    const results = [];

    Grades.getSubjects().filter(s => s.name.toLowerCase().includes(ql)).forEach(s => {
      const avg = Grades.getSubjectAverage(s.id);
      results.push({ type: 'Subject', title: s.name, meta: avg !== null ? 'Avg ' + avg.toFixed(1) : '', action: `App.navigate('grades')` });
    });
    Tasks.getAll().filter(t => (t.title + t.subject).toLowerCase().includes(ql)).slice(0, 8).forEach(t => {
      results.push({ type: 'Task', title: t.title, meta: (t.subject || '') + (t.dueDate ? ' · ' + t.dueDate : ''), action: `App.closeModal();App.editTask('${t.id}')` });
    });
    Calendar.getEvents().filter(e => (e.title + (e.subject || '')).toLowerCase().includes(ql)).slice(0, 8).forEach(e => {
      results.push({ type: Calendar.TYPE_LABELS[e.type] || 'Event', title: e.title, meta: e.date + (e.subject ? ' · ' + e.subject : ''), action: `App.closeModal();App.navigate('schedule')` });
    });
    ActiveRecall.getAll().filter(t => (t.topic + (t.subject || '')).toLowerCase().includes(ql)).forEach(t => {
      results.push({ type: 'Recall', title: t.topic, meta: t.subject || '', action: `App.closeModal();App.navigate('study');App.studyTab('recall')` });
    });

    if (results.length === 0) {
      box.innerHTML = '<p class="text-muted">No results</p>';
      return;
    }
    box.innerHTML = results.map(r => `
      <button class="search-result-item" onclick="${r.action}">
        <span class="search-type">${this.esc(r.type)}</span>
        <span class="search-title">${this.esc(r.title)}</span>
        <span class="search-meta">${this.esc(r.meta)}</span>
      </button>
    `).join('');
  },

  renderSessions() {
    const data = Storage.getUserData();
    if (!data) return;
    const el = document.getElementById('sessions-stats');
    if (el) {
      el.innerHTML = `
        <div class="quiet-stat"><span>${data.statistics.pomodorosCompleted || 0}</span> pomodoros</div>
        <div class="quiet-stat"><span>${this.formatMinutes(data.statistics.totalStudyTime || 0)}</span> total</div>
        <div class="quiet-stat"><span>${data.statistics.studyStreak || 0}</span> day streak</div>
      `;
    }
  },

  refreshDashboard() {
    if (this.currentPage === 'dashboard') this.renderDashboard();
  },

  // ========== CALENDAR ==========
  renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    const year = Calendar.currentDate.getFullYear();
    const month = Calendar.currentDate.getMonth();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    document.getElementById('cal-month-year').textContent = `${monthNames[month]} ${year}`;

    if (Calendar.view === 'month') {
      const days = Calendar.getMonthDays(year, month);
      const today = new Date().toISOString().split('T')[0];
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

      let html = '<div class="calendar-grid">';
      dayNames.forEach(d => { html += `<div class="calendar-day-header">${d}</div>`; });

      days.forEach(day => {
        const dateStr = Calendar.formatDate(day.date);
        const events = Calendar.getEventsForDate(dateStr);
        const isToday = dateStr === today;
        const hasMulti = events.some(e => Calendar.isMultiDay && Calendar.isMultiDay(e));
        html += `<div class="calendar-day ${day.otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${events.length ? 'has-events' : ''} ${hasMulti ? 'has-multi' : ''}"
          onclick="App.openDayModal('${dateStr}')">
          <div class="day-number">${day.date.getDate()}</div>
          <div class="day-events">
            ${events.slice(0, 3).map(e => {
              const multi = Calendar.isMultiDay && Calendar.isMultiDay(e);
              const recurring = Calendar.isRecurring && Calendar.isRecurring(e);
              const mid = multi && dateStr !== e.date && dateStr !== e.endDate;
              const start = multi && dateStr === e.date;
              const end = multi && dateStr === e.endDate;
              const cls = [e.type, e.completed ? 'completed' : '', multi ? 'multi' : '', start ? 'multi-start' : '', mid ? 'multi-mid' : '', end ? 'multi-end' : '', recurring ? 'recur' : ''].filter(Boolean).join(' ');
              const tip = recurring && Calendar.recurLabel ? Calendar.recurLabel(e) : (multi ? (e.date + ' → ' + e.endDate) : '');
              return `<div class="day-event ${cls}" title="${this.esc(e.title)}${tip ? ' · ' + this.esc(tip) : ''}">${this.esc(e.title)}</div>`;
            }).join('')}
            ${events.length > 3 ? `<div class="day-event other">+${events.length - 3}</div>` : ''}
          </div>
        </div>`;
      });
      html += '</div>';
      container.innerHTML = html;
    }
  },

  calPrev() {
    if (Calendar.view === 'month') {
      Calendar.currentDate.setMonth(Calendar.currentDate.getMonth() - 1);
    } else {
      Calendar.currentDate.setDate(Calendar.currentDate.getDate() - 7);
    }
    this.renderCalendar();
  },

  calNext() {
    if (Calendar.view === 'month') {
      Calendar.currentDate.setMonth(Calendar.currentDate.getMonth() + 1);
    } else {
      Calendar.currentDate.setDate(Calendar.currentDate.getDate() + 7);
    }
    this.renderCalendar();
  },

  calToday() {
    Calendar.currentDate = new Date();
    this.renderCalendar();
  },

  setCalView(view) {
    Calendar.view = view;
    document.querySelectorAll('.calendar-view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-cal-view="${view}"]`)?.classList.add('active');
    this.renderCalendar();
  },

  openDayModal(dateStr) {
    const events = Calendar.getEventsForDate(dateStr);
    const dayDate = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = dayDate.getDay();
    const nice = dayDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    // Merge calendar events + school classes + study sessions + busy blocks into one timetable
    const slots = [];

    events.forEach(e => {
      const multi = Calendar.isMultiDay && Calendar.isMultiDay(e);
      const recurring = Calendar.isRecurring && Calendar.isRecurring(e);
      const start = e.time || '';
      const end = e.endTime || '';
      const masterId = e.masterId || e.id;
      slots.push({
        id: e.id,
        masterId,
        occurrenceDate: e.occurrenceDate || dateStr,
        title: e.title,
        subject: e.subject || '',
        type: e.type || 'other',
        start,
        end,
        completed: !!e.completed,
        multi,
        recurring,
        recurLabel: recurring && Calendar.recurLabel ? Calendar.recurLabel(e) : '',
        rangeLabel: multi ? ((e.seriesDate || e.date) + ' → ' + (e.seriesEndDate || e.endDate)) : '',
        source: e.linkedTaskId ? 'Task' : e.linkedSportEventId ? 'Hobby' : e.linkedRecallId ? 'Recall' : (recurring ? 'Recurring' : 'Event'),
        deletable: true,
        allDay: !e.time
      });
    });

    // School classes for this weekday
    if (typeof Planner !== 'undefined') {
      Planner.getSchoolSchedule().filter(c => c.day === dayOfWeek).forEach(c => {
        slots.push({
          id: 'school-' + c.id,
          title: c.subject,
          subject: [c.room, c.teacher].filter(Boolean).join(' · '),
          type: 'school',
          start: c.startTime,
          end: c.endTime,
          completed: false,
          multi: false,
          rangeLabel: '',
          source: 'Class',
          deletable: false,
          allDay: false
        });
      });
    }

    // Generated study plan sessions for this date
    if (typeof Planner !== 'undefined') {
      (Planner.getStudySchedule() || []).filter(s => s.date === dateStr).forEach(s => {
        // Avoid duplicating if already on calendar as study event with same time+title
        const dup = slots.some(x => x.start === s.startTime && x.title === s.title);
        if (dup) return;
        slots.push({
          id: 'study-' + s.id,
          title: s.title,
          subject: s.subject || '',
          type: s.type === 'active-recall' ? 'active-recall' : 'study',
          start: s.startTime,
          end: s.endTime || '',
          completed: false,
          multi: false,
          rangeLabel: '',
          source: 'Study plan',
          deletable: false,
          allDay: false
        });
      });
    }

    // Hobby busy blocks for this weekday
    if (typeof ExamPrep !== 'undefined') {
      ExamPrep.getBusyBlocks().filter(b => (b.days || []).includes(dayOfWeek)).forEach(b => {
        slots.push({
          id: 'busy-' + b.id,
          title: b.label,
          subject: '',
          type: 'busy',
          start: b.startTime,
          end: b.endTime,
          completed: false,
          multi: false,
          rangeLabel: '',
          source: 'Busy',
          deletable: false,
          allDay: false
        });
      });
    }

    const toMin = (t) => {
      if (!t) return 9999;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    const timed = slots.filter(s => !s.allDay && s.start).sort((a, b) => toMin(a.start) - toMin(b.start));
    const allDay = slots.filter(s => s.allDay || !s.start);

    const typeLabel = (t) => {
      if (t === 'school') return 'Class';
      if (t === 'busy') return 'Busy';
      return (Calendar.TYPE_LABELS && Calendar.TYPE_LABELS[t]) || t;
    };

    const renderBlock = (s) => {
      const timeStr = s.start
        ? (s.end ? `${s.start}–${s.end}` : s.start)
        : (s.rangeLabel || 'All day');
      const done = s.completed ? ' is-done' : '';
      const metaBits = [
        typeLabel(s.type),
        s.subject,
        s.source,
        s.multi ? 'multi-day' : '',
        s.recurLabel || (s.recurring ? 'repeats' : '')
      ].filter(Boolean).map(x => this.esc(x));
      const actions = s.deletable ? (
        s.recurring
          ? `<div class="tt-actions">
              <button class="btn btn-ghost btn-sm" title="Skip this date only" onclick="event.stopPropagation();App.skipOccurrenceFromDay('${s.masterId}','${s.occurrenceDate}','${dateStr}')">Skip</button>
              <button class="btn btn-ghost btn-sm tt-del" title="Delete whole series" onclick="event.stopPropagation();App.deleteEventFromDay('${s.masterId}','${dateStr}')">✕</button>
            </div>`
          : `<button class="btn btn-ghost btn-sm tt-del" onclick="event.stopPropagation();App.deleteEventFromDay('${s.id}','${dateStr}')">✕</button>`
      ) : '';
      return `<div class="tt-block type-${this.esc(s.type)}${done}${s.recurring ? ' is-recur' : ''}">
        <div class="tt-time">${this.esc(timeStr)}</div>
        <div class="tt-body">
          <div class="tt-title">${this.esc(s.title)}${s.completed ? ' ✓' : ''}${s.recurring ? ' <span class="tt-recur-badge">↻</span>' : ''}</div>
          <div class="tt-meta">${metaBits.join(' · ')}</div>
        </div>
        ${actions}
      </div>`;
    };

    // Hour spine: from earliest event (or 8:00) to latest (or 21:00)
    let minH = 8, maxH = 21;
    timed.forEach(s => {
      const sm = toMin(s.start);
      const em = s.end ? toMin(s.end) : sm + 60;
      if (sm < 9999) minH = Math.min(minH, Math.floor(sm / 60));
      if (em < 9999) maxH = Math.max(maxH, Math.ceil(em / 60));
    });
    minH = Math.max(0, minH);
    maxH = Math.min(23, Math.max(minH + 1, maxH));

    let spine = '';
    for (let h = minH; h <= maxH; h++) {
      const label = String(h).padStart(2, '0') + ':00';
      const atHour = timed.filter(s => Math.floor(toMin(s.start) / 60) === h);
      spine += `<div class="tt-hour">
        <div class="tt-hour-label">${label}</div>
        <div class="tt-hour-line"></div>
        <div class="tt-hour-events">${atHour.length ? atHour.map(renderBlock).join('') : '<div class="tt-empty-slot"></div>'}</div>
      </div>`;
    }

    const body = `
      <div class="day-timetable">
        ${allDay.length ? `
          <div class="tt-section-label">All day</div>
          <div class="tt-allday">${allDay.map(renderBlock).join('')}</div>
        ` : ''}
        <div class="tt-section-label">${timed.length ? 'By time' : 'Schedule'}</div>
        ${timed.length || allDay.length ? `<div class="tt-spine">${spine}</div>` : `
          <div class="tt-empty">
            <p class="text-muted">Nothing scheduled this day</p>
            <p class="text-muted" style="font-size:0.8rem">Classes, study plan, hobbies and calendar events appear here.</p>
          </div>
        `}
      </div>
      <button class="btn btn-primary w-full mt-2" onclick="App.showAddEventModal('${dateStr}')">+ Add Event</button>
    `;

    this.showModal(nice, body);
  },


  showAddEventModal(dateStr = '') {
    const subjects = Grades.getSubjects();
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const defaultDate = dateStr || new Date().toISOString().split('T')[0];
    const defaultDow = new Date(defaultDate + 'T12:00:00').getDay();
    this.showModal('Add Event', `
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" id="ev-title" placeholder="Event title">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select" id="ev-type">
            <option value="exam">Exam</option>
            <option value="test">Test</option>
            <option value="assignment">Assignment</option>
            <option value="homework">Homework</option>
            <option value="project">Project</option>
            <option value="tournament">Tournament</option>
            <option value="match">Match</option>
            <option value="competition">Competition</option>
            <option value="concert">Concert</option>
            <option value="study">Study Session</option>
            <option value="active-recall">Active Recall</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Subject / activity</label>
          <select class="form-select" id="ev-subject">
            <option value="">—</option>
            ${subjects.map(s => `<option value="${this.esc(s.name)}">${this.esc(s.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start date</label>
          <input class="form-input" type="date" id="ev-date" value="${defaultDate}">
        </div>
        <div class="form-group">
          <label class="form-label">End date</label>
          <input class="form-input" type="date" id="ev-end" title="Single multi-day span (ignored if recurring)">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Time</label>
          <input class="form-input" type="time" id="ev-time">
        </div>
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" id="ev-priority">
            <option>High</option><option selected>Medium</option><option>Low</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Repeat</label>
        <select class="form-select" id="ev-recur" onchange="App._evRecurChanged()">
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div id="ev-recur-opts" style="display:none">
        <div class="form-group" id="ev-byday-wrap">
          <label class="form-label">On days</label>
          <div class="recur-days" id="ev-byday">
            ${dayNames.map((n, i) => `
              <label class="recur-day-chip">
                <input type="checkbox" value="${i}" ${i === defaultDow ? 'checked' : ''}>
                <span>${n}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Until (optional)</label>
            <input class="form-input" type="date" id="ev-recur-until">
          </div>
          <div class="form-group">
            <label class="form-label">Max times (optional)</label>
            <input class="form-input" type="number" id="ev-recur-count" min="1" max="365" placeholder="∞">
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="ev-desc"></textarea>
      </div>
      <p class="text-muted" style="font-size:0.75rem">Recurring events expand on the calendar automatically. Academic types only create a linked task when not repeating.</p>
    `, () => {
      const title = document.getElementById('ev-title').value.trim();
      if (!title) return this.toast('Title required', 'error');
      let start = document.getElementById('ev-date').value;
      let end = document.getElementById('ev-end').value || null;
      if (start && end && end < start) { const t = start; start = end; end = t; }
      if (end && end === start) end = null;
      const recurFreq = document.getElementById('ev-recur')?.value || 'none';
      const byDay = [];
      document.querySelectorAll('#ev-byday input:checked').forEach(cb => byDay.push(parseInt(cb.value, 10)));
      const countRaw = document.getElementById('ev-recur-count')?.value;
      Calendar.addEvent({
        title,
        type: document.getElementById('ev-type').value,
        subject: document.getElementById('ev-subject').value,
        date: start,
        endDate: recurFreq === 'none' ? end : null,
        time: document.getElementById('ev-time').value,
        priority: document.getElementById('ev-priority').value,
        description: document.getElementById('ev-desc').value,
        recurFreq,
        recurByDay: byDay,
        recurUntil: document.getElementById('ev-recur-until')?.value || null,
        recurCount: countRaw ? parseInt(countRaw, 10) : null
      });
      this.closeModal();
      this.toast(recurFreq !== 'none' ? 'Recurring event added' : (end ? 'Multi-day event added' : 'Event added'), 'success');
      this.renderCalendar();
      this.refreshDashboard();
    });
  },

  _evRecurChanged() {
    const freq = document.getElementById('ev-recur')?.value || 'none';
    const opts = document.getElementById('ev-recur-opts');
    const byday = document.getElementById('ev-byday-wrap');
    if (opts) opts.style.display = freq === 'none' ? 'none' : 'block';
    if (byday) byday.style.display = (freq === 'weekly' || freq === 'biweekly') ? 'block' : 'none';
  },

  deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    Calendar.deleteEvent(id);
    this.closeModal();
    this.toast('Event deleted', 'success');
    this.renderCalendar();
    this.refreshDashboard();
  },

  deleteEventFromDay(id, dateStr) {
    if (!confirm('Delete this event (whole series if recurring)?')) return;
    Calendar.deleteEvent(id);
    this.toast('Event deleted', 'success');
    this.renderCalendar();
    this.refreshDashboard();
    this.openDayModal(dateStr);
  },

  skipOccurrenceFromDay(masterId, occurrenceDate, dateStr) {
    Calendar.skipOccurrence(masterId, occurrenceDate);
    this.toast('Skipped this occurrence', 'success');
    this.renderCalendar();
    this.refreshDashboard();
    this.openDayModal(dateStr);
  },

  // ========== TASKS ==========
  renderTasks() {
    const filterStatus = document.getElementById('task-filter-status')?.value || '';
    const filterSubject = document.getElementById('task-filter-subject')?.value || '';
    const sort = document.getElementById('task-sort')?.value || 'deadline';

    const tasks = Tasks.filter({
      status: filterStatus || undefined,
      subject: filterSubject || undefined,
      sort
    });

    const subjSelect = document.getElementById('task-filter-subject');
    if (subjSelect && subjSelect.options.length <= 1) {
      Grades.getSubjects().forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        subjSelect.appendChild(opt);
      });
    }

    const container = document.getElementById('tasks-list');
    if (!container) return;

    const overdue = Tasks.getOverdue();
    let head = '';
    if (overdue.length) {
      head = `<div class="smart-banner-item mb-1">${overdue.length} overdue task(s)</div>`;
    }

    if (tasks.length === 0) {
      container.innerHTML = head + '<div class="empty-state"><p>No tasks yet</p><button class="btn btn-primary btn-sm" onclick="App.showAddTaskModal()">Add task</button></div>';
      return;
    }

    container.innerHTML = head + tasks.map(task => {
      const isOverdue = task.status !== 'Completed' && task.dueDate && new Date(task.dueDate + 'T00:00:00') < new Date(new Date().toDateString());
      const color = Grades.getColor(task.subject);
      const progress = task.progress != null ? task.progress : 0;
      const left = Tasks.timeRemaining(task);
      const subs = (task.subtasks || []).map(s => `
        <label class="subtask-row" onclick="event.stopPropagation()">
          <input type="checkbox" ${s.done ? 'checked' : ''} onchange="App.toggleSubtask('${task.id}','${s.id}')">
          <span class="${s.done ? 'done' : ''}">${this.esc(s.title)}</span>
        </label>`).join('');
      const diff = task.difficulty ? ` · Diff ${task.difficulty}/5` : '';
      const conf = task.confidence ? ` · Conf ${task.confidence}/5` : '';
      const pinClass = task.pinned ? 'pinned' : '';
      return `
      <div class="task-card ${task.status === 'Completed' ? 'completed' : ''} ${isOverdue ? 'overdue-task' : ''} ${pinClass}">
        ${task.pinned ? '<span class="pin-badge" title="Pinned">📌</span>' : ''}
        <div class="task-checkbox ${task.status === 'Completed' ? 'checked' : ''}" onclick="App.toggleTask('${task.id}')">${task.status === 'Completed' ? '✓' : ''}</div>
        <div class="task-content" onclick="App.editTask('${task.id}')">
          <div class="task-title">${this.esc(task.title)}</div>
          <div class="task-meta">
            ${task.subject ? `<span class="subject-chip" style="--chip:${color}"></span><span>${this.esc(task.subject)}</span>` : ''}
            <span>${task.priority}</span>
            <span>${task.type}</span>
            ${(task.startDate || task.dueDate) ? `<span class="${isOverdue ? 'text-danger' : ''}">${task.startDate && task.dueDate && task.startDate !== task.dueDate ? task.startDate + ' → ' + task.dueDate : 'Due ' + (task.dueDate || task.startDate)}</span>` : ''}
            ${diff}${conf}
          </div>
          ${task.estimatedTime ? `<div class="task-meta">Est ${Tasks.formatMinutes(task.estimatedTime)}${left != null ? ` · Left ${Tasks.formatMinutes(left)}` : ''} · ${progress}%</div>` : (progress ? `<div class="task-meta">${progress}%</div>` : '')}
          ${progress ? `<div class="progress-bar mt-1" style="max-width:200px"><div class="progress-fill" style="width:${progress}%"></div></div>` : ''}
          ${subs ? `<div class="subtask-list">${subs}</div>` : ''}
        </div>
        <div class="task-actions">
          ${task.status !== 'Completed' ? `<button class="btn btn-ghost btn-sm" title="Start focus & log time" onclick="event.stopPropagation();App.focusOnTask('${task.id}')">Focus</button>` : ''}
          <button class="btn btn-ghost btn-sm pin-btn ${task.pinned ? 'pinned' : ''}" title="${task.pinned ? 'Unpin' : 'Pin'}" onclick="event.stopPropagation();App.toggleTaskPin('${task.id}')">${task.pinned ? '📌' : 'Pin'}</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();App.editTask('${task.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();App.deleteTask('${task.id}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  },

  showAddTaskModal(editId = null) {
    const task = editId ? Tasks.getById(editId) : null;
    const subjects = Grades.getSubjects();
    const subLines = (task?.subtasks || []).map(s => s.title).join('\n');
    this.showModal(task ? 'Edit task' : 'Add task', `
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" id="task-title" value="${task ? this.esc(task.title) : ''}" placeholder="e.g. Quadratic equations homework">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select" id="task-type">
            ${Tasks.TYPES.map(ty => `<option ${task?.type === ty ? 'selected' : ''}>${ty}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Subject</label>
          <select class="form-select" id="task-subject">
            <option value="">—</option>
            ${subjects.map(s => `<option value="${this.esc(s.name)}" ${task?.subject === s.name ? 'selected' : ''}>${this.esc(s.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start date</label>
          <input class="form-input" type="date" id="task-start" value="${task?.startDate || ''}" title="Optional — for multi-day tasks / projects">
        </div>
        <div class="form-group">
          <label class="form-label">Due date</label>
          <input class="form-input" type="date" id="task-due" value="${task?.dueDate || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" id="task-priority">
            ${Tasks.PRIORITIES.map(pr => `<option ${task?.priority === pr ? 'selected' : ''}>${pr}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="task-status">
            ${Tasks.STATUSES.map(st => `<option ${task?.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Est. minutes</label>
          <input class="form-input" type="number" id="task-est" min="0" value="${task?.estimatedTime ?? ''}" placeholder="90">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Difficulty 1–5</label>
          <input class="form-input" type="number" id="task-diff" min="1" max="5" value="${task?.difficulty ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Confidence 1–5</label>
          <input class="form-input" type="number" id="task-conf" min="1" max="5" value="${task?.confidence ?? ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Subtasks (one per line)</label>
        <textarea class="form-textarea" id="task-subs" placeholder="Research&#10;Examples&#10;Exercises&#10;Submit">${this.esc(subLines)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="task-notes">${task ? this.esc(task.notes || task.description || '') : ''}</textarea>
      </div>
      <div class="pref-row" style="border:none;padding:0.25rem 0">
        <div>
          <div class="pref-row-label">Pin to top</div>
          <div class="pref-row-desc">Show a pin on the card and keep it first in the list</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" id="task-pinned" ${task?.pinned ? 'checked' : ''}><span class="toggle-slider"></span></label>
      </div>
      <p class="text-muted" style="font-size:0.75rem">Start + due date = multi-day task on the calendar. Single due date works as before.</p>
    `, () => {
      const title = document.getElementById('task-title').value.trim();
      if (!title) return this.toast('Title required', 'error');
      const subRaw = document.getElementById('task-subs').value.split('\n').map(s => s.trim()).filter(Boolean);
      const existing = task?.subtasks || [];
      const subtasks = subRaw.map((title, i) => {
        const prev = existing.find(s => s.title === title) || existing[i];
        return { id: prev?.id, title, done: prev?.done || false };
      });
      const payload = {
        title,
        type: document.getElementById('task-type').value,
        subject: document.getElementById('task-subject').value,
        startDate: document.getElementById('task-start').value,
        dueDate: document.getElementById('task-due').value,
        pinned: document.getElementById('task-pinned')?.checked || false,
        priority: document.getElementById('task-priority').value,
        status: document.getElementById('task-status').value,
        estimatedTime: document.getElementById('task-est').value || null,
        difficulty: document.getElementById('task-diff').value || null,
        confidence: document.getElementById('task-conf').value || null,
        notes: document.getElementById('task-notes').value,
        description: document.getElementById('task-notes').value,
        subtasks
      };
      if (task) {
        Tasks.update(task.id, payload);
        this.toast('Task updated', 'success');
      } else {
        Tasks.add(payload);
        this.toast('Task added · calendar updated', 'success');
      }
      this.closeModal();
      this.renderTasks();
      this.refreshDashboard();
    });
  },

  toggleSubtask(taskId, subId) {
    Tasks.toggleSubtask(taskId, subId);
    this.renderTasks();
    this.refreshDashboard();
  },


  editTask(id) { this.showAddTaskModal(id); },

  toggleTask(id) {
    Tasks.toggleComplete(id);
    this.renderTasks();
    this.refreshDashboard();
  },

  focusOnTask(id) {
    const t = Tasks.getById(id);
    if (!t) return;
    const mins = Pomodoro.studyDuration || 25;
    this.enterFocusMode(t.subject || 'Study', t.title, mins, t.id);
  },

  toggleTaskPin(id) {
    Tasks.togglePin(id);
    this.renderTasks();
    this.toast(Tasks.getById(id)?.pinned ? 'Pinned' : 'Unpinned', 'success');
  },

  deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    Tasks.delete(id);
    this.toast('Task deleted', 'success');
    this.renderTasks();
    this.refreshDashboard();
  },

  // ========== GRADES ==========
  renderGrades() {
    const avg = Grades.calculateOverallAverage();
    const cls = avg !== null ? Grades.getClassification(avg) : null;
    const highest = Grades.getHighestSubject();
    const lowest = Grades.getLowestSubject();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('grades-overall', avg !== null ? avg.toFixed(1) : '—');
    set('grades-class', cls ? cls.label : '—');
    const classEl = document.getElementById('grades-class');
    if (classEl && cls) classEl.className = 'gpa-classification ' + cls.class;
    set('grades-highest', highest ? `${highest.name}: ${highest.average.toFixed(1)}` : '—');
    set('grades-lowest', lowest ? `${lowest.name}: ${lowest.average.toFixed(1)}` : '—');

    // Subject table
    const subjects = Grades.getSubjects();
    const grades = Grades.getGrades();
    const tbody = document.getElementById('grades-subjects-body');
    if (tbody) {
      tbody.innerHTML = subjects.map(s => {
        const sAvg = Grades.getSubjectAverage(s.id, grades);
        const sCls = sAvg !== null ? Grades.getClassification(sAvg) : null;
        const count = grades.filter(g => g.subjectId === s.id).length;
        return `<tr>
          <td><strong>${this.esc(s.name)}</strong></td>
          <td>${sAvg !== null ? sAvg.toFixed(1) : '—'}</td>
          <td class="${sCls ? sCls.class : ''}">${sCls ? sCls.label : '—'}</td>
          <td>${count}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="App.showAddGradeModal('${s.id}')">+ Grade</button>
            <button class="btn btn-ghost btn-sm" onclick="App.deleteSubject('${s.id}')">Delete</button>
          </td>
        </tr>`;
      }).join('') || '<tr><td colspan="5" class="text-muted">No subjects yet</td></tr>';
    }

    // Recent grades
    const recent = Grades.getRecentGrades(10);
    const recentEl = document.getElementById('grades-recent');
    if (recentEl) {
      recentEl.innerHTML = recent.map(g => {
        const subj = subjects.find(s => s.id === g.subjectId);
        const gCls = Grades.getClassification(g.value);
        return `<div class="grade-item">
          <div class="event-info">
            <div class="event-title">${this.esc(g.name)} · ${this.esc(subj?.name || '')}</div>
            <div class="event-meta">${g.type} · ${g.date} · weight ${g.weight}</div>
          </div>
          <span class="fw-600 ${gCls.class}">${g.value}</span>
          <button class="btn btn-ghost btn-sm" onclick="App.deleteGrade('${g.id}')">✕</button>
        </div>`;
      }).join('') || '<p class="text-muted">No grades yet</p>';
    }
  },

  showAddSubjectModal() {
    this.showModal('Add Subject', `
      <div class="form-group">
        <label class="form-label">Subject Name</label>
        <input class="form-input" id="subj-name" placeholder="e.g. Mathematics">
      </div>
    `, () => {
      const name = document.getElementById('subj-name').value.trim();
      if (!name) return this.toast('Name required', 'error');
      const result = Grades.addSubject(name);
      if (result?.error) return this.toast(result.error, 'error');
      this.closeModal();
      this.toast('Subject added', 'success');
      this.renderGrades();
      this.refreshDashboard();
    });
  },

  showAddGradeModal(subjectId = '') {
    const subjects = Grades.getSubjects();
    this.showModal('Add Grade', `
      <div class="form-group">
        <label class="form-label">Subject</label>
        <select class="form-select" id="grade-subject">
          ${subjects.map(s => `<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${this.esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" id="grade-name" placeholder="e.g. Test 1">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select" id="grade-type">
            <option>Test</option><option>Exam</option><option>Homework</option>
            <option>Project</option><option>Quiz</option><option>Presentation</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Grade (0–20)</label>
          <input class="form-input" type="number" id="grade-value" min="0" max="20" step="0.1">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Weight / Coefficient</label>
          <input class="form-input" type="number" id="grade-weight" min="0.1" step="0.1" value="1">
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" type="date" id="grade-date" value="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>
    `, () => {
      const value = parseFloat(document.getElementById('grade-value').value);
      if (isNaN(value) || value < 0 || value > 20) return this.toast('Grade must be 0–20', 'error');
      Grades.addGrade({
        subjectId: document.getElementById('grade-subject').value,
        name: document.getElementById('grade-name').value || 'Grade',
        type: document.getElementById('grade-type').value,
        value,
        weight: document.getElementById('grade-weight').value,
        date: document.getElementById('grade-date').value
      });
      this.closeModal();
      this.toast('Grade added', 'success');
      this.renderGrades();
      this.refreshDashboard();
    });
  },

  deleteSubject(id) {
    if (!confirm('Delete subject and all its grades?')) return;
    Grades.deleteSubject(id);
    this.toast('Subject deleted', 'success');
    this.renderGrades();
    this.refreshDashboard();
  },

  deleteGrade(id) {
    if (!confirm('Delete this grade?')) return;
    Grades.deleteGrade(id);
    this.toast('Grade deleted', 'success');
    this.renderGrades();
    this.refreshDashboard();
  },

  // ========== ACTIVE RECALL ==========
  renderActiveRecall() {
    const topics = ActiveRecall.getAll();
    const due = ActiveRecall.getDueToday();
    const container = document.getElementById('recall-list');
    const dueEl = document.getElementById('recall-due');

    if (dueEl) {
      dueEl.innerHTML = due.length === 0
        ? '<p class="text-muted">No reviews due today</p>'
        : due.map(({ topic, review }) => {
          const tag = review.isMaintenance ? 'Maintenance' : review.isExtra ? 'Extra (hard)' : review.isRestart ? 'Restart ladder' : `Review #${review.reviewNumber}`;
          const overdue = review.scheduledDate < new Date().toISOString().split('T')[0];
          return `
          <div class="card mb-1" style="padding:1rem">
            <div class="flex justify-between items-center">
              <div>
                <strong>${this.esc(topic.topic)}</strong>
                <div class="text-muted" style="font-size:0.8125rem">${topic.subject || ''} · ${tag}${overdue ? ' · overdue' : ''}</div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="App.startRecallSession('${topic.id}', '${review.id}')">Start Review</button>
            </div>
          </div>`;
        }).join('');
    }

    if (container) {
      container.innerHTML = topics.length === 0
        ? '<div class="empty-state"><p>No topics yet. Add one to start spaced repetition!</p></div>'
        : topics.map(t => {
          const st = ActiveRecall.getTopicStats ? ActiveRecall.getTopicStats(t) : {
            completed: t.reviews.filter(r => r.completed).length,
            total: t.reviews.length,
            ease: t.ease || 2.5,
            interval: t.interval || 0,
            lapses: t.lapses || 0
          };
          const next = (t.reviews || []).filter(r => !r.completed).sort((a,b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
          return `
            <div class="card mb-1" style="padding:1rem">
              <div class="flex justify-between items-center">
                <div>
                  <strong>${this.esc(t.topic)}</strong>
                  <div class="text-muted" style="font-size:0.8125rem">
                    ${t.subject || ''} · Learned ${t.learnedDate}
                    · ${st.completed}/${st.total} done
                    · ease ${Number(st.ease).toFixed(2)}
                    ${st.interval ? ` · interval ${st.interval}d` : ''}
                    ${st.lapses ? ` · ${st.lapses} lapse(s)` : ''}
                    ${next ? ` · next ${next.scheduledDate}` : ''}
                  </div>
                  <div class="progress-bar mt-1" style="width:200px">
                    <div class="progress-fill" style="width:${st.total ? (st.completed/st.total)*100 : 0}%"></div>
                  </div>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="App.deleteRecall('${t.id}')">Delete</button>
              </div>
            </div>
          `;
        }).join('');
    }
  },

  showAddRecallModal() {
    const subjects = Grades.getSubjects();
    this.showModal('Add Topic for Active Recall', `
      <div class="form-group">
        <label class="form-label">What are you studying?</label>
        <input class="form-input" id="ar-topic" placeholder="e.g. Physics — Newton's Laws">
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <select class="form-select" id="ar-subject">
          <option value="">—</option>
          ${subjects.map(s => `<option value="${this.esc(s.name)}">${this.esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">When did you learn this?</label>
        <input class="form-input" type="date" id="ar-date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <p class="text-muted" style="font-size:0.8125rem">Starts with Day 1, 3, 7, 14, 30. Easy lengthens gaps; Difficult / Need again rebuilds the ladder from tomorrow. After the ladder, maintenance reviews continue.</p>
    `, () => {
      const topic = document.getElementById('ar-topic').value.trim();
      if (!topic) return this.toast('Topic required', 'error');
      ActiveRecall.add(topic, document.getElementById('ar-subject').value, document.getElementById('ar-date').value);
      this.closeModal();
      this.toast('Topic added with review schedule', 'success');
      this.renderActiveRecall();
      this.refreshDashboard();
    });
  },

  startRecallSession(topicId, reviewId) {
    const topic = ActiveRecall.getById(topicId);
    if (!topic) return;
    const prompt = ActiveRecall.getRandomPrompt();

    this.showModal('Active Recall Session', `
      <div class="ar-prompt">
        <div class="ar-prompt-text">${prompt}</div>
        <div class="ar-topic">${this.esc(topic.topic)}</div>
        <div class="text-muted">${topic.subject || ''}</div>
      </div>
      <p class="text-secondary" style="text-align:center;margin:1rem 0">Take your time. Explain out loud or write notes. Rating adjusts your schedule (easy → longer gaps, hard → restart ladder).</p>
      <div class="ar-difficulty-btns">
        <button class="btn btn-success" onclick="App.finishRecall('${topicId}','${reviewId}','Easy')">Easy</button>
        <button class="btn btn-primary" onclick="App.finishRecall('${topicId}','${reviewId}','Good')">Good</button>
        <button class="btn btn-warning" onclick="App.finishRecall('${topicId}','${reviewId}','Difficult')">Difficult</button>
        <button class="btn btn-danger" onclick="App.finishRecall('${topicId}','${reviewId}','Need to review again')">Need again</button>
      </div>
    `, null, true);
  },

  finishRecall(topicId, reviewId, difficulty) {
    ActiveRecall.completeReview(topicId, reviewId, difficulty);
    this.closeModal();
    this.toast(`Review marked as ${difficulty}`, 'success');
    this.renderActiveRecall();
    this.refreshDashboard();
  },

  deleteRecall(id) {
    if (!confirm('Delete this topic and all its reviews?')) return;
    ActiveRecall.delete(id);
    this.toast('Topic deleted', 'success');
    this.renderActiveRecall();
    this.refreshDashboard();
  },

  // ========== PLANNER ==========
  renderPlanner() {
    const schedule = Planner.getStudySchedule();
    const container = document.getElementById('planner-schedule');
    const conflicts = Planner.detectConflicts();

    const conflictEl = document.getElementById('planner-conflicts');
    if (conflictEl) {
      if (conflicts.length > 0) {
        conflictEl.innerHTML = `
          <div class="conflict-alert">
            <h4>⚠️ ${conflicts.length} schedule conflict(s) detected</h4>
            ${conflicts.map(c => `<p style="font-size:0.875rem">${this.esc(c.message)}</p>`).join('')}
          </div>
        `;
      } else {
        conflictEl.innerHTML = '';
      }
    }

    if (container) {
      if (schedule.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No study schedule yet. Generate one!</p></div>';
      } else {
        // Group by date
        const byDate = {};
        schedule.forEach(s => {
          if (!byDate[s.date]) byDate[s.date] = [];
          byDate[s.date].push(s);
        });
        container.innerHTML = Object.entries(byDate).map(([date, sessions]) => `
          <div class="card mb-2">
            <h4 class="mb-1">${new Date(date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', month: 'short', day: 'numeric' })}</h4>
            ${sessions.map(s => `
              <div class="schedule-item">
                <span class="schedule-time">${s.startTime}–${s.endTime}</span>
                <span class="schedule-subject">${this.esc(s.title)}</span>
                <span class="badge badge-${s.type === 'active-recall' ? 'purple' : 'success'}">${s.type === 'active-recall' ? 'Recall' : 'Study'}</span>
              </div>
            `).join('')}
          </div>
        `).join('');
      }
    }
  },

  generateSchedule() {
    const hours = parseFloat(document.getElementById('plan-hours')?.value) || 3;
    const start = document.getElementById('plan-start')?.value || '16:30';
    const end = document.getElementById('plan-end')?.value || '21:00';

    const schedule = Planner.generate({
      days: 7,
      availableHoursPerDay: hours,
      preferredStart: start,
      preferredEnd: end
    });

    if (schedule.length === 0) {
      this.toast('Could not generate schedule. Add subjects, deadlines, or school schedule first.', 'warning');
      return;
    }

    Planner.saveSchedule(schedule);
    this.toast('Study schedule generated!', 'success');
    this.renderPlanner();
    this.refreshDashboard();
  },

  // ========== POMODORO PAGE ==========
  renderPomodoroPage() {
    Pomodoro.updateUI();
  },

  // ========== STATISTICS ==========
  renderStatistics() {
    const data = Storage.getUserData();
    if (!data) return;
    const s = data.statistics;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-study-time', this.formatMinutes(s.totalStudyTime || 0));
    set('stat-pomodoros', s.pomodorosCompleted || 0);
    set('stat-streak', s.studyStreak || 0);
    set('stat-tasks', s.tasksCompleted || 0);
    set('stat-recall', s.activeRecallSessions || 0);
    set('stat-avg', Grades.calculateOverallAverage()?.toFixed(1) || '—');

    // Weekly chart
    const weekly = s.weeklyStudyTime || {};
    const weeks = Object.keys(weekly).sort().slice(-8);
    const chartEl = document.getElementById('stat-weekly-chart');
    if (chartEl) {
      const max = Math.max(...weeks.map(w => weekly[w] || 0), 1);
      chartEl.innerHTML = weeks.map(w => {
        const h = ((weekly[w] || 0) / max) * 100;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center">
          <div class="chart-bar" style="height:${h}%;width:100%" title="${weekly[w]} min"></div>
          <div class="chart-label">${w.slice(5)}</div>
        </div>`;
      }).join('') || '<p class="text-muted">No data yet</p>';
    }
  },

  // ========== SUBJECTS ==========
  renderSubjects() {
    const subjects = Grades.getSubjects();
    const grades = Grades.getGrades();
    const container = document.getElementById('subjects-list');
    if (!container) return;

    container.innerHTML = subjects.length === 0
      ? '<div class="empty-state"><p>No subjects yet</p><button class="btn btn-primary" onclick="App.showAddSubjectModal()">Add Subject</button></div>'
      : subjects.map(s => {
        const avg = Grades.getSubjectAverage(s.id, grades);
        const cls = avg !== null ? Grades.getClassification(avg) : null;
        const count = grades.filter(g => g.subjectId === s.id).length;
        const upcoming = Tasks.getAll().filter(t => t.subject === s.name && t.status !== 'Completed' && t.dueDate).slice(0, 3);
        const recalls = ActiveRecall.getAll().filter(t => t.subject === s.name);

        return `
          <div class="card mb-2">
            <div class="card-header">
              <h3>${this.esc(s.name)}</h3>
              <span class="fw-600 ${cls ? cls.class : ''}">${avg !== null ? avg.toFixed(1) : '—'} ${cls ? '· ' + cls.label : ''}</span>
            </div>
            <div class="text-muted mb-1" style="font-size:0.8125rem">${count} grade(s) · ${recalls.length} active recall topic(s)</div>
            ${upcoming.length ? `<div class="mt-1"><strong style="font-size:0.8125rem">Upcoming:</strong>
              ${upcoming.map(t => `<div class="event-meta">${this.esc(t.title)} — ${t.dueDate}</div>`).join('')}
            </div>` : ''}
            <div class="mt-1 flex gap-1">
              <button class="btn btn-secondary btn-sm" onclick="App.showAddGradeModal('${s.id}')">+ Grade</button>
              <button class="btn btn-ghost btn-sm" onclick="App.deleteSubject('${s.id}')">Delete</button>
            </div>
          </div>
        `;
      }).join('');
  },

  // ========== SCHOOL SCHEDULE ==========
  renderSchoolSchedule() {
    const schedule = Planner.getSchoolSchedule();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const container = document.getElementById('school-schedule-list');
    if (!container) return;

    if (schedule.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No classes yet. Add your school timetable.</p></div>';
      return;
    }

    // Group by day
    const byDay = {};
    schedule.forEach(c => {
      if (!byDay[c.day]) byDay[c.day] = [];
      byDay[c.day].push(c);
    });

    container.innerHTML = Object.entries(byDay).sort((a,b) => a[0]-b[0]).map(([day, classes]) => `
      <div class="card mb-2">
        <h4 class="mb-1">${days[day]}</h4>
        ${classes.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(c => `
          <div class="schedule-item">
            <span class="schedule-time">${c.startTime}–${c.endTime}</span>
            <span class="schedule-subject">${this.esc(c.subject)}</span>
            <span class="text-muted" style="font-size:0.75rem">${c.room || ''} ${c.teacher || ''}</span>
            <button class="btn btn-ghost btn-sm" onclick="App.deleteClass('${c.id}')">✕</button>
          </div>
        `).join('')}
      </div>
    `).join('');
  },

  showAddClassModal() {
    this.showModal('Add Class', `
      <div class="form-group">
        <label class="form-label">Day</label>
        <select class="form-select" id="class-day">
          <option value="1">Monday</option><option value="2">Tuesday</option>
          <option value="3">Wednesday</option><option value="4">Thursday</option>
          <option value="5">Friday</option><option value="6">Saturday</option>
          <option value="0">Sunday</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start Time</label>
          <input class="form-input" type="time" id="class-start" value="08:00">
        </div>
        <div class="form-group">
          <label class="form-label">End Time</label>
          <input class="form-input" type="time" id="class-end" value="09:00">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <input class="form-input" id="class-subject" placeholder="Mathematics">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Teacher</label>
          <input class="form-input" id="class-teacher">
        </div>
        <div class="form-group">
          <label class="form-label">Room</label>
          <input class="form-input" id="class-room">
        </div>
      </div>
      <div class="pref-row" style="border:none;padding:0.25rem 0">
        <div class="pref-row-label">Recurring weekly</div>
        <label class="toggle-switch"><input type="checkbox" id="class-recurring" checked><span class="toggle-slider"></span></label>
      </div>
    `, () => {
      const subject = document.getElementById('class-subject').value.trim();
      if (!subject) return this.toast('Subject required', 'error');
      Planner.addClass({
        day: parseInt(document.getElementById('class-day').value),
        startTime: document.getElementById('class-start').value,
        endTime: document.getElementById('class-end').value,
        subject,
        teacher: document.getElementById('class-teacher').value,
        room: document.getElementById('class-room').value,
        recurring: document.getElementById('class-recurring')?.checked !== false
      });
      this.closeModal();
      this.toast('Class added', 'success');
      this.renderSchoolSchedule();
    });
  },

  deleteClass(id) {
    Planner.deleteClass(id);
    this.toast('Class removed', 'success');
    this.renderSchoolSchedule();
  },

  // ========== PROFILE ==========
  renderProfile() {
    const profile = Auth.getProfile();
    if (!profile) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('profile-name', profile.name || Storage.getCurrentUser());
    set('profile-email', profile.email || '—');
    set('profile-username', Storage.getCurrentUser());
    set('profile-created', profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—');

    const avatar = document.getElementById('profile-avatar');
    if (avatar) avatar.textContent = (profile.name || Storage.getCurrentUser()).charAt(0).toUpperCase();

    const data = Storage.getUserData();
    if (!data) return;
    const p = data.profile.preferences || {};
    const el = (id) => document.getElementById(id);

    if (el('pref-displayname')) el('pref-displayname').value = profile.name || '';
    if (el('pref-email')) el('pref-email').value = profile.email || '';
    if (el('pref-study')) el('pref-study').value = p.pomodoroStudy || 25;
    if (el('pref-short')) el('pref-short').value = p.pomodoroShortBreak || 5;
    if (el('pref-long')) el('pref-long').value = p.pomodoroLongBreak || 15;
    if (el('pref-notif')) el('pref-notif').checked = p.notifications !== false;
    if (el('pref-animations')) el('pref-animations').checked = p.animations !== false;
    if (el('pref-compact')) el('pref-compact').checked = !!p.compactMode;
    if (el('pref-theme')) el('pref-theme').value = p.theme || 'light';
    if (el('pref-hide-nav')) el('pref-hide-nav').checked = !!p.hideNavbar;
    if (el('pref-distraction')) el('pref-distraction').checked = !!p.distractionFree;
    if (el('pref-hide-stats')) el('pref-hide-stats').checked = !!p.hideStats;

    const accent = p.accentColor || '#6366f1';
    if (el('pref-accent-custom')) el('pref-accent-custom').value = accent;

    // Highlight active swatch
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color.toLowerCase() === accent.toLowerCase());
      sw.onclick = () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        if (el('pref-accent-custom')) el('pref-accent-custom').value = sw.dataset.color;
        this.setAccentColor(sw.dataset.color);
      };
    });

    if (el('pref-accent-custom')) {
      el('pref-accent-custom').oninput = (e) => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        this.setAccentColor(e.target.value);
      };
    }

    // Live theme preview
    if (el('pref-theme')) {
      el('pref-theme').onchange = (e) => {
        document.documentElement.setAttribute('data-theme', e.target.value);
      };
    }
    if (el('pref-animations')) {
      el('pref-animations').onchange = (e) => {
        document.body.classList.toggle('reduce-motion', !e.target.checked);
      };
    }
    if (el('pref-compact')) {
      el('pref-compact').onchange = (e) => {
        document.body.classList.toggle('compact-mode', e.target.checked);
      };
    }
  },

  savePreferences() {
    const data = Storage.getUserData();
    if (!data) return;
    if (!data.profile.preferences) data.profile.preferences = {};

    const name = document.getElementById('pref-displayname')?.value?.trim();
    const email = document.getElementById('pref-email')?.value?.trim();
    if (name !== undefined) data.profile.name = name || data.profile.name;
    if (email !== undefined) data.profile.email = email;

    const study = parseInt(document.getElementById('pref-study')?.value) || 25;
    const short = parseInt(document.getElementById('pref-short')?.value) || 5;
    const long = parseInt(document.getElementById('pref-long')?.value) || 15;

    data.profile.preferences.pomodoroStudy = study;
    data.profile.preferences.pomodoroShortBreak = short;
    data.profile.preferences.pomodoroLongBreak = long;
    data.profile.preferences.notifications = document.getElementById('pref-notif')?.checked !== false;
    data.profile.preferences.animations = document.getElementById('pref-animations')?.checked !== false;
    data.profile.preferences.compactMode = !!document.getElementById('pref-compact')?.checked;
    data.profile.preferences.hideNavbar = !!document.getElementById('pref-hide-nav')?.checked;
    data.profile.preferences.distractionFree = !!document.getElementById('pref-distraction')?.checked;
    data.profile.preferences.hideStats = !!document.getElementById('pref-hide-stats')?.checked;
    data.profile.preferences.theme = document.getElementById('pref-theme')?.value || 'light';
    data.profile.preferences.accentColor = document.getElementById('pref-accent-custom')?.value || '#6366f1';

    Storage.saveUserData(data);
    Pomodoro.setDurations(study, short, long);
    this.applyCustomization();
    this.updateTopbarAvatar();
    this.renderProfile();
    this.toast('Settings saved', 'success');
  },


  // ========== HOBBIES / SPORTS ==========
  hobbiesTab(name) {
    document.querySelectorAll('#page-hobbies .sub-tab').forEach(t => t.classList.toggle('active', t.dataset.sub === name));
    document.querySelectorAll('#page-hobbies .sub-panel').forEach(p => p.classList.remove('active'));
    const id = name === 'events' ? 'hobbies-events' : 'hobbies-activities';
    document.getElementById(id)?.classList.add('active');
    if (name === 'activities') this.renderHobbies();
    if (name === 'events') this.renderSportEvents();
  },

  renderHobbies() {
    const list = document.getElementById('hobbies-list');
    if (!list) return;
    if (typeof Hobbies === 'undefined') {
      list.innerHTML = '<p class="text-muted">Hobbies module not loaded.</p>';
      return;
    }
    const items = Hobbies.getAllSorted ? Hobbies.getAllSorted() : Hobbies.getAll();
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><p>No sports or hobbies yet</p><button class="btn btn-primary btn-sm" onclick="App.showAddHobbyModal()">Add activity</button></div>';
      return;
    }
    const dayLabels = Hobbies.DAY_LABELS;
    list.innerHTML = items.map(h => {
      const days = (h.days || []).map(d => dayLabels[d]).join(', ') || 'No fixed days';
      const time = (h.startTime && h.endTime) ? `${h.startTime}–${h.endTime}` : '';
      const weekSessions = Hobbies.getSessionsThisWeek(h.id);
      const weekMin = weekSessions.reduce((s, x) => s + (x.minutes || 0), 0);
      const totalMin = Hobbies.totalMinutes(h.id);
      const color = h.color || '#10b981';
      return `<div class="card mb-2 hobby-card ${h.pinned ? 'pinned' : ''}" style="--hobby-color:${this.esc(color)}">
        ${h.pinned ? '<span class="pin-badge" title="Pinned">📌</span>' : ''}
        <div class="card-header">
          <div>
            <h3 style="margin:0;display:flex;align-items:center;gap:8px">
              <span class="subject-chip" style="--chip:${this.esc(color)}"></span>
              ${this.esc(h.name)}
            </h3>
            <div class="plan-meta">${this.esc(h.type)} · ${days}${time ? ' · ' + time : ''}</div>
          </div>
          <span class="badge ${h.type === 'Sport' ? 'badge-success' : 'badge-info'}">${this.esc(h.type)}</span>
        </div>
        ${h.notes ? `<p class="text-secondary" style="font-size:0.875rem;margin-bottom:12px">${this.esc(h.notes)}</p>` : ''}
        <div class="quiet-stats-row mb-1" style="border:none;padding:0;gap:20px">
          <div class="quiet-stat"><span>${weekMin}</span> min this week</div>
          <div class="quiet-stat"><span>${totalMin}</span> min total</div>
          <div class="quiet-stat"><span>${(h.sessions || []).length}</span> sessions</div>
        </div>
        <div class="flex gap-1 mt-1">
          <button class="btn btn-primary btn-sm" onclick="App.showLogHobbySession('${h.id}')">Log session</button>
          <button class="btn btn-ghost btn-sm pin-btn ${h.pinned ? 'pinned' : ''}" title="${h.pinned ? 'Unpin' : 'Pin'}" onclick="App.toggleHobbyPin('${h.id}')">${h.pinned ? '📌' : 'Pin'}</button>
          <button class="btn btn-secondary btn-sm" onclick="App.showAddHobbyModal('${h.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="App.deleteHobby('${h.id}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  },

  renderSportEvents() {
    const list = document.getElementById('sport-events-list');
    if (!list) return;
    if (typeof Hobbies === 'undefined') {
      list.innerHTML = '<p class="text-muted">Module not loaded.</p>';
      return;
    }
    const events = Hobbies.getEvents().slice().sort((a, b) => {
      const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pin !== 0) return pin;
      return (a.date || '').localeCompare(b.date || '');
    });
    if (!events.length) {
      list.innerHTML = '<div class="empty-state"><p>No tournaments, concerts or exams yet</p><button class="btn btn-primary btn-sm" onclick="App.showAddSportEventModal()">Add one</button></div>';
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    list.innerHTML = events.map(e => {
      const past = e.date && e.date < today;
      const cd = e.date ? Tasks.countdown(e.date) : null;
      const range = e.endDate && e.endDate !== e.date ? ` → ${e.endDate}` : '';
      const typeLabel = Hobbies.displayType ? Hobbies.displayType(e) : e.type;
      const badgeClass = e.type === 'Exam' ? 'badge-danger' : (e.type === 'Tournament' || e.type === 'Concert') ? 'badge-warning' : 'badge-info';
      return `<div class="card mb-2 hobby-card ${e.pinned ? 'pinned' : ''}" style="${past || e.completed ? 'opacity:0.55' : ''}">
        ${e.pinned ? '<span class="pin-badge" title="Pinned">📌</span>' : ''}
        <div class="card-header">
          <div>
            <h3 style="margin:0">${this.esc(e.title)}</h3>
            <div class="plan-meta">${this.esc(typeLabel)}${e.hobbyName ? ' · ' + this.esc(e.hobbyName) : ''} · ${e.date || '—'}${range}${e.time ? ' · ' + e.time : ''}${e.location ? ' · ' + this.esc(e.location) : ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <span class="badge ${badgeClass}">${this.esc(typeLabel)}</span>
            ${cd && !e.completed ? `<span class="countdown-badge ${cd.overdue ? 'overdue' : cd.days <= 2 ? 'urgent' : ''}">${cd.label}</span>` : ''}
            ${e.completed ? '<span class="text-muted" style="font-size:12px">Done</span>' : ''}
          </div>
        </div>
        ${e.notes ? `<p class="text-secondary" style="font-size:0.875rem;margin-bottom:10px">${this.esc(e.notes)}</p>` : ''}
        <div class="flex gap-1">
          ${!e.completed ? `<button class="btn btn-secondary btn-sm" onclick="App.completeSportEvent('${e.id}')">Mark done</button>` : ''}
          <button class="btn btn-ghost btn-sm pin-btn ${e.pinned ? 'pinned' : ''}" title="${e.pinned ? 'Unpin' : 'Pin'}" onclick="App.toggleSportEventPin('${e.id}')">${e.pinned ? '📌' : 'Pin'}</button>
          <button class="btn btn-ghost btn-sm" onclick="App.showAddSportEventModal('${e.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="App.deleteSportEvent('${e.id}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  },

  showAddHobbyModal(editId = null) {
    const hobby = editId ? Hobbies.getById(editId) : null;
    const daysChecked = (hobby?.days || []).reduce((acc, d) => { acc[d] = true; return acc; }, {});
    const dayChecks = Hobbies.DAY_LABELS.map((label, i) =>
      `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:13px">
        <input type="checkbox" class="hobby-day" value="${i}" ${daysChecked[i] ? 'checked' : ''}> ${label}
      </label>`
    ).join('');
    this.showModal(hobby ? 'Edit activity' : 'Add sport / hobby', `
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input class="form-input" id="hobby-name" value="${hobby ? this.esc(hobby.name) : ''}" placeholder="Football, Guitar, Running…">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select" id="hobby-type">
            ${Hobbies.TYPES.map(t => `<option ${hobby?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="hobby-color-swatches" id="hobby-swatches">
            ${(Hobbies.COLORS || ['#10b981','#3b82f6','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#06b6d4']).map(c =>
              `<button type="button" class="hobby-color-swatch ${(hobby?.color || '#10b981').toLowerCase() === c.toLowerCase() ? 'active' : ''}" data-color="${c}" style="background:${c}" onclick="document.querySelectorAll('#hobby-swatches .hobby-color-swatch').forEach(s=>s.classList.remove('active'));this.classList.add('active');document.getElementById('hobby-color').value='${c}'"></button>`
            ).join('')}
          </div>
          <input type="color" id="hobby-color" value="${hobby?.color || '#10b981'}" style="width:36px;height:28px;border:none;margin-top:8px;cursor:pointer;background:transparent">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Usual days</label>
        <div style="margin-top:6px">${dayChecks}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start</label>
          <input class="form-input" type="time" id="hobby-start" value="${hobby?.startTime || '18:00'}">
        </div>
        <div class="form-group">
          <label class="form-label">End</label>
          <input class="form-input" type="time" id="hobby-end" value="${hobby?.endTime || '19:30'}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="hobby-notes">${hobby ? this.esc(hobby.notes || '') : ''}</textarea>
      </div>
      <div class="pref-row" style="border:none;padding:0.25rem 0">
        <div>
          <div class="pref-row-label">Pin to top</div>
          <div class="pref-row-desc">Show a pin on the card and keep it first in the list</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" id="hobby-pinned" ${hobby?.pinned ? 'checked' : ''}><span class="toggle-slider"></span></label>
      </div>
      <div class="pref-row" style="border:none;padding:0.25rem 0">
        <div>
          <div class="pref-row-label">Block free time</div>
          <div class="pref-row-desc">Treat as busy so the planner skips these slots</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" id="hobby-busy" ${hobby?.linkAsBusy !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
      </div>
    `, () => {
      const name = document.getElementById('hobby-name').value.trim();
      if (!name) return this.toast('Name required', 'error');
      const days = [...document.querySelectorAll('.hobby-day:checked')].map(el => parseInt(el.value, 10));
      const payload = {
        name,
        type: document.getElementById('hobby-type').value,
        color: document.getElementById('hobby-color').value,
        days,
        startTime: document.getElementById('hobby-start').value,
        endTime: document.getElementById('hobby-end').value,
        notes: document.getElementById('hobby-notes').value,
        linkAsBusy: document.getElementById('hobby-busy').checked,
        pinned: document.getElementById('hobby-pinned')?.checked || false
      };
      if (hobby) {
        Hobbies.update(hobby.id, payload);
        this.toast('Activity updated', 'success');
      } else {
        Hobbies.add(payload);
        this.toast('Activity added', 'success');
      }
      this.closeModal();
      this.renderHobbies();
    });
  },

  showLogHobbySession(hobbyId) {
    const hobby = Hobbies.getById(hobbyId);
    if (!hobby) return;
    const today = new Date().toISOString().split('T')[0];
    this.showModal('Log session — ' + this.esc(hobby.name), `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" type="date" id="hobby-sess-date" value="${today}">
        </div>
        <div class="form-group">
          <label class="form-label">Minutes</label>
          <input class="form-input" type="number" id="hobby-sess-min" min="5" value="60">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" id="hobby-sess-notes" placeholder="Optional">
      </div>
    `, () => {
      Hobbies.logSession(hobbyId, {
        date: document.getElementById('hobby-sess-date').value,
        minutes: document.getElementById('hobby-sess-min').value,
        notes: document.getElementById('hobby-sess-notes').value
      });
      this.closeModal();
      this.renderHobbies();
      this.toast('Session logged', 'success');
    });
  },

  deleteHobby(id) {
    if (!confirm('Delete this activity and its sessions?')) return;
    Hobbies.delete(id);
    this.renderHobbies();
    this.toast('Activity removed', 'success');
  },

  toggleHobbyPin(id) {
    Hobbies.togglePin(id);
    this.renderHobbies();
    this.toast(Hobbies.getById(id)?.pinned ? 'Pinned' : 'Unpinned', 'success');
  },

  showAddSportEventModal(editId = null) {
    const event = editId ? Hobbies.getEventById(editId) : null;
    const hobbies = Hobbies.getAll();
    this.showModal(event ? 'Edit event' : 'Add tournament / concert / exam', `
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" id="sport-ev-title" value="${event ? this.esc(event.title) : ''}" placeholder="Regional tournament, concert, belt exam…">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select" id="sport-ev-type" onchange="App._sportEvTypeChanged()">
            ${Hobbies.EVENT_TYPES.map(t => `<option ${event?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Linked activity</label>
          <select class="form-select" id="sport-ev-hobby">
            <option value="">—</option>
            ${hobbies.map(h => `<option value="${h.id}" ${event?.hobbyId === h.id ? 'selected' : ''}>${this.esc(h.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group" id="sport-ev-custom-wrap" style="display:${event?.type === 'Other' ? 'block' : 'none'}">
        <label class="form-label">Custom type</label>
        <input class="form-input" id="sport-ev-custom" value="${event ? this.esc(event.customType || '') : ''}" placeholder="e.g. Workshop, Festival, Showcase…">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start date *</label>
          <input class="form-input" type="date" id="sport-ev-date" value="${event?.date || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">End date</label>
          <input class="form-input" type="date" id="sport-ev-end" value="${event?.endDate || ''}" title="For multi-day events">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Time</label>
          <input class="form-input" type="time" id="sport-ev-time" value="${event?.time || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" id="sport-ev-priority">
            ${['High','Medium','Low'].map(p => `<option ${event?.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Location</label>
        <input class="form-input" id="sport-ev-location" value="${event ? this.esc(event.location || '') : ''}" placeholder="Venue / city">
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="sport-ev-notes">${event ? this.esc(event.notes || '') : ''}</textarea>
      </div>
      <div class="pref-row" style="border:none;padding:0.25rem 0">
        <div>
          <div class="pref-row-label">Pin to top</div>
          <div class="pref-row-desc">Show a pin on the card and keep it first in the list</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" id="sport-ev-pinned" ${event?.pinned ? 'checked' : ''}><span class="toggle-slider"></span></label>
      </div>
    `, () => {
      const title = document.getElementById('sport-ev-title').value.trim();
      const date = document.getElementById('sport-ev-date').value;
      if (!title || !date) return this.toast('Title and date required', 'error');
      const hobbyId = document.getElementById('sport-ev-hobby').value || null;
      const hobby = hobbyId ? Hobbies.getById(hobbyId) : null;
      const type = document.getElementById('sport-ev-type').value;
      const payload = {
        title,
        type,
        customType: type === 'Other' ? (document.getElementById('sport-ev-custom')?.value || '').trim() : '',
        hobbyId,
        hobbyName: hobby ? hobby.name : '',
        date,
        endDate: document.getElementById('sport-ev-end').value || null,
        time: document.getElementById('sport-ev-time').value,
        location: document.getElementById('sport-ev-location').value.trim(),
        notes: document.getElementById('sport-ev-notes').value,
        priority: document.getElementById('sport-ev-priority').value,
        pinned: document.getElementById('sport-ev-pinned')?.checked || false
      };
      if (event) {
        Hobbies.updateEvent(event.id, payload);
        this.toast('Updated', 'success');
      } else {
        Hobbies.addEvent(payload);
        this.toast('Event added · calendar updated', 'success');
      }
      this.closeModal();
      this.renderSportEvents();
      this.refreshDashboard();
    });
  },

  _sportEvTypeChanged() {
    const type = document.getElementById('sport-ev-type')?.value;
    const wrap = document.getElementById('sport-ev-custom-wrap');
    if (wrap) wrap.style.display = type === 'Other' ? 'block' : 'none';
  },

  toggleSportEventPin(id) {
    Hobbies.togglePinEvent(id);
    this.renderSportEvents();
    this.refreshDashboard();
    this.toast(Hobbies.getEventById(id)?.pinned ? 'Pinned' : 'Unpinned', 'success');
  },

  completeSportEvent(id) {
    Hobbies.updateEvent(id, { completed: true });
    this.renderSportEvents();
    this.refreshDashboard();
    this.toast('Marked done', 'success');
  },

  deleteSportEvent(id) {
    if (!confirm('Delete this tournament / exam?')) return;
    Hobbies.deleteEvent(id);
    this.renderSportEvents();
    this.refreshDashboard();
    this.toast('Removed', 'success');
  },

  // ========== REMINDERS ==========
  checkReminders() {
    const data = Storage.getUserData();
    if (!data || data.profile.preferences?.notifications === false) return;
    if (document.body.classList.contains('focus-active')) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const reminders = [];
    // Exams in 1-3 days
    Tasks.getExamsAndTests(3).forEach(e => {
      const cd = Tasks.countdown(e.date);
      if (!cd.overdue) {
        reminders.push(`${e.subject || e.title} exam in ${cd.days === 0 ? 'less than a day' : cd.days + ' day(s)'}`);
      }
    });
    Calendar.getEvents().forEach(e => {
      if (e.completed) return;
      if (e.date === todayStr && e.type === 'active-recall') {
        reminders.push(`Review due today: ${e.title}`);
      }
    });
    // Stale recall topics
    ActiveRecall.getAll().forEach(topic => {
      const pending = topic.reviews?.filter(r => !r.completed).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
      if (pending && pending.scheduledDate < todayStr) {
        const days = Math.floor((new Date(todayStr) - new Date(pending.scheduledDate)) / 86400000);
        if (days >= 3) reminders.push(`You haven't reviewed "${topic.topic}" in ${days} days`);
      }
    });
    // Free time suggestion
    if (typeof ExamPrep !== 'undefined') {
      const free = ExamPrep.findFreeSlotsToday('16:00', '21:00', 40);
      if (free[0] && free[0].minutes >= 40) {
        const sug = this.computeStudySuggestion();
        if (sug) reminders.push(`You have ~${free[0].minutes} min free. Recommended: ${sug.subject}`);
      }
    }

    const banner = document.getElementById('reminder-banner');
    if (banner) {
      if (reminders.length > 0) {
        banner.innerHTML = reminders.slice(0, 2).map(r => `<div class="smart-banner-item">${this.esc(r)}</div>`).join('');
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
      }
    }
  },

  // ========== UTILITIES ==========
  showModal(title, bodyHtml, onConfirm, hideFooter = false) {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="App.closeModal()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${hideFooter ? '' : `<div class="modal-footer">
          <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="modal-confirm">Save</button>
        </div>`}
      </div>
    `;
    overlay.classList.add('active');
    if (onConfirm) {
      document.getElementById('modal-confirm')?.addEventListener('click', onConfirm);
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });
  },

  closeModal() {
    document.getElementById('modal-overlay')?.classList.remove('active');
  },

  toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  },

  renderList(id, items, renderer) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>Nothing here yet</p></div>';
      return;
    }
    el.innerHTML = items.map(renderer).join('');
  },

  formatMinutes(mins) {
    if (mins < 60) return mins + 'm';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  },

  esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  quickAddAssignment() { this.showAddTaskModal(); },
  quickAddTest() {
    this.showAddEventModal();
    setTimeout(() => {
      const typeEl = document.getElementById('ev-type');
      if (typeEl) typeEl.value = 'test';
    }, 100);
  },
  quickStartPomodoro() { this.startStudyingFlow(); },
  quickStartRecall() {
    this.navigate('study');
    this.studyTab('recall');
  },
  quickCreateSchedule() {
    this.navigate('schedule');
    this.scheduleTab('study');
  }
};


// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('app-layout')) {
    App.init();
  }
});

window.App = App;