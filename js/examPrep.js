/**
 * Exam Preparation Mode + Free-time blocks + Weekly Study Replay
 */

const ExamPrep = {
  getPlans() {
    const data = Storage.getUserData();
    return data?.examPlans || [];
  },

  savePlans(plans) {
    const data = Storage.getUserData();
    if (!data) return;
    data.examPlans = plans;
    Storage.saveUserData(data);
  },

  /**
   * Generate day-by-day plan until exam
   * topics: optional string[] — otherwise derived from active recall / subject name
   */
  createPlan(exam) {
    const examDate = new Date(exam.date + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    let days = Math.ceil((examDate - today) / 86400000);
    if (days < 1) days = 1;
    if (days > 30) days = 30;

    // Topics from active recall for subject, or generic phases
    const recalls = (typeof ActiveRecall !== 'undefined' ? ActiveRecall.getAll() : [])
      .filter(t => t.subject === exam.subject)
      .map(t => t.topic);

    const generic = [
      'Core concepts',
      'Formulas & definitions',
      'Worked examples',
      'Practice problems',
      'Weak areas',
      'Mixed revision',
      'Past paper / quiz',
      'Mock exam',
      'Light review',
      'Rest & confidence'
    ];

    const topics = recalls.length ? [...recalls] : generic.slice(0, Math.min(days, 8));
    // Expand/cycle topics to fill days
    const dayPlans = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      let focus;
      if (i === days - 1) focus = 'Light review + rest';
      else if (i === days - 2 && days > 2) focus = 'Mock exam / full practice';
      else focus = topics[i % topics.length];
      dayPlans.push({
        day: i + 1,
        date: dateStr,
        focus,
        done: false,
        minutes: i === days - 1 ? 30 : (i === days - 2 ? 60 : 45)
      });
    }

    const plan = {
      id: Storage.generateId(),
      examTitle: exam.title,
      subject: exam.subject || '',
      examDate: exam.date,
      createdAt: new Date().toISOString(),
      days: dayPlans,
      progress: 0
    };

    const plans = this.getPlans().filter(p => !(p.examDate === plan.examDate && p.subject === plan.subject));
    plans.push(plan);
    this.savePlans(plans);

    // Add revision blocks to calendar
    const data = Storage.getUserData();
    if (data) {
      dayPlans.forEach(dp => {
        if (dp.day === days) return; // skip rest day noise
        data.calendarEvents.push({
          id: Storage.generateId(),
          title: `Prep: ${dp.focus}`,
          subject: plan.subject,
          date: dp.date,
          time: '17:00',
          description: `Exam prep for ${plan.examTitle}`,
          priority: 'High',
          type: 'study',
          completed: false,
          linkedExamPlanId: plan.id,
          createdAt: new Date().toISOString()
        });
      });
      Storage.saveUserData(data);
    }

    return plan;
  },

  markDayDone(planId, dayIndex) {
    const plans = this.getPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) return false;
    if (plan.days[dayIndex]) plan.days[dayIndex].done = true;
    const done = plan.days.filter(d => d.done).length;
    plan.progress = Math.round((done / plan.days.length) * 100);
    this.savePlans(plans);
    return true;
  },

  deletePlan(id) {
    const plans = this.getPlans().filter(p => p.id !== id);
    this.savePlans(plans);
    const data = Storage.getUserData();
    if (data) {
      data.calendarEvents = data.calendarEvents.filter(e => e.linkedExamPlanId !== id);
      Storage.saveUserData(data);
    }
  },

  // ----- Free time blocks -----
  getBusyBlocks() {
    const data = Storage.getUserData();
    return data?.busyBlocks || [];
  },

  setBusyBlocks(blocks) {
    const data = Storage.getUserData();
    if (!data) return;
    data.busyBlocks = blocks;
    Storage.saveUserData(data);
  },

  addBusyBlock(block) {
    const blocks = this.getBusyBlocks();
    blocks.push({
      id: Storage.generateId(),
      label: block.label,
      startTime: block.startTime,
      endTime: block.endTime,
      days: block.days || [1, 2, 3, 4, 5] // Mon-Fri default
    });
    this.setBusyBlocks(blocks);
  },

  deleteBusyBlock(id) {
    this.setBusyBlocks(this.getBusyBlocks().filter(b => b.id !== id));
  },

  /** Find free slots today between preferred window */
  findFreeSlotsToday(windowStart = '16:00', windowEnd = '22:00', minMinutes = 30) {
    const day = new Date().getDay();
    const toMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const fromMin = (m) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    let start = toMin(windowStart);
    let end = toMin(windowEnd);
    const busy = [];

    // User busy blocks for this weekday
    this.getBusyBlocks().forEach(b => {
      if ((b.days || []).includes(day)) {
        busy.push({ start: toMin(b.startTime), end: toMin(b.endTime), label: b.label });
      }
    });

    // School classes
    (typeof Planner !== 'undefined' ? Planner.getSchoolSchedule() : []).forEach(c => {
      if (c.day === day) {
        busy.push({ start: toMin(c.startTime), end: toMin(c.endTime), label: c.subject });
      }
    });

    busy.sort((a, b) => a.start - b.start);
    const free = [];
    let cursor = start;
    for (const b of busy) {
      if (b.end <= cursor) continue;
      if (b.start > cursor + minMinutes) {
        free.push({ start: fromMin(cursor), end: fromMin(Math.min(b.start, end)), minutes: Math.min(b.start, end) - cursor });
      }
      cursor = Math.max(cursor, b.end);
      if (cursor >= end) break;
    }
    if (cursor + minMinutes <= end) {
      free.push({ start: fromMin(cursor), end: fromMin(end), minutes: end - cursor });
    }
    return free.filter(f => f.minutes >= minMinutes);
  },

  // ----- Weekly Study Replay -----
  getWeekReport() {
    const data = Storage.getUserData();
    if (!data) return null;
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    const inWeek = (iso) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d >= monday && d < sunday;
    };

    // Approximate: use weeklyStudyTime map + stats
    const weekKey = monday.toISOString().slice(0, 10);
    const studyMin = (data.statistics.weeklyStudyTime || {})[weekKey] || data.statistics.totalStudyTime || 0;
    // Prefer current week key only
    const thisWeekMin = (data.statistics.weeklyStudyTime || {})[weekKey] || 0;

    const tasksDone = (data.assignments || []).filter(t =>
      t.status === 'Completed' && inWeek(t.createdAt) // weak proxy
    ).length;
    // Better: count from grade history / pomodoros this week
    const pomodoros = data.statistics.pomodorosCompleted || 0;
    const recallSessions = data.statistics.activeRecallSessions || 0;

    // Grade improvement
    let bestSubj = null, worstSubj = null;
    let bestDelta = -999, worstAvg = 21;
    (data.subjects || []).forEach(s => {
      const avg = typeof Grades !== 'undefined' ? Grades.getSubjectAverage(s.id, data.grades) : null;
      if (avg == null) return;
      if (avg < worstAvg) {
        worstAvg = avg;
        worstSubj = { name: s.name, avg };
      }
      // improvement proxy: recent grades higher
      const gs = (data.grades || []).filter(g => g.subjectId === s.id).sort((a, b) => new Date(b.date) - new Date(a.date));
      if (gs.length >= 2) {
        const delta = gs[0].value - gs[gs.length - 1].value;
        if (delta > bestDelta) {
          bestDelta = delta;
          bestSubj = { name: s.name, delta };
        }
      }
    });

    // Productive hours: from study schedule completions — fallback Wed 17-19
    const productive = 'Wednesday, 17:00–19:00';

    // Weak recall topics
    const weakTopic = (data.activeRecall || []).find(t =>
      t.reviews?.some(r => r.difficulty === 'Difficult' || r.difficulty === 'Need to review again')
    );

    // Recommend next week focus
    const focus = [];
    if (worstSubj) focus.push(worstSubj.name);
    if (weakTopic?.subject && !focus.includes(weakTopic.subject)) focus.push(weakTopic.subject);
    Tasks.getExamsAndTests(14).forEach(e => {
      if (e.subject && !focus.includes(e.subject) && focus.length < 3) focus.push(e.subject);
    });

    return {
      weekStart: weekKey,
      studyMinutes: thisWeekMin || Math.min(studyMin, thisWeekMin || studyMin),
      tasksCompleted: data.statistics.tasksCompleted || 0,
      pomodoros,
      recallSessions,
      bestImprovement: bestSubj,
      weakest: worstSubj,
      weakTopic: weakTopic ? weakTopic.topic : null,
      productive,
      nextFocus: focus.slice(0, 2)
    };
  }
};

window.ExamPrep = ExamPrep;
