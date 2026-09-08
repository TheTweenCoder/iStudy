/**
 * Sports & Hobbies — activities, sessions, tournaments & sport exams
 */

const Hobbies = {
  TYPES: ['Sport', 'Hobby'],
  EVENT_TYPES: ['Tournament', 'Exam', 'Match', 'Competition', 'Concert', 'Other'],
  COLORS: ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#06b6d4', '#14b8a6', '#6366f1'],

  getAll() {
    const data = Storage.getUserData();
    return data ? (data.hobbies || []) : [];
  },

  getById(id) {
    return this.getAll().find(h => h.id === id);
  },

  add(hobbyData) {
    const data = Storage.getUserData();
    if (!data) return null;
    if (!data.hobbies) data.hobbies = [];

    const hobby = {
      id: Storage.generateId(),
      name: hobbyData.name.trim(),
      type: hobbyData.type || 'Hobby',
      days: hobbyData.days || [],
      startTime: hobbyData.startTime || '',
      endTime: hobbyData.endTime || '',
      notes: hobbyData.notes || '',
      color: hobbyData.color || '#10b981',
      sessions: [],
      linkAsBusy: !!hobbyData.linkAsBusy,
      pinned: !!hobbyData.pinned,
      createdAt: new Date().toISOString()
    };

    data.hobbies.push(hobby);
    if (hobby.linkAsBusy && hobby.days.length && hobby.startTime && hobby.endTime) {
      this._syncBusyBlock(data, hobby);
    }
    Storage.saveUserData(data);
    return hobby;
  },

  update(id, updates) {
    const data = Storage.getUserData();
    if (!data || !data.hobbies) return false;
    const idx = data.hobbies.findIndex(h => h.id === id);
    if (idx === -1) return false;
    data.hobbies[idx] = { ...data.hobbies[idx], ...updates };
    const hobby = data.hobbies[idx];
    if (hobby.linkAsBusy) {
      this._removeBusyForHobby(data, id);
      if (hobby.days?.length && hobby.startTime && hobby.endTime) {
        this._syncBusyBlock(data, hobby);
      }
    } else {
      this._removeBusyForHobby(data, id);
    }
    Storage.saveUserData(data);
    return true;
  },

  delete(id) {
    const data = Storage.getUserData();
    if (!data || !data.hobbies) return false;
    data.hobbies = data.hobbies.filter(h => h.id !== id);
    this._removeBusyForHobby(data, id);
    // Also remove linked sport events
    if (data.sportEvents) {
      data.sportEvents = data.sportEvents.filter(e => e.hobbyId !== id);
    }
    Storage.saveUserData(data);
    return true;
  },

  togglePin(id) {
    const hobby = this.getById(id);
    if (!hobby) return false;
    return this.update(id, { pinned: !hobby.pinned });
  },

  /** Activities sorted with pinned first */
  getAllSorted() {
    return this.getAll().slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  },

  logSession(hobbyId, session) {
    const data = Storage.getUserData();
    if (!data || !data.hobbies) return false;
    const hobby = data.hobbies.find(h => h.id === hobbyId);
    if (!hobby) return false;
    if (!hobby.sessions) hobby.sessions = [];
    hobby.sessions.push({
      id: Storage.generateId(),
      date: session.date || new Date().toISOString().split('T')[0],
      minutes: parseInt(session.minutes, 10) || 0,
      notes: session.notes || '',
      createdAt: new Date().toISOString()
    });
    data.statistics = data.statistics || {};
    data.statistics.hobbySessions = (data.statistics.hobbySessions || 0) + 1;
    data.statistics.hobbyMinutes = (data.statistics.hobbyMinutes || 0) + (parseInt(session.minutes, 10) || 0);
    Storage.saveUserData(data);
    return true;
  },

  getSessionsThisWeek(hobbyId) {
    const hobby = this.getById(hobbyId);
    if (!hobby || !hobby.sessions) return [];
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return hobby.sessions.filter(s => new Date(s.date) >= monday);
  },

  totalMinutes(hobbyId) {
    const hobby = this.getById(hobbyId);
    if (!hobby || !hobby.sessions) return 0;
    return hobby.sessions.reduce((sum, s) => sum + (s.minutes || 0), 0);
  },

  // ----- Tournaments / sport exams -----
  getEvents() {
    const data = Storage.getUserData();
    return data ? (data.sportEvents || []) : [];
  },

  getEventById(id) {
    return this.getEvents().find(e => e.id === id);
  },

  addEvent(eventData) {
    const data = Storage.getUserData();
    if (!data) return null;
    if (!data.sportEvents) data.sportEvents = [];

    const event = {
      id: Storage.generateId(),
      title: eventData.title.trim(),
      type: eventData.type || 'Tournament', // Tournament | Exam | Match | Competition | Other
      hobbyId: eventData.hobbyId || null,
      hobbyName: eventData.hobbyName || '',
      date: eventData.date,
      endDate: eventData.endDate || null,
      time: eventData.time || '',
      location: eventData.location || '',
      notes: eventData.notes || '',
      priority: eventData.priority || 'Medium',
      completed: false,
      pinned: !!eventData.pinned,
      customType: eventData.customType || '', // when type is Other
      createdAt: new Date().toISOString()
    };

    data.sportEvents.push(event);

    // Mirror onto main calendar
    data.calendarEvents = data.calendarEvents || [];
    const calType = (typeof Calendar !== 'undefined' && Calendar.mapSportType)
      ? Calendar.mapSportType(event.type)
      : (event.type === 'Exam' ? 'exam' : 'other');
    data.calendarEvents.push({
      id: Storage.generateId(),
      title: event.title,
      subject: event.hobbyName || event.customType || event.type,
      date: event.date,
      endDate: event.endDate || null,
      time: event.time || '09:00',
      description: [event.customType || event.type, event.location, event.notes].filter(Boolean).join(' · '),
      priority: event.priority,
      type: calType,
      completed: false,
      linkedSportEventId: event.id,
      createdAt: new Date().toISOString()
    });

    Storage.saveUserData(data);
    return event;
  },

  updateEvent(id, updates) {
    const data = Storage.getUserData();
    if (!data || !data.sportEvents) return false;
    const idx = data.sportEvents.findIndex(e => e.id === id);
    if (idx === -1) return false;
    data.sportEvents[idx] = { ...data.sportEvents[idx], ...updates };
    const event = data.sportEvents[idx];

    // Sync calendar
    const calIdx = (data.calendarEvents || []).findIndex(e => e.linkedSportEventId === id);
    if (calIdx !== -1) {
      const calType = (typeof Calendar !== 'undefined' && Calendar.mapSportType)
        ? Calendar.mapSportType(event.type)
        : (event.type === 'Exam' ? 'exam' : 'other');
      data.calendarEvents[calIdx] = {
        ...data.calendarEvents[calIdx],
        title: event.title,
        subject: event.hobbyName || event.customType || event.type,
        date: event.date,
        endDate: event.endDate || null,
        time: event.time || '09:00',
        description: [event.customType || event.type, event.location, event.notes].filter(Boolean).join(' · '),
        priority: event.priority,
        type: calType,
        completed: !!event.completed
      };
    }
    Storage.saveUserData(data);
    return true;
  },

  deleteEvent(id) {
    const data = Storage.getUserData();
    if (!data) return false;
    if (data.sportEvents) data.sportEvents = data.sportEvents.filter(e => e.id !== id);
    if (data.calendarEvents) data.calendarEvents = data.calendarEvents.filter(e => e.linkedSportEventId !== id);
    Storage.saveUserData(data);
    return true;
  },

  togglePinEvent(id) {
    const event = this.getEventById(id);
    if (!event) return false;
    return this.updateEvent(id, { pinned: !event.pinned });
  },

  /** Upcoming events within N days (default 30). Pinned first, then by date. */
  getUpcomingEvents(days = 30) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const future = new Date(now);
    future.setDate(future.getDate() + days);
    return this.getEvents()
      .filter(e => !e.completed && e.date)
      .filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return d >= now && d <= future;
      })
      .sort((a, b) => {
        const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (pin !== 0) return pin;
        return new Date(a.date) - new Date(b.date);
      });
  },

  /** Single closest upcoming event within days (for dashboard) */
  getClosestEvent(days = 30) {
    const list = this.getUpcomingEvents(days);
    return list[0] || null;
  },

  getTournaments(days = 30) {
    return this.getUpcomingEvents(days).filter(e =>
      ['Tournament', 'Match', 'Competition', 'Concert'].includes(e.type)
    );
  },

  getSportExams(days = 30) {
    return this.getUpcomingEvents(days).filter(e => e.type === 'Exam');
  },

  displayType(e) {
    if (!e) return '';
    if (e.type === 'Other' && e.customType) return e.customType;
    return e.type || '';
  },

  _syncBusyBlock(data, hobby) {
    if (!data.busyBlocks) data.busyBlocks = [];
    data.busyBlocks.push({
      id: Storage.generateId(),
      label: hobby.name + (hobby.type === 'Sport' ? ' (sport)' : ' (hobby)'),
      startTime: hobby.startTime,
      endTime: hobby.endTime,
      days: hobby.days.slice(),
      linkedHobbyId: hobby.id
    });
  },

  _removeBusyForHobby(data, hobbyId) {
    if (!data.busyBlocks) return;
    data.busyBlocks = data.busyBlocks.filter(b => b.linkedHobbyId !== hobbyId);
  },

  DAY_LABELS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
};

window.Hobbies = Hobbies;