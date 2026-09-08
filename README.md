# StudyApp — Academic Operating System

A complete study-management website built with **HTML, CSS, and vanilla JavaScript**.

## How to run

1. Open the `study-app` folder in VS Code.
2. Open `login.html` or `index.html` with Live Server (or any local server).
3. Or simply double-click `login.html` / `signup.html` in a browser.

> **Note:** For best results use a local server (Live Server extension) so modules load correctly. localStorage works with `file://` as well.

## Features

| Feature | Status |
|---------|--------|
| Dashboard with overview | ✅ |
| Pomodoro timer (custom durations, auto-transition) | ✅ |
| GPA tracker (Portuguese 0–20 + classifications) | ✅ |
| Active Recall + spaced repetition (1,3,7,14,30 days) | ✅ |
| Full calendar (month view, event types) | ✅ |
| Task/Assignment manager | ✅ |
| Two-way Task ↔ Calendar sync | ✅ |
| Smart Study Planner (school schedule aware) | ✅ |
| School timetable (manual entry) | ✅ |
| User accounts (signup/login/logout/delete) | ✅ |
| Persistent data per account (localStorage) | ✅ |
| Statistics | ✅ |
| Subjects management | ✅ |
| Dark / Light mode | ✅ |
| Responsive (desktop + mobile bottom nav) | ✅ |
| Reminders banner | ✅ |

## Project structure

```
study-app/
├── index.html          # Main app
├── login.html
├── signup.html
├── css/
│   ├── main.css
│   ├── dashboard.css
│   └── responsive.css
├── js/
│   ├── storage.js      # Account-based localStorage
│   ├── auth.js
│   ├── grades.js
│   ├── tasks.js
│   ├── calendar.js
│   ├── pomodoro.js
│   ├── activeRecall.js
│   ├── planner.js
│   └── app.js          # UI controller
└── assets/
```

## Quick start flow

1. **Sign up** → create an account  
2. **Add subjects** (Grades or Subjects page)  
3. **Add grades** → see Portuguese classifications  
4. **Add school classes** (School Schedule)  
5. **Add tasks / tests** → they appear on Calendar automatically  
6. **Add Active Recall topics** → review dates are scheduled  
7. **Generate a study plan** (Planner)  
8. **Use Pomodoro** while studying  

All data is saved per account in `localStorage` and survives page refresh.

## Portuguese grade classifications

| Grade     | Classification |
|-----------|----------------|
| 17.5–20   | Muito Bom      |
| 16.5–17.4 | Bom+           |
| 14.5–16.4 | Bom            |
| 13.5–14.4 | Bom-           |
| 12.5–13.4 | Suficiente+    |
| 11.5–12.4 | Suficiente     |
| 9.5–11.4  | Insuficiente   |
| 6.5–9.4   | Fraco          |
| 0–6.4     | Muito Fraco    |
```
