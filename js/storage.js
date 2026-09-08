/**
 * Storage Module - Account-specific localStorage persistence
 * Structure: accounts -> username -> { grades, assignments, calendar, ... }
 */

const STORAGE_KEY = 'studyApp_accounts';
const CURRENT_USER_KEY = 'studyApp_currentUser';

const Storage = {
  // Get all accounts
  getAccounts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  },

  // Save all accounts
  saveAccounts(accounts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  },

  // Get current logged-in username
  getCurrentUser() {
    return localStorage.getItem(CURRENT_USER_KEY);
  },

  // Set current user
  setCurrentUser(username) {
    if (username) {
      localStorage.setItem(CURRENT_USER_KEY, username);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  },

  // Get data for current user
  getUserData() {
    const username = this.getCurrentUser();
    if (!username) return null;
    const accounts = this.getAccounts();
    return accounts[username] || null;
  },

  // Save data for current user
  saveUserData(data) {
    const username = this.getCurrentUser();
    if (!username) return false;
    const accounts = this.getAccounts();
    accounts[username] = data;
    this.saveAccounts(accounts);
    return true;
  },

  // Create new account with default data structure
  createAccount(username, password, profile = {}) {
    const accounts = this.getAccounts();
    if (accounts[username]) {
      return { success: false, error: 'Username already exists' };
    }
    accounts[username] = {
      password: btoa(password), // Simple encoding (not secure, for prototype)
      profile: {
        name: profile.name || username,
        email: profile.email || '',
        createdAt: new Date().toISOString(),
        preferences: {
          theme: 'dark',
          notifications: true,
          pomodoroStudy: 25,
          pomodoroShortBreak: 5,
          pomodoroLongBreak: 15,
          accentColor: 'default',
          avatarColor: 'gradient',
          animations: true,
          reducedMotion: false,
          compactMode: false,
          distractionFree: false,
          hideStats: false,
          hideNavbar: false
        }
      },
      subjects: [],
      grades: [],
      assignments: [],
      calendarEvents: [],
      activeRecall: [],
      schoolSchedule: [],
      studySchedule: [],
      hobbies: [],
      sportEvents: [],
      busyBlocks: [],
      examPlans: [],
      statistics: {
        totalStudyTime: 0, // minutes
        pomodorosCompleted: 0,
        studyStreak: 0,
        lastStudyDate: null,
        tasksCompleted: 0,
        activeRecallSessions: 0,
        weeklyStudyTime: {},
        monthlyStudyTime: {},
        gradeHistory: []
      }
    };
    this.saveAccounts(accounts);
    return { success: true };
  },

  // Authenticate
  login(username, password) {
    const accounts = this.getAccounts();
    const user = accounts[username];
    if (!user) return { success: false, error: 'User not found' };
    if (user.password !== btoa(password)) {
      return { success: false, error: 'Incorrect password' };
    }
    this.setCurrentUser(username);
    return { success: true, data: user };
  },

  // Logout
  logout() {
    this.setCurrentUser(null);
  },

  // Delete account
  deleteAccount(username) {
    const accounts = this.getAccounts();
    if (accounts[username]) {
      delete accounts[username];
      this.saveAccounts(accounts);
      if (this.getCurrentUser() === username) {
        this.logout();
      }
      return true;
    }
    return false;
  },

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // Update study streak
  updateStreak() {
    const data = this.getUserData();
    if (!data) return;
    const today = new Date().toDateString();
    const last = data.statistics.lastStudyDate;
    if (last === today) return; // already studied today
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (last === yesterday.toDateString()) {
      data.statistics.studyStreak += 1;
    } else {
      data.statistics.studyStreak = 1;
    }
    data.statistics.lastStudyDate = today;
    this.saveUserData(data);
  }
};

// Export for use
window.Storage = Storage;