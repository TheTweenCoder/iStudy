/**
 * Active Recall / Adaptive Spaced Repetition
 *
 * Default ladder (1, 3, 7, 14, 30), then maintenance.
 * Ratings adjust ease and rewrite future incomplete reviews (SM-2-inspired).
 */

const ActiveRecall = {
  SCHEDULE_DAYS: [0, 1, 3, 7, 14, 30],
  MAINTENANCE_DAYS: 45,
  EASE_MIN: 1.3,
  EASE_MAX: 2.8,
  EASE_DEFAULT: 2.5,

  PROMPTS: [
    'Explain this topic without looking at your notes.',
    'What do you remember about this?',
    'What are the key concepts?',
    'What parts are you unsure about?',
    'Try to explain this as if you were teaching someone.',
    'What examples or applications can you think of?',
    'How does this connect to other topics you know?',
    'What would you write if this appeared on a test?'
  ],

  getAll() {
    const data = Storage.getUserData();
    return data ? (data.activeRecall || []) : [];
  },

  getById(id) {
    return this.getAll().find(t => t.id === id);
  },

  ratingMeta(difficulty) {
    switch (difficulty) {
      case 'Easy':
        return { quality: 5, easeDelta: 0.15, label: 'Easy' };
      case 'Good':
        return { quality: 4, easeDelta: 0, label: 'Good' };
      case 'Difficult':
        return { quality: 2, easeDelta: -0.2, label: 'Difficult' };
      case 'Need to review again':
        return { quality: 1, easeDelta: -0.3, label: 'Need again' };
      default:
        return { quality: 3, easeDelta: -0.05, label: difficulty || 'Good' };
    }
  },

  clampEase(ease) {
    return Math.min(this.EASE_MAX, Math.max(this.EASE_MIN, ease));
  },

  nextIntervalDays(prevInterval, ease, quality) {
    if (quality < 3) return 1;
    if (!prevInterval || prevInterval < 1) return 1;
    if (prevInterval === 1) return 3;
    if (prevInterval === 3) return 7;
    return Math.max(1, Math.round(prevInterval * ease));
  },

  buildLadderDates(learnedDate) {
    const learned = learnedDate ? new Date(learnedDate + 'T12:00:00') : new Date();
    const dates = [];
    this.SCHEDULE_DAYS.forEach((dayOffset, index) => {
      if (dayOffset === 0) return;
      const d = new Date(learned);
      d.setDate(d.getDate() + dayOffset);
      dates.push({
        dayOffset,
        reviewNumber: index,
        scheduledDate: d.toISOString().split('T')[0]
      });
    });
    return dates;
  },

  add(topic, subject, learnedDate) {
    const data = Storage.getUserData();
    if (!data) return null;
    if (!data.activeRecall) data.activeRecall = [];
    if (!data.calendarEvents) data.calendarEvents = [];

    const learned = learnedDate || new Date().toISOString().split('T')[0];
    const topicObj = {
      id: Storage.generateId(),
      topic: topic,
      subject: subject || '',
      learnedDate: learned,
      reviews: [],
      status: 'active',
      ease: this.EASE_DEFAULT,
      interval: 0,
      reps: 0,
      lapses: 0,
      createdAt: new Date().toISOString()
    };

    this.buildLadderDates(learned).forEach((step, i) => {
      const review = {
        id: Storage.generateId(),
        reviewNumber: i + 1,
        scheduledDate: step.scheduledDate,
        completed: false,
        difficulty: null,
        completedDate: null,
        isExtra: false,
        isMaintenance: false
      };
      topicObj.reviews.push(review);
      this._pushCalendarEvent(data, topicObj, review, 'Review: ' + topic);
    });

    data.activeRecall.push(topicObj);
    Storage.saveUserData(data);
    return topicObj;
  },

  completeReview(topicId, reviewId, difficulty) {
    const data = Storage.getUserData();
    if (!data || !data.activeRecall) return false;

    const topic = data.activeRecall.find(t => t.id === topicId);
    if (!topic) return false;

    const review = topic.reviews.find(r => r.id === reviewId);
    if (!review) return false;

    const meta = this.ratingMeta(difficulty);
    const today = new Date().toISOString().split('T')[0];

    review.completed = true;
    review.difficulty = difficulty;
    review.completedDate = today;
    review.quality = meta.quality;

    if (topic.ease == null) topic.ease = this.EASE_DEFAULT;
    topic.ease = this.clampEase(
      topic.ease + (0.1 - (5 - meta.quality) * (0.08 + (5 - meta.quality) * 0.02))
    );
    topic.ease = this.clampEase(topic.ease + meta.easeDelta);

    const event = (data.calendarEvents || []).find(e => e.linkedReviewId === reviewId);
    if (event) event.completed = true;

    const prevInterval = topic.interval || this._daysBetween(topic.learnedDate, review.scheduledDate) || 1;

    if (meta.quality < 3) {
      topic.lapses = (topic.lapses || 0) + 1;
      topic.interval = 1;
      topic.reps = Math.max(0, (topic.reps || 0) - 1);

      this._cancelIncompleteReviews(data, topic, reviewId);

      const restartOffsets = [1, 3, 7, 14, 30];
      const base = new Date(today + 'T12:00:00');
      restartOffsets.forEach((offset, i) => {
        const d = new Date(base);
        d.setDate(d.getDate() + offset);
        const newReview = {
          id: Storage.generateId(),
          reviewNumber: topic.reviews.length + 1,
          scheduledDate: d.toISOString().split('T')[0],
          completed: false,
          difficulty: null,
          completedDate: null,
          isExtra: i === 0,
          isRestart: true,
          isMaintenance: false
        };
        topic.reviews.push(newReview);
        this._pushCalendarEvent(
          data,
          topic,
          newReview,
          i === 0 ? 'Extra Review: ' + topic.topic : 'Review: ' + topic.topic,
          i === 0 ? 'High' : 'Medium'
        );
      });
    } else {
      topic.reps = (topic.reps || 0) + 1;
      const nextIv = this.nextIntervalDays(prevInterval, topic.ease, meta.quality);
      topic.interval = nextIv;

      this._rescheduleFutureFromToday(data, topic, reviewId, nextIv, meta.quality);

      const stillOpen = topic.reviews.some(r => !r.completed);
      if (!stillOpen) {
        topic.status = 'graduated';
        this._scheduleMaintenance(data, topic, today);
      }
    }

    data.statistics = data.statistics || {};
    data.statistics.activeRecallSessions = (data.statistics.activeRecallSessions || 0) + 1;
    Storage.updateStreak();
    Storage.saveUserData(data);
    return true;
  },

  _rescheduleFutureFromToday(data, topic, justCompletedId, firstNextIv, quality) {
    const incomplete = topic.reviews
      .filter(r => !r.completed && r.id !== justCompletedId)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    if (!incomplete.length) return;

    let cursor = firstNextIv;
    const stretch = quality >= 5 ? 1.2 : quality >= 4 ? 1.0 : 0.85;
    const ease = topic.ease || this.EASE_DEFAULT;
    const base = new Date();
    base.setHours(12, 0, 0, 0);

    incomplete.forEach((r) => {
      const daysAhead = Math.max(1, Math.round(cursor * stretch));
      const d = new Date(base);
      d.setDate(d.getDate() + daysAhead);
      const newDate = d.toISOString().split('T')[0];
      r.scheduledDate = newDate;
      r.isExtra = false;
      r.isRestart = false;

      const ev = (data.calendarEvents || []).find(e => e.linkedReviewId === r.id);
      if (ev) {
        ev.date = newDate;
        ev.title = 'Review: ' + topic.topic;
        ev.priority = 'Medium';
      }

      cursor = Math.max(daysAhead + 1, Math.round(daysAhead * ease));
      if (cursor > 120) cursor = 120;
    });
  },

  _cancelIncompleteReviews(data, topic, exceptReviewId) {
    const dropIds = [];
    topic.reviews = topic.reviews.filter(r => {
      if (r.completed || r.id === exceptReviewId) return true;
      dropIds.push(r.id);
      return false;
    });
    if (data.calendarEvents) {
      data.calendarEvents = data.calendarEvents.filter(
        e => !(e.linkedReviewId && dropIds.includes(e.linkedReviewId))
      );
    }
  },

  _scheduleMaintenance(data, topic, fromDateStr) {
    const base = new Date((fromDateStr || new Date().toISOString().split('T')[0]) + 'T12:00:00');
    const ease = topic.ease || this.EASE_DEFAULT;
    const gap = Math.max(
      this.MAINTENANCE_DAYS,
      Math.round((topic.interval || this.MAINTENANCE_DAYS) * ease)
    );
    const capped = Math.min(90, gap);
    base.setDate(base.getDate() + capped);

    const review = {
      id: Storage.generateId(),
      reviewNumber: topic.reviews.length + 1,
      scheduledDate: base.toISOString().split('T')[0],
      completed: false,
      difficulty: null,
      completedDate: null,
      isExtra: false,
      isMaintenance: true
    };
    topic.reviews.push(review);
    topic.status = 'active';
    this._pushCalendarEvent(data, topic, review, 'Maintenance: ' + topic.topic, 'Medium');
  },

  _pushCalendarEvent(data, topic, review, title, priority) {
    if (!data.calendarEvents) data.calendarEvents = [];
    data.calendarEvents.push({
      id: Storage.generateId(),
      linkedRecallId: topic.id,
      linkedReviewId: review.id,
      title: title,
      subject: topic.subject || '',
      date: review.scheduledDate,
      time: '17:00',
      description: 'Active Recall: ' + topic.topic,
      priority: priority || 'Medium',
      type: 'active-recall',
      completed: false,
      createdAt: new Date().toISOString()
    });
  },

  _daysBetween(a, b) {
    if (!a || !b) return 0;
    const da = new Date(a + 'T12:00:00');
    const db = new Date(b + 'T12:00:00');
    return Math.round((db - da) / 86400000);
  },

  delete(id) {
    const data = Storage.getUserData();
    if (!data) return false;
    data.activeRecall = (data.activeRecall || []).filter(t => t.id !== id);
    data.calendarEvents = (data.calendarEvents || []).filter(e => e.linkedRecallId !== id);
    Storage.saveUserData(data);
    return true;
  },

  updateReviewDate(topicId, reviewId, newDate) {
    const data = Storage.getUserData();
    if (!data) return false;
    const topic = (data.activeRecall || []).find(t => t.id === topicId);
    if (!topic) return false;
    const review = topic.reviews.find(r => r.id === reviewId);
    if (!review) return false;
    review.scheduledDate = newDate;
    const event = (data.calendarEvents || []).find(e => e.linkedReviewId === reviewId);
    if (event) event.date = newDate;
    Storage.saveUserData(data);
    return true;
  },

  getDueToday() {
    const today = new Date().toISOString().split('T')[0];
    const due = [];
    this.getAll().forEach(topic => {
      (topic.reviews || []).forEach(review => {
        if (!review.completed && review.scheduledDate <= today) {
          due.push({ topic, review });
        }
      });
    });
    return due.sort((a, b) => {
      const od = a.review.scheduledDate.localeCompare(b.review.scheduledDate);
      if (od !== 0) return od;
      return (b.review.isExtra ? 1 : 0) - (a.review.isExtra ? 1 : 0);
    });
  },

  getUpcoming(days) {
    if (days == null) days = 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + days);
    const upcoming = [];
    this.getAll().forEach(topic => {
      (topic.reviews || []).forEach(review => {
        if (!review.completed) {
          const d = new Date(review.scheduledDate + 'T12:00:00');
          if (d >= today && d <= future) {
            upcoming.push({ topic, review });
          }
        }
      });
    });
    return upcoming.sort((a, b) => a.review.scheduledDate.localeCompare(b.review.scheduledDate));
  },

  getRandomPrompt() {
    return this.PROMPTS[Math.floor(Math.random() * this.PROMPTS.length)];
  },

  getTopicStats(topic) {
    if (!topic) {
      return { completed: 0, total: 0, ease: this.EASE_DEFAULT, interval: 0, lapses: 0, reps: 0, status: 'active' };
    }
    const reviews = topic.reviews || [];
    return {
      completed: reviews.filter(r => r.completed).length,
      total: reviews.length,
      ease: topic.ease != null ? topic.ease : this.EASE_DEFAULT,
      interval: topic.interval || 0,
      lapses: topic.lapses || 0,
      reps: topic.reps || 0,
      status: topic.status || 'active'
    };
  }
};

window.ActiveRecall = ActiveRecall;