/**
 * Calendar Module — supports multi-day ranges and recurring events.
 *
 * Recurrence is stored on the master event and expanded at query time:
 *   recurFreq: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'
 *   recurInterval: number (default 1)
 *   recurByDay: number[] weekdays 0=Sun..6=Sat (weekly/biweekly; empty = start weekday only)
 *   recurUntil: YYYY-MM-DD | null
 *   recurCount: number | null  (max occurrences; optional)
 *   recurExceptions: string[] of YYYY-MM-DD skipped dates
 */

const Calendar = {
  currentDate: new Date(),
  view: 'month',

  /** Max horizon when expanding open-ended series (days from today) */
  EXPAND_HORIZON_DAYS: 120,

  getEvents() {
    const data = Storage.getUserData();
    return data ? (data.calendarEvents || []) : [];
  },

  isRecurring(e) {
    return !!(e && e.recurFreq && e.recurFreq !== 'none');
  },

  /**
   * Expand a master event into occurrence objects overlapping [rangeStart, rangeEnd]
   * (Date objects, inclusive, date-only).
   */
  expandEvent(master, rangeStart, rangeEnd) {
    if (!master || !master.date) return [];

    // Non-recurring: multi-day range or single day
    if (!this.isRecurring(master)) {
      const start = master.date;
      const end = master.endDate || master.date;
      const out = [];
      let d = new Date(start + 'T12:00:00');
      const last = new Date(end + 'T12:00:00');
      const rs = new Date(rangeStart); rs.setHours(12, 0, 0, 0);
      const re = new Date(rangeEnd); re.setHours(12, 0, 0, 0);
      while (d <= last) {
        if (d >= rs && d <= re) {
          out.push(this._occurrence(master, this.formatDate(d)));
        }
        d.setDate(d.getDate() + 1);
      }
      return out;
    }

    const exceptions = new Set(master.recurExceptions || []);
    const interval = Math.max(1, master.recurInterval || 1);
    const freq = master.recurFreq;
    const until = master.recurUntil
      ? new Date(master.recurUntil + 'T12:00:00')
      : null;
    const maxCount = master.recurCount > 0 ? master.recurCount : null;

    const seriesStart = new Date(master.date + 'T12:00:00');
    const rs = new Date(rangeStart); rs.setHours(12, 0, 0, 0);
    const re = new Date(rangeEnd); re.setHours(12, 0, 0, 0);

    // Hard stop if no until/count: horizon from today
    const horizon = new Date();
    horizon.setHours(12, 0, 0, 0);
    horizon.setDate(horizon.getDate() + this.EXPAND_HORIZON_DAYS);
    const hardEnd = until && until < horizon ? until : (until || horizon);
    const scanEnd = re < hardEnd ? re : hardEnd;

    const byDay = (master.recurByDay && master.recurByDay.length)
      ? master.recurByDay.map(Number)
      : [seriesStart.getDay()];

    const out = [];
    let count = 0;

    if (freq === 'daily') {
      let d = new Date(seriesStart);
      // Advance to first date >= rangeStart if needed (keep count correct)
      while (d < rs) {
        count++;
        if (maxCount && count >= maxCount) return out;
        d.setDate(d.getDate() + interval);
      }
      // recount from series start for accuracy
      count = 0;
      d = new Date(seriesStart);
      while (d <= scanEnd) {
        count++;
        if (maxCount && count > maxCount) break;
        const ds = this.formatDate(d);
        if (d >= rs && d <= re && !exceptions.has(ds)) {
          out.push(this._occurrence(master, ds));
        }
        d.setDate(d.getDate() + interval);
      }
      return out;
    }

    if (freq === 'weekly' || freq === 'biweekly') {
      const weekStep = (freq === 'biweekly' ? 2 : 1) * interval;
      // Iterate week by week from series start week
      let weekAnchor = new Date(seriesStart);
      weekAnchor.setDate(weekAnchor.getDate() - weekAnchor.getDay()); // Sunday of that week
      let weekIndex = 0;
      const endAnchor = new Date(scanEnd);
      endAnchor.setDate(endAnchor.getDate() + 7);

      while (weekAnchor <= endAnchor) {
        if (weekIndex % weekStep === 0) {
          byDay.forEach(dow => {
            const d = new Date(weekAnchor);
            d.setDate(d.getDate() + dow);
            if (d < seriesStart) return;
            if (until && d > until) return;
            if (d < rs || d > re) return;
            // count occurrences chronologically — approximate: only count if on/after series start
            const ds = this.formatDate(d);
            if (exceptions.has(ds)) return;
            // Respect count by checking how many valid occs before this date
            if (maxCount) {
              const n = this._countWeeklyBefore(master, d, byDay, weekStep, exceptions);
              if (n >= maxCount) return;
            }
            out.push(this._occurrence(master, ds));
          });
        }
        weekAnchor.setDate(weekAnchor.getDate() + 7);
        weekIndex++;
      }
      // Sort + unique
      const seen = new Set();
      return out
        .filter(o => {
          if (seen.has(o.occurrenceDate)) return false;
          seen.add(o.occurrenceDate);
          return true;
        })
        .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
    }

    if (freq === 'monthly') {
      let d = new Date(seriesStart);
      count = 0;
      while (d <= scanEnd) {
        count++;
        if (maxCount && count > maxCount) break;
        const ds = this.formatDate(d);
        if (d >= rs && d <= re && !exceptions.has(ds)) {
          out.push(this._occurrence(master, ds));
        }
        d = new Date(d);
        d.setMonth(d.getMonth() + interval);
        // Keep same day-of-month when possible
        const targetDay = seriesStart.getDate();
        if (d.getDate() !== targetDay) {
          // Clamped month (e.g. Jan 31 → Feb) — skip invalid by going to last day already done by JS
        }
      }
      return out;
    }

    return [this._occurrence(master, master.date)];
  },

  _countWeeklyBefore(master, beforeDate, byDay, weekStep, exceptions) {
    const seriesStart = new Date(master.date + 'T12:00:00');
    let weekAnchor = new Date(seriesStart);
    weekAnchor.setDate(weekAnchor.getDate() - weekAnchor.getDay());
    let weekIndex = 0;
    let n = 0;
    const limit = new Date(beforeDate);
    while (weekAnchor <= limit) {
      if (weekIndex % weekStep === 0) {
        byDay.forEach(dow => {
          const d = new Date(weekAnchor);
          d.setDate(d.getDate() + dow);
          if (d < seriesStart || d >= beforeDate) return;
          const ds = this.formatDate(d);
          if (exceptions.has(ds)) return;
          n++;
        });
      }
      weekAnchor.setDate(weekAnchor.getDate() + 7);
      weekIndex++;
      if (weekIndex > 500) break;
    }
    return n;
  },

  _occurrence(master, dateStr) {
    return {
      ...master,
      occurrenceDate: dateStr,
      date: dateStr, // treat as happening this day for consumers
      endDate: null, // single-day instance
      isOccurrence: this.isRecurring(master),
      masterId: master.id,
      // Preserve original start for editing series
      seriesDate: master.date,
      seriesEndDate: master.endDate || null
    };
  },

  getEventsForDate(dateStr) {
    const day = new Date(dateStr + 'T12:00:00');
    const masters = this.getEvents();
    const out = [];
    const seen = new Set();
    masters.forEach(m => {
      this.expandEvent(m, day, day).forEach(o => {
        const key = (o.masterId || o.id) + '@' + o.occurrenceDate;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(o);
      });
    });
    return out;
  },

  getEventsInRange(startDate, endDate) {
    const masters = this.getEvents();
    const out = [];
    const seen = new Set();
    masters.forEach(m => {
      this.expandEvent(m, startDate, endDate).forEach(o => {
        const key = (o.masterId || o.id) + '@' + o.occurrenceDate;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(o);
      });
    });
    return out.sort((a, b) => {
      const ta = (a.occurrenceDate || a.date) + 'T' + (a.time || '00:00');
      const tb = (b.occurrenceDate || b.date) + 'T' + (b.time || '00:00');
      return ta.localeCompare(tb);
    });
  },

  addEvent(eventData) {
    const data = Storage.getUserData();
    if (!data) return null;
    if (!data.calendarEvents) data.calendarEvents = [];

    const recurFreq = eventData.recurFreq || 'none';
    const event = {
      id: Storage.generateId(),
      title: eventData.title,
      subject: eventData.subject || '',
      date: eventData.date,
      endDate: recurFreq !== 'none' ? null : (eventData.endDate || null),
      time: eventData.time || '',
      endTime: eventData.endTime || '',
      description: eventData.description || '',
      priority: eventData.priority || 'Medium',
      type: eventData.type || 'other',
      completed: false,
      linkedTaskId: eventData.linkedTaskId || null,
      linkedRecallId: eventData.linkedRecallId || null,
      recurFreq,
      recurInterval: Math.max(1, parseInt(eventData.recurInterval, 10) || 1),
      recurByDay: Array.isArray(eventData.recurByDay) ? eventData.recurByDay.map(Number) : [],
      recurUntil: eventData.recurUntil || null,
      recurCount: eventData.recurCount ? parseInt(eventData.recurCount, 10) : null,
      recurExceptions: eventData.recurExceptions || [],
      createdAt: new Date().toISOString()
    };

    // Weekly with empty byDay → use start date weekday
    if ((recurFreq === 'weekly' || recurFreq === 'biweekly') && !event.recurByDay.length) {
      event.recurByDay = [new Date(event.date + 'T12:00:00').getDay()];
    }

    data.calendarEvents.push(event);

    // Linked task only for non-recurring academic types (avoid task spam)
    if (
      recurFreq === 'none' &&
      ['exam', 'test', 'assignment', 'homework', 'project'].includes(event.type) &&
      !event.linkedTaskId
    ) {
      const typeMap = {
        exam: 'Quiz',
        test: 'Quiz',
        assignment: 'Assignment',
        homework: 'Homework',
        project: 'Project'
      };
      const task = {
        id: Storage.generateId(),
        title: event.title,
        subject: event.subject,
        description: event.description,
        startDate: event.endDate ? event.date : '',
        dueDate: event.endDate || event.date,
        dueTime: event.time,
        priority: event.priority,
        status: 'Not Started',
        type: typeMap[event.type] || 'Other',
        createdAt: new Date().toISOString()
      };
      if (!data.assignments) data.assignments = [];
      data.assignments.push(task);
      event.linkedTaskId = task.id;
      data.calendarEvents[data.calendarEvents.length - 1].linkedTaskId = task.id;
    }

    Storage.saveUserData(data);
    return event;
  },

  updateEvent(id, updates) {
    const data = Storage.getUserData();
    if (!data) return false;
    const idx = data.calendarEvents.findIndex(e => e.id === id);
    if (idx === -1) return false;

    data.calendarEvents[idx] = { ...data.calendarEvents[idx], ...updates };
    const event = data.calendarEvents[idx];

    if (event.linkedTaskId) {
      const taskIdx = (data.assignments || []).findIndex(t => t.id === event.linkedTaskId);
      if (taskIdx !== -1) {
        data.assignments[taskIdx] = {
          ...data.assignments[taskIdx],
          title: event.title,
          subject: event.subject,
          description: event.description,
          dueDate: event.date,
          dueTime: event.time,
          priority: event.priority,
          status: event.completed ? 'Completed' : data.assignments[taskIdx].status
        };
      }
    }

    Storage.saveUserData(data);
    return true;
  },

  /** Skip a single occurrence without deleting the series */
  skipOccurrence(masterId, dateStr) {
    const data = Storage.getUserData();
    if (!data) return false;
    const ev = data.calendarEvents.find(e => e.id === masterId);
    if (!ev) return false;
    if (!ev.recurExceptions) ev.recurExceptions = [];
    if (!ev.recurExceptions.includes(dateStr)) ev.recurExceptions.push(dateStr);
    Storage.saveUserData(data);
    return true;
  },

  deleteEvent(id) {
    const data = Storage.getUserData();
    if (!data) return false;
    // id may be master id
    const event = data.calendarEvents.find(e => e.id === id);
    data.calendarEvents = data.calendarEvents.filter(e => e.id !== id);
    if (event && event.linkedTaskId) {
      data.assignments = (data.assignments || []).filter(t => t.id !== event.linkedTaskId);
    }
    Storage.saveUserData(data);
    return true;
  },

  getUpcoming(days = 14) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const future = new Date(now);
    future.setDate(future.getDate() + days);
    return this.getEventsInRange(now, future)
      .filter(e => !e.completed)
      .sort((a, b) => {
        const da = (a.occurrenceDate || a.date) + 'T' + (a.time || '00:00');
        const db = (b.occurrenceDate || b.date) + 'T' + (b.time || '00:00');
        return da.localeCompare(db);
      });
  },

  formatDate(date) {
    if (typeof date === 'string') return date;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  getMonthDays(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days = [];

    const prevMonth = new Date(year, month, 0);
    for (let i = startPad - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        otherMonth: true
      });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), otherMonth: false });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), otherMonth: true });
    }
    return days;
  },

  TYPE_COLORS: {
    exam: '#ef4444',
    test: '#f97316',
    assignment: '#3b82f6',
    study: '#10b981',
    'active-recall': '#8b5cf6',
    homework: '#eab308',
    project: '#ec4899',
    tournament: '#f59e0b',
    match: '#f97316',
    competition: '#ea580c',
    concert: '#a855f7',
    other: '#94a3b8'
  },

  TYPE_LABELS: {
    exam: 'Exam',
    test: 'Test',
    assignment: 'Assignment',
    study: 'Study Session',
    'active-recall': 'Active Recall',
    homework: 'Homework',
    project: 'Project',
    tournament: 'Tournament',
    match: 'Match',
    competition: 'Competition',
    concert: 'Concert',
    other: 'Other'
  },

  mapSportType(type) {
    const map = {
      Tournament: 'tournament',
      Exam: 'exam',
      Match: 'match',
      Competition: 'competition',
      Concert: 'concert',
      Other: 'other'
    };
    return map[type] || 'other';
  },

  isMultiDay(e) {
    if (this.isRecurring(e)) return false;
    return !!(e && e.endDate && e.date && e.endDate !== e.date);
  },

  formatRange(e) {
    if (!e || !e.date) return '';
    if (this.isRecurring(e)) {
      const freq = e.recurFreq;
      const until = e.recurUntil ? ' until ' + e.recurUntil : '';
      return (e.occurrenceDate || e.date) + ' · ' + freq + until;
    }
    if (this.isMultiDay(e)) return e.date + ' → ' + e.endDate;
    return e.date + (e.time ? ' · ' + e.time : '');
  },

  recurLabel(e) {
    if (!this.isRecurring(e)) return '';
    const freq = e.recurFreq;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (freq === 'daily') return e.recurInterval > 1 ? `Every ${e.recurInterval} days` : 'Daily';
    if (freq === 'weekly' || freq === 'biweekly') {
      const names = (e.recurByDay || []).map(d => days[d]).join(', ');
      const base = freq === 'biweekly' ? 'Every 2 weeks' : (e.recurInterval > 1 ? `Every ${e.recurInterval} weeks` : 'Weekly');
      return names ? `${base} (${names})` : base;
    }
    if (freq === 'monthly') return e.recurInterval > 1 ? `Every ${e.recurInterval} months` : 'Monthly';
    return freq;
  }
};

window.Calendar = Calendar;