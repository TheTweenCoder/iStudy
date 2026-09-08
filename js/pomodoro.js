**
 * Pomodoro Timer Module
 */

const Pomodoro = {
  timer: null,
  remaining: 25 * 60, // seconds
  mode: 'study', // study, shortBreak, longBreak
  isRunning: false,
  isPaused: false,
  sessionCount: 0,
  currentSubject: '',
  linkedTaskId: null,
  studyDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  completedThisSession: 0,

  init() {
    const data = Storage.getUserData();
    if (data && data.profile && data.profile.preferences) {
      this.studyDuration = data.profile.preferences.pomodoroStudy || 25;
      this.shortBreak = data.profile.preferences.pomodoroShortBreak || 5;
      this.longBreak = data.profile.preferences.pomodoroLongBreak || 15;
    }
    this.remaining = this.studyDuration * 60;
    this.updateUI();
  },

  start(subject = '', taskId = null) {
    if (this.isRunning && !this.isPaused) return;
    if (typeof subject === 'object' && subject) {
      if (subject.subject) this.currentSubject = subject.subject;
      if (subject.taskId) this.linkedTaskId = subject.taskId;
    } else {
      if (subject) this.currentSubject = subject;
      if (taskId) this.linkedTaskId = taskId;
    }
    this.isRunning = true;
    this.isPaused = false;

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
    this.updateUI();
  },

  clearLinkedTask() {
    this.linkedTaskId = null;
  },

  pause() {
    if (!this.isRunning) return;
    this.isPaused = true;
    clearInterval(this.timer);
    this.timer = null;
    this.updateUI();
  },

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.timer = setInterval(() => this.tick(), 1000);
    this.updateUI();
  },

  reset() {
    clearInterval(this.timer);
    this.timer = null;
    this.isRunning = false;
    this.isPaused = false;
    this.setMode(this.mode);
    this.updateUI();
  },

  skip() {
    this.completeSession();
  },

  tick() {
    if (this.remaining <= 0) {
      this.completeSession();
      return;
    }
    this.remaining--;
    this.updateUI();
  },

  completeSession() {
    clearInterval(this.timer);
    this.timer = null;
    this.isRunning = false;
    this.isPaused = false;

    const data = Storage.getUserData();
    if (data) {
      if (this.mode === 'study') {
        this.sessionCount++;
        this.completedThisSession++;
        data.statistics.pomodorosCompleted = (data.statistics.pomodorosCompleted || 0) + 1;
        data.statistics.totalStudyTime = (data.statistics.totalStudyTime || 0) + this.studyDuration;
        
        // Weekly tracking
        const weekKey = this.getWeekKey();
        if (!data.statistics.weeklyStudyTime) data.statistics.weeklyStudyTime = {};
        data.statistics.weeklyStudyTime[weekKey] = (data.statistics.weeklyStudyTime[weekKey] || 0) + this.studyDuration;

        // Monthly
        const monthKey = new Date().toISOString().slice(0, 7);
        if (!data.statistics.monthlyStudyTime) data.statistics.monthlyStudyTime = {};
        data.statistics.monthlyStudyTime[monthKey] = (data.statistics.monthlyStudyTime[monthKey] || 0) + this.studyDuration;

        // Log minutes onto linked task
        const linkedId = this.linkedTaskId;
        if (linkedId && data.assignments) {
          const tIdx = data.assignments.findIndex(t => t.id === linkedId);
          if (tIdx !== -1) {
            const t = data.assignments[tIdx];
            t.actualTime = (parseInt(t.actualTime, 10) || 0) + this.studyDuration;
            if (t.status === 'Not Started') t.status = 'In Progress';
            if (typeof Tasks !== 'undefined' && Tasks.calcProgress) {
              t.progress = Tasks.calcProgress(t.subtasks || [], t.status);
            }
            data.assignments[tIdx] = t;
            if (typeof Tasks !== 'undefined' && Tasks.syncCalendar) {
              Tasks.syncCalendar(data, t);
            }
          }
        }

        Storage.updateStreak();
        Storage.saveUserData(data);

        if (linkedId && typeof App !== 'undefined' && App.toast) {
          const t = (data.assignments || []).find(x => x.id === linkedId);
          if (t) {
            App.toast(`+${this.studyDuration} min logged on “${t.title}”`, 'success');
          }
        }

        // Auto transition to break
        if (this.sessionCount % 4 === 0) {
          this.setMode('longBreak');
        } else {
          this.setMode('shortBreak');
        }
        this.playNotification();
        this.updateUI();
        if (typeof App !== 'undefined') {
          App.refreshDashboard();
          const mins = this.mode === 'longBreak' ? this.longBreak : this.shortBreak;
          const next = this.currentSubject || 'your next session';
          App.showBreakOverlay(mins, next);
        }
        return;
      } else {
        this.setMode('study');
      }
    }

    this.playNotification();
    this.updateUI();
    if (typeof App !== 'undefined') App.refreshDashboard();
  },

  setMode(mode) {
    this.mode = mode;
    if (mode === 'study') this.remaining = this.studyDuration * 60;
    else if (mode === 'shortBreak') this.remaining = this.shortBreak * 60;
    else this.remaining = this.longBreak * 60;
  },

  setDurations(study, short, long) {
    this.studyDuration = study;
    this.shortBreak = short;
    this.longBreak = long;
    const data = Storage.getUserData();
    if (data) {
      data.profile.preferences.pomodoroStudy = study;
      data.profile.preferences.pomodoroShortBreak = short;
      data.profile.preferences.pomodoroLongBreak = long;
      Storage.saveUserData(data);
    }
    if (!this.isRunning) this.setMode(this.mode);
    this.updateUI();
  },

  getWeekKey() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().slice(0, 10);
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },

  playNotification() {
    // Browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pomodoro Complete!', {
        body: this.mode === 'study' ? 'Time for a break!' : 'Back to studying!',
        icon: '/favicon.ico'
      });
    }
    // Simple beep via AudioContext
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 200);
    } catch (e) {}
  },

  updateUI() {
    const timeStr = this.formatTime(this.remaining);
    const labels = { study: 'Focus Time', shortBreak: 'Short Break', longBreak: 'Long Break' };
    const modeLabel = labels[this.mode] || this.mode;
    const running = this.isRunning && !this.isPaused;

    document.querySelectorAll('#pomodoro-timer').forEach(el => {
      el.textContent = timeStr;
      el.classList.toggle('running', running);
    });
    document.querySelectorAll('#pomodoro-mode').forEach(el => {
      el.textContent = modeLabel;
    });
    document.querySelectorAll('#pomodoro-subject').forEach(el => {
      el.textContent = this.currentSubject || 'No subject selected';
      el.style.display = this.currentSubject ? 'block' : 'none';
    });
    document.querySelectorAll('#pomodoro-count').forEach(el => {
      el.textContent = `Pomodoro #${this.sessionCount + (this.mode === 'study' && this.isRunning ? 1 : 0)} · ${this.completedThisSession} completed today`;
    });
    document.querySelectorAll('#pomodoro-start').forEach(btn => {
      if (running) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'inline-flex';
        btn.textContent = this.isPaused ? 'Resume' : 'Start';
      }
    });
    document.querySelectorAll('#pomodoro-pause').forEach(btn => {
      btn.style.display = running ? 'inline-flex' : 'none';
    });
  }
};

window.Pomodoro = Pomodoro;