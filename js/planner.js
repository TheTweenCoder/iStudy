/**
 * Smart Study Schedule Generator
 * Uses school schedule, deadlines, difficulty, and available time
 */

const Planner = {
  getSchoolSchedule() {
    const data = Storage.getUserData();
    return data ? data.schoolSchedule : [];
  },

  setSchoolSchedule(schedule) {
    const data = Storage.getUserData();
    if (!data) return false;
    data.schoolSchedule = schedule;
    Storage.saveUserData(data);
    return true;
  },

  addClass(classData) {
    const data = Storage.getUserData();
    if (!data) return null;
    const cls = {
      id: Storage.generateId(),
      day: classData.day, // 0=Sun, 1=Mon, ... 6=Sat
      startTime: classData.startTime,
      endTime: classData.endTime,
      subject: classData.subject,
      teacher: classData.teacher || '',
      room: classData.room || '',
      recurring: classData.recurring !== false, // weekly by default
      until: classData.until || null // optional end date YYYY-MM-DD
    };
    data.schoolSchedule.push(cls);
    Storage.saveUserData(data);
    return cls;
  },

  deleteClass(id) {
    const data = Storage.getUserData();
    if (!data) return false;
    data.schoolSchedule = data.schoolSchedule.filter(c => c.id !== id);
    Storage.saveUserData(data);
    return true;
  },

  getStudySchedule() {
    const data = Storage.getUserData();
    return data ? data.studySchedule : [];
  },

  /**
   * Generate a study schedule for the next N days.
   * Respects school classes, hobby/sport busy blocks, and same-day sport events.
   * Session length prefers task estimatedTime when available.
   * Ranking: urgency × difficulty (same family as App.computeStudySuggestion).
   */
  generate(options = {}) {
    const {
      days = 7,
      availableHoursPerDay = 3,
      preferredStart = '16:30',
      preferredEnd = '21:00',
      sessionLength = 30, // default minutes
      breakLength = 10
    } = options;

    const data = Storage.getUserData();
    if (!data) return [];

    const schoolSchedule = data.schoolSchedule || [];
    const busyBlocks = data.busyBlocks || [];
    const assignments = (data.assignments || []).filter(a => a.status !== 'Completed' && a.dueDate);
    const events = (data.calendarEvents || []).filter(e =>
      !e.completed && ['exam', 'test'].includes(e.type)
    );
    const sportEvents = (data.sportEvents || []).filter(e => !e.completed && e.date);
    const recallDue = (typeof ActiveRecall !== 'undefined') ? ActiveRecall.getUpcoming(days) : [];

    // ----- Build ranked work items -----
    const studyItems = [];

    events.forEach(e => {
      const daysUntil = this.daysUntil(e.date);
      if (daysUntil < 0 || daysUntil > days) return;
      studyItems.push({
        type: e.type,
        title: e.title,
        subject: e.subject,
        date: e.date,
        urgency: this.calcUrgency(daysUntil, e.type === 'exam' ? 10 : 8),
        difficulty: this.getSubjectDifficulty(e.subject, data),
        estimatedMinutes: daysUntil <= 2 ? 45 : 30
      });
    });

    assignments.forEach(a => {
      const daysUntil = this.daysUntil(a.dueDate);
      if (daysUntil < 0 || daysUntil > days) return;
      const remaining = a.estimatedTime != null
        ? Math.max(15, (a.estimatedTime || 0) - (a.actualTime || 0))
        : null;
      const base = a.priority === 'High' ? 7 : a.priority === 'Low' ? 4 : 5;
      const typeBoost = ['Exam', 'Test', 'Quiz'].includes(a.type) ? 2 : 0;
      studyItems.push({
        type: 'assignment',
        title: a.title,
        subject: a.subject,
        date: a.dueDate,
        urgency: this.calcUrgency(daysUntil, base + typeBoost),
        difficulty: a.difficulty != null
          ? Math.min(9, Math.max(2, a.difficulty * 1.5))
          : this.getSubjectDifficulty(a.subject, data),
        estimatedMinutes: remaining || (a.priority === 'High' ? 45 : 30)
      });
    });

    recallDue.forEach(({ topic, review }) => {
      const daysUntil = this.daysUntil(review.scheduledDate);
      // Hard past reviews still get scheduled
      if (daysUntil > days) return;
      let diff = 5;
      const hard = (topic.reviews || []).some(r =>
        r.difficulty === 'Difficult' || r.difficulty === 'Need to review again'
      );
      if (hard) diff = 8;
      if (review.isExtra) diff = 9;
      studyItems.push({
        type: 'active-recall',
        title: `Recall: ${topic.topic}`,
        subject: topic.subject,
        date: review.scheduledDate,
        urgency: this.calcUrgency(Math.max(0, daysUntil), 6),
        difficulty: diff,
        estimatedMinutes: 15,
        topicId: topic.id,
        reviewId: review.id
      });
    });

    // Sport exams within horizon → light prep sessions
    sportEvents.forEach(e => {
      if (e.type !== 'Exam') return;
      const daysUntil = this.daysUntil(e.date);
      if (daysUntil < 0 || daysUntil > days) return;
      studyItems.push({
        type: 'sport-prep',
        title: `Prep: ${e.title}`,
        subject: e.hobbyName || e.customType || e.type,
        date: e.date,
        urgency: this.calcUrgency(daysUntil, 7),
        difficulty: 5,
        estimatedMinutes: 25
      });
    });

    // Unified score used by generator + (mirrored in) suggestion
    const scoreOf = (item) => item.urgency * item.difficulty;
    studyItems.sort((a, b) => scoreOf(b) - scoreOf(a));

    // ----- Pack day by day -----
    const schedule = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 0; d < days; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      const busySlots = [];

      // School classes
      schoolSchedule.filter(c => c.day === dayOfWeek).forEach(c => {
        busySlots.push({
          start: this.timeToMinutes(c.startTime),
          end: this.timeToMinutes(c.endTime),
          label: c.subject
        });
      });

      // Hobby / lifestyle busy blocks (Mon–Sun flags)
      busyBlocks.forEach(b => {
        if ((b.days || []).includes(dayOfWeek)) {
          busySlots.push({
            start: this.timeToMinutes(b.startTime),
            end: this.timeToMinutes(b.endTime),
            label: b.label
          });
        }
      });

      // Same-day sport tournaments / matches / concerts block the window
      sportEvents.forEach(e => {
        if (e.date !== dateStr && !(e.endDate && dateStr >= e.date && dateStr <= e.endDate)) return;
        if (!['Tournament', 'Match', 'Competition', 'Concert'].includes(e.type)) return;
        const start = e.time ? this.timeToMinutes(e.time) : this.timeToMinutes(preferredStart);
        const end = Math.min(start + 120, this.timeToMinutes(preferredEnd));
        busySlots.push({ start, end, label: e.title });
      });

      const availStart = this.timeToMinutes(preferredStart);
      const availEnd = this.timeToMinutes(preferredEnd);
      let minutesLeft = availableHoursPerDay * 60;

      // Prefer earliest free gaps; min duration = 15 so short slots still usable
      const freeSlots = this.findFreeSlots(availStart, availEnd, busySlots, 15);

      const daySessions = [];
      // Track cursor per slot so multiple sessions can share a long free block
      const slotCursors = freeSlots.map(s => s.start);

      // Greedy: always pick current highest-score item that still needs time
      let safety = 0;
      while (minutesLeft >= 15 && studyItems.length > 0 && safety < 40) {
        safety++;
        // Prefer items due by this day (+1 for flexibility)
        studyItems.sort((a, b) => {
          const dueA = this.daysUntil(a.date) <= d + 1 ? 1 : 0;
          const dueB = this.daysUntil(b.date) <= d + 1 ? 1 : 0;
          if (dueB !== dueA) return dueB - dueA;
          return scoreOf(b) - scoreOf(a);
        });

        const item = studyItems[0];
        const need = Math.min(
          Math.max(15, item.estimatedMinutes || sessionLength),
          sessionLength + 15, // cap single block
          minutesLeft
        );

        // Find a free slot that can fit `need` (or at least 15)
        let placed = false;
        for (let si = 0; si < freeSlots.length; si++) {
          const slot = freeSlots[si];
          let cursor = slotCursors[si];
          if (cursor + 15 > slot.end) continue;
          const take = Math.min(need, slot.end - cursor);
          if (take < 15) continue;

          daySessions.push({
            id: Storage.generateId(),
            date: dateStr,
            startTime: this.minutesToTime(cursor),
            endTime: this.minutesToTime(cursor + take),
            title: item.title,
            subject: item.subject,
            type: item.type === 'active-recall' ? 'active-recall' : 'study',
            itemRef: { type: item.type, date: item.date }
          });

          slotCursors[si] = cursor + take + breakLength; // leave break gap in slot
          minutesLeft -= take;
          if (minutesLeft >= breakLength) minutesLeft -= Math.min(breakLength, minutesLeft);

          // Consume / dampen this item
          item.estimatedMinutes = (item.estimatedMinutes || need) - take;
          item.urgency *= 0.55; // dampen so it doesn't monopolize the week
          if (item.estimatedMinutes <= 10) {
            studyItems.shift(); // done enough for this horizon slice
          }
          placed = true;
          break;
        }
        if (!placed) break; // no more room today
      }

      if (daySessions.length > 0) {
        // chronological within day
        daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
        schedule.push({ date: dateStr, sessions: daySessions });
      }
    }

    return schedule;
  },

  saveSchedule(schedule) {
    const data = Storage.getUserData();
    if (!data) return false;

    // Remove old study schedule events from calendar
    data.calendarEvents = data.calendarEvents.filter(e => e.type !== 'study' || e.linkedRecallId);

    // Flatten and save
    const flat = [];
    schedule.forEach(day => {
      day.sessions.forEach(s => {
        flat.push(s);
        // Add to calendar
        data.calendarEvents.push({
          id: s.id,
          title: s.title,
          subject: s.subject,
          date: s.date,
          time: s.startTime,
          endTime: s.endTime,
          description: `Study session: ${s.title}`,
          priority: 'Medium',
          type: s.type || 'study',
          completed: false,
          createdAt: new Date().toISOString()
        });
      });
    });

    data.studySchedule = flat;
    Storage.saveUserData(data);
    return true;
  },

  daysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  },

  calcUrgency(daysUntil, base) {
    if (daysUntil <= 0) return base * 3;
    if (daysUntil <= 1) return base * 2.5;
    if (daysUntil <= 2) return base * 2;
    if (daysUntil <= 3) return base * 1.5;
    if (daysUntil <= 7) return base;
    return base * 0.5;
  },

  getSubjectDifficulty(subjectName, data) {
    // Lower average = higher difficulty
    const subjects = data.subjects || [];
    const grades = data.grades || [];
    const subj = subjects.find(s => s.name === subjectName);
    if (!subj) return 5;
    const avg = Grades.getSubjectAverage(subj.id, grades);
    if (avg === null) return 5;
    if (avg < 10) return 9;
    if (avg < 12) return 7;
    if (avg < 14) return 5;
    if (avg < 16) return 3;
    return 2;
  },

  timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  },

  minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  },

  findFreeSlots(start, end, busy, minDuration) {
    const slots = [];
    // Sort busy
    busy.sort((a, b) => a.start - b.start);
    let current = start;

    for (const b of busy) {
      if (b.start > current + minDuration) {
        slots.push({ start: current, end: Math.min(b.start, end) });
      }
      current = Math.max(current, b.end);
    }
    if (current + minDuration <= end) {
      slots.push({ start: current, end });
    }
    return slots;
  },

  detectConflicts() {
    const data = Storage.getUserData();
    if (!data) return [];
    const conflicts = [];
    const school = data.schoolSchedule || [];
    const busyBlocks = data.busyBlocks || [];
    const study = data.studySchedule || [];

    study.forEach(session => {
      const date = new Date(session.date + 'T12:00:00');
      const dayOfWeek = date.getDay();
      const sessionStart = this.timeToMinutes(session.startTime);
      const sessionEnd = this.timeToMinutes(session.endTime);

      school.filter(c => c.day === dayOfWeek).forEach(cls => {
        const classStart = this.timeToMinutes(cls.startTime);
        const classEnd = this.timeToMinutes(cls.endTime);
        if (sessionStart < classEnd && sessionEnd > classStart) {
          conflicts.push({
            session,
            class: cls,
            message: `${session.title} on ${session.date} at ${session.startTime} overlaps with ${cls.subject} class`
          });
        }
      });

      busyBlocks.forEach(b => {
        if (!(b.days || []).includes(dayOfWeek)) return;
        const bs = this.timeToMinutes(b.startTime);
        const be = this.timeToMinutes(b.endTime);
        if (sessionStart < be && sessionEnd > bs) {
          conflicts.push({
            session,
            class: b,
            message: `${session.title} on ${session.date} at ${session.startTime} overlaps with ${b.label}`
          });
        }
      });
    });

    return conflicts;
  },

  /**
   * Shared scoring used by the weekly generator and the dashboard suggestion.
   * Higher = schedule / recommend first.
   */
  scoreItem({ daysUntil, baseUrgency, difficulty }) {
    return this.calcUrgency(daysUntil, baseUrgency) * (difficulty || 5);
  }
};


window.Planner = Planner;