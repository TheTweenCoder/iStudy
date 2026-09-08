/**
 * Authentication Module
 */

const Auth = {
  init() {
    // Check if already logged in
    const current = Storage.getCurrentUser();
    if (current && Storage.getUserData()) {
      // Already logged in - redirect if on login/signup
      if (window.location.pathname.includes('login.html') || 
          window.location.pathname.includes('signup.html')) {
        window.location.href = 'index.html';
      }
    } else {
      // Not logged in - redirect to login if on main app
      if (window.location.pathname.includes('index.html') || 
          window.location.pathname.endsWith('/') ||
          window.location.pathname.endsWith('study-app')) {
        // Allow index to handle redirect
      }
    }
  },

  signup(username, password, name, email) {
    if (!username || !password) {
      return { success: false, error: 'Username and password required' };
    }
    if (username.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }
    if (password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters' };
    }
    const result = Storage.createAccount(username, password, { name, email });
    if (result.success) {
      Storage.login(username, password);
    }
    return result;
  },

  login(username, password) {
    return Storage.login(username, password);
  },

  logout() {
    Storage.logout();
    window.location.href = 'login.html';
  },

  isLoggedIn() {
    return !!Storage.getCurrentUser() && !!Storage.getUserData();
  },

  getProfile() {
    const data = Storage.getUserData();
    return data ? data.profile : null;
  },

  updateProfile(updates) {
    const data = Storage.getUserData();
    if (!data) return false;
    data.profile = { ...data.profile, ...updates };
    Storage.saveUserData(data);
    return true;
  },

  deleteAccount() {
    const username = Storage.getCurrentUser();
    if (username && confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      Storage.deleteAccount(username);
      window.location.href = 'login.html';
    }
  }
};

window.Auth = Auth;
