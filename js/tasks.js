/**
 * Tasks & Assignments — rich model + calendar sync
 */

const Tasks = {
  TYPES: ['Homework', 'Assignment', 'Project', 'Group Project', 'Essay', 'Presentation', 'Revision', 'Quiz', 'Exam', 'Test', 'Other'],
  STATUSES: ['Not Started', 'In Progress', 'Completed'],
  PRIORITIES: ['High', 'Medium', 'Low'],

  getAll() {
    const data = Storage.getUserData();
    return data ? data.assignments : [];
  },

  getById(id) {
    return this.getAll().find(t => t.id === id);
  },

  add(taskData) {
    const data = Storage.getUserData();
    if (!data) return null;

    const subtasks = (taskData.subtasks || []).map(s => ({
      id: Storage.generateId(),
      title: typeof s === 'string' ? s : s.title,
      done: !!(s && s.done)
    }));

    const task = {
      id: Storage.generateId(),
      title: taskData.title,
      subject: taskData.subject || '',
      description: taskData.description || '',
      notes: taskData.notes || '',
      startDate: taskData.startDate || '',
      dueDate: taskData.dueDate || '',
      dueTime: taskData.dueTime || '',
      priority: taskData.priority || 'Medium',
      status: taskData.status || 'Not Started',
      type: taskData.type || 'Assignment',
      estimatedTime: taskData.estimatedTime != null ? parseInt(taskData.estimatedTime, 10) : null, // minutes
      actualTime: taskData.actualTime != null ? parseInt(taskData.actualTime, 10) : 0,
      difficulty: taskData.difficulty != null ? parseInt(taskData.difficulty, 10) : null, // 1-5
      confidence: taskData.confidence != null ? parseInt(taskData.confidence, 10) : null, // 1-5
      subtasks,
      progress: this.calcProgress(subtasks, taskData.status),
      pinned: !!taskData.pinned,
      color: taskData.color || '',
      createdAt: new Date().toISOString()
    };

    data.assignments.push(task);
    this.syncCalendar(data, task);
    Storage.saveUserData(data);
    return task;
  },

  calcProgress(subtasks, status) {
    if (status === 'Completed') return 100;
    if (!subtasks || subtasks.length === 0) {
      return status === 'In Progress' ? 50 : 0;
    }
    const done = subtasks.filter(s => s.done).length;
    return Math.round((done / subtasks.length) * 100);
  },

  syncCalendar(data, task) {
    const eventIdx = data.calendarEvents.findIndex(e => e.linkedTaskId === task.id);
    if (!task.dueDate && !task.startDate) {
      if (eventIdx !== -1) data.calendarEvents.splice(eventIdx, 1);
      return;
    }
    // Multi-day: startDate → dueDate (or single day if only one set)
    let start = task.startDate || task.dueDate;
    let end = task.dueDate || task.startDate;
    if (start && end && start > end) {
      const tmp = start; start = end; end = tmp;
    }
    const payload = {
      title: task.title,
      subject: task.subject,
      date: start,
      endDate: (end && end !== start) ? end : null,
      time: task.dueTime || (end && end !== start ? '09:00' : '23:59'),
      description: task.description || task.notes || '',
      priority: task.priority,
      type: this.mapTypeToEventType(task.type),
      completed: task.status === 'Completed',
      linkedTaskId: task.id
    };
    if (eventIdx !== -1) {
      data.calendarEvents[eventIdx] = { ...data.calendarEvents[eventIdx], ...payload };
    } else {
      data.calendarEvents.push({
        id: Storage.generateId(),
        ...payload,
        createdAt: new Date().toISOString()
      });
    }
  },

  update(id, updates) {
    const data = Storage.getUserData();
    if (!data) return false;
    const idx = data.assignments.findIndex(t => t.id === id);
    if (idx === -1) return false;

    const old = data.assignments[idx];
    const merged = { ...old, ...updates };
    if (updates.estimatedTime !== undefined) merged.estimatedTime = updates.estimatedTime != null ? parseInt(updates.estimatedTime, 10) : null;
    if (updates.actualTime !== undefined) merged.actualTime = parseInt(updates.actualTime, 10) || 0;
    if (updates.difficulty !== undefined) merged.difficulty = updates.difficulty != null ? parseInt(updates.difficulty, 10) : null;
    if (updates.confidence !== undefined) merged.confidence = updates.confidence != null ? parseInt(updates.confidence, 10) : null;
    if (updates.subtasks) {
      merged.subtasks = updates.subtasks.map(s => ({
        id: s.id || Storage.generateId(),
        title: s.title,
        done: !!s.done
      }));
    }
    merged.progress = this.calcProgress(merged.subtasks || [], merged.status);

    if (updates.status === 'Completed' && old.status !== 'Completed') {
      data.statistics.tasksCompleted = (data.statistics.tasksCompleted || 0) + 1;
    }

    data.assignments[idx] = merged;
    this.syncCalendar(data, merged);
    Storage.saveUserData(data);
    return true;
  },

  toggleSubtask(taskId, subtaskId) {
    const task = this.getById(taskId);
    if (!task || !task.subtasks) return false;
    const subtasks = task.subtasks.map(s =>
      s.id === subtaskId ? { ...s, done: !s.done } : s
    );
    const allDone = subtasks.length && subtasks.every(s => s.done);
    return this.update(taskId, {
      subtasks,
      status: allDone ? 'Completed' : (subtasks.some(s => s.done) ? 'In Progress' : task.status)
    });
  },

  delete(id) {
    const data = Storage.getUserData();
    if (!data) return false;
    data.assignments = data.assignments.filter(t => t.id !== id);
    data.calendarEvents = data.calendarEvents.filter(e => e.linkedTaskId !== id);
    Storage.saveUserData(data);
    return true;
  },

  toggleComplete(id) {
    const task = this.getById(id);
    if (!task) return false;
    const newStatus = task.status === 'Completed' ? 'Not Started' : 'Completed';
    return this.update(id, { status: newStatus });
  },

  togglePin(id) {
    const task = this.getById(id);
    if (!task) return false;
    return this.update(id, { pinned: !task.pinned });
  },

  /** Append minutes worked (e.g. from Pomodoro). */
  addActualTime(id, minutes) {
    const task = this.getById(id);
    if (!task) return false;
    const mins = Math.max(0, parseInt(minutes, 10) || 0);
    const next = (parseInt(task.actualTime, 10) || 0) + mins;
    const updates = { actualTime: next };
    if (task.status === 'Not Started') updates.status = 'In Progress';
    return this.update(id, updates);
  },

  mapTypeToEventType(type) {
    const map = {
      Homework: 'homework',
      Assignment: 'assignment',
      Project: 'project',
      'Group Project': 'project',
      Essay: 'assignment',
      Presentation: 'other',
      Revision: 'study',
      Quiz: 'test',
      Exam: 'exam',
      Test: 'test',
      Other: 'other'
    };
    return map[type] || 'other';
  },

  getUpcoming(days = 7) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const future = new Date(now);
    future.setDate(future.getDate() + days);
    return this.getAll()
      .filter(t => t.status !== 'Completed' && t.dueDate)
      .filter(t => {
        const d = new Date(t.dueDate + 'T00:00:00');
        return d >= now && d <= future;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  },

  getOverdue() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return this.getAll()
      .filter(t => t.status !== 'Completed' && t.dueDate)
      .filter(t => new Date(t.dueDate + 'T00:00:00') < now)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  },

  getExamsAndTests(days = 60) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const future = new Date(now);
    future.setDate(future.getDate() + days);
    const fromTasks = this.getAll().filter(t =>
      ['Exam', 'Test', 'Quiz'].includes(t.type) && t.status !== 'Completed' && t.dueDate
    );
    const fromCal = (Storage.getUserData()?.calendarEvents || []).filter(e =>
      ['exam', 'test'].includes(e.type) && !e.completed && e.date
    );
    const items = [];
    fromTasks.forEach(t => {
      items.push({
        id: t.id,
        title: t.title,
        subject: t.subject,
        date: t.dueDate,
        type: t.type.toLowerCase(),
        priority: t.priority,
        source: 'task'
      });
    });
    fromCal.forEach(e => {
      if (items.some(i => i.title === e.title && i.date === e.date)) return;
      items.push({
        id: e.id,
        title: e.title,
        subject: e.subject,
        date: e.date,
        type: e.type,
        priority: e.priority,
        source: 'calendar'
      });
    });
    return items
      .filter(i => {
        const d = new Date(i.date + 'T00:00:00');
        return d >= now && d <= future;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  countdown(dateStr) {
    const now = new Date();
    const target = new Date(dateStr + 'T23:59:59');
    const ms = target - now;
    if (ms < 0) return { overdue: true, days: 0, hours: 0, label: 'Overdue' };
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days === 0) return { overdue: false, days: 0, hours, label: hours <= 1 ? 'Due soon' : `${hours}h left` };
    return { overdue: false, days, hours, label: days === 1 ? '1 day' : `${days} days` };
  },

  timeRemaining(task) {
    if (!task.estimatedTime) return null;
    const left = Math.max(0, (task.estimatedTime || 0) - (task.actualTime || 0));
    return left;
  },

  formatMinutes(m) {
    if (m == null) return '—';
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min ? `${h}h ${min}m` : `${h}h`;
  },

  filter(filters = {}) {
    let tasks = this.getAll();
    if (filters.status) tasks = tasks.filter(t => t.status === filters.status);
    if (filters.subject) tasks = tasks.filter(t => t.subject === filters.subject);
    if (filters.priority) tasks = tasks.filter(t => t.priority === filters.priority);
    if (filters.type) tasks = tasks.filter(t => t.type === filters.type);
    if (filters.sort === 'deadline') {
      tasks.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else if (filters.sort === 'priority') {
      const order = { High: 0, Medium: 1, Low: 2 };
      tasks.sort((a, b) => (order[a.priority] || 2) - (order[b.priority] || 2));
    }
    // Pinned always float to the top
    tasks.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return tasks;
  },

  /** Workload minutes per day for next N days */
  workloadByDay(days = 7) {
    const result = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      result[key] = { minutes: 0, items: [] };
    }
    this.getAll().filter(t => t.status !== 'Completed' && t.dueDate).forEach(t => {
      if (!result[t.dueDate]) return;
      const mins = t.estimatedTime || (t.priority === 'High' ? 90 : t.priority === 'Medium' ? 60 : 30);
      const remaining = Math.max(15, mins - (t.actualTime || 0));
      result[t.dueDate].minutes += remaining;
      result[t.dueDate].items.push(t);
    });
    // study schedule sessions
    (Storage.getUserData()?.studySchedule || []).forEach(s => {
      if (!result[s.date]) return;
      if (s.startTime && s.endTime) {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        result[s.date].minutes += (eh * 60 + em) - (sh * 60 + sm);
      }
    });
    return result;
  },

  /**
   * Study forecast for an exam: rough readiness 0-100
   */
  forecastForExam(exam) {
    const data = Storage.getUserData();
    if (!data) return null;
    const daysLeft = Math.max(0, Math.ceil((new Date(exam.date + 'T12:00:00') - new Date()) / 86400000));
    let score = 40;

    // Related incomplete work
    const related = this.getAll().filter(t =>
      t.status !== 'Completed' &&
      (t.subject === exam.subject || (exam.subject && t.title.toLowerCase().includes((exam.subject || '').toLowerCase())))
    );
    const relatedDone = this.getAll().filter(t =>
      t.status === 'Completed' && t.subject === exam.subject
    );

    if (relatedDone.length) score += Math.min(20, relatedDone.length * 5);
    if (related.length === 0) score += 15;
    else score -= Math.min(25, related.length * 5);

    // Grades / confidence
    const subj = (data.subjects || []).find(s => s.name === exam.subject);
    if (subj) {
      const avg = typeof Grades !== 'undefined' ? Grades.getSubjectAverage(subj.id, data.grades) : null;
      if (avg != null) {
        if (avg >= 16) score += 15;
        else if (avg >= 14) score += 8;
        else if (avg < 12) score -= 15;
      }
    }

    // Active recall coverage
    const recalls = (data.activeRecall || []).filter(t => t.subject === exam.subject);
    if (recalls.length) score += Math.min(15, recalls.length * 4);
    const dueRecalls = typeof ActiveRecall !== 'undefined' ? ActiveRecall.getDueToday().filter(x => x.topic.subject === exam.subject) : [];
    if (dueRecalls.length) score -= 5;

    // Time pressure
    if (daysLeft <= 1) score -= 10;
    else if (daysLeft >= 7) score += 5;

    score = Math.max(0, Math.min(100, score));
    let status = 'On track';
    if (score < 40) status = 'At risk';
    else if (score < 60) status = 'Needs work';
    else if (score >= 80) status = 'Well prepared';

    return { score, status, daysLeft, relatedCount: related.length };
  }
};

window.Tasks = Tasks;