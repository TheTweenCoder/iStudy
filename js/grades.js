/**
 * Grades Module - Portuguese 0-20 grading system
 */

const Grades = {
  getClassification(grade) {
    if (grade >= 17.5) return { label: 'Muito Bom', class: 'class-muito-bom' };
    if (grade >= 16.5) return { label: 'Bom+', class: 'class-bom-plus' };
    if (grade >= 14.5) return { label: 'Bom', class: 'class-bom' };
    if (grade >= 13.5) return { label: 'Bom-', class: 'class-bom-minus' };
    if (grade >= 12.5) return { label: 'Suficiente+', class: 'class-suficiente-plus' };
    if (grade >= 11.5) return { label: 'Suficiente', class: 'class-suficiente' };
    if (grade >= 9.5) return { label: 'Insuficiente', class: 'class-insuficiente' };
    if (grade >= 6.5) return { label: 'Fraco', class: 'class-fraco' };
    return { label: 'Muito Fraco', class: 'class-muito-fraco' };
  },

  getSubjects() {
    const data = Storage.getUserData();
    return data ? data.subjects : [];
  },

  getGrades() {
    const data = Storage.getUserData();
    return data ? data.grades : [];
  },

  SUBJECT_COLORS: ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#10b981','#14b8a6','#3b82f6','#06b6d4'],

  addSubject(name, color) {
    const data = Storage.getUserData();
    if (!data) return null;
    if (data.subjects.find(s => s.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'Subject already exists' };
    }
    const used = data.subjects.length;
    const subject = {
      id: Storage.generateId(),
      name: name.trim(),
      color: color || this.SUBJECT_COLORS[used % this.SUBJECT_COLORS.length],
      createdAt: new Date().toISOString()
    };
    data.subjects.push(subject);
    Storage.saveUserData(data);
    return subject;
  },

  updateSubject(id, updates) {
    const data = Storage.getUserData();
    if (!data) return false;
    const idx = data.subjects.findIndex(s => s.id === id);
    if (idx === -1) return false;
    data.subjects[idx] = { ...data.subjects[idx], ...updates };
    Storage.saveUserData(data);
    return true;
  },

  getColor(name) {
    try {
      const s = this.getSubjects().find(x => x.name === name);
      return (s && s.color) ? s.color : '#8A8A8A';
    } catch (e) {
      return '#8A8A8A';
    }
  },

  deleteSubject(id) {
    const data = Storage.getUserData();
    if (!data) return false;
    data.subjects = data.subjects.filter(s => s.id !== id);
    data.grades = data.grades.filter(g => g.subjectId !== id);
    Storage.saveUserData(data);
    return true;
  },

  addGrade(gradeData) {
    const data = Storage.getUserData();
    if (!data) return null;
    const grade = {
      id: Storage.generateId(),
      subjectId: gradeData.subjectId,
      name: gradeData.name || 'Grade',
      type: gradeData.type || 'Test',
      value: parseFloat(gradeData.value),
      weight: parseFloat(gradeData.weight) || 1,
      date: gradeData.date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    data.grades.push(grade);
    // Update grade history for stats
    data.statistics.gradeHistory.push({
      date: grade.date,
      overall: this.calculateOverallAverage(data.grades, data.subjects)
    });
    Storage.saveUserData(data);
    return grade;
  },

  updateGrade(id, updates) {
    const data = Storage.getUserData();
    if (!data) return false;
    const idx = data.grades.findIndex(g => g.id === id);
    if (idx === -1) return false;
    data.grades[idx] = { ...data.grades[idx], ...updates };
    if (updates.value !== undefined) data.grades[idx].value = parseFloat(updates.value);
    if (updates.weight !== undefined) data.grades[idx].weight = parseFloat(updates.weight);
    Storage.saveUserData(data);
    return true;
  },

  deleteGrade(id) {
    const data = Storage.getUserData();
    if (!data) return false;
    data.grades = data.grades.filter(g => g.id !== id);
    Storage.saveUserData(data);
    return true;
  },

  getSubjectAverage(subjectId, grades) {
    const subjectGrades = (grades || this.getGrades()).filter(g => g.subjectId === subjectId);
    if (subjectGrades.length === 0) return null;
    let totalWeight = 0;
    let weightedSum = 0;
    subjectGrades.forEach(g => {
      weightedSum += g.value * g.weight;
      totalWeight += g.weight;
    });
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
  },

  calculateOverallAverage(grades, subjects) {
    const g = grades || this.getGrades();
    const s = subjects || this.getSubjects();
    if (s.length === 0) return null;
    let sum = 0;
    let count = 0;
    s.forEach(subj => {
      const avg = this.getSubjectAverage(subj.id, g);
      if (avg !== null) {
        sum += avg;
        count++;
      }
    });
    return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  },

  getHighestSubject() {
    const subjects = this.getSubjects();
    const grades = this.getGrades();
    let highest = null;
    let maxAvg = -1;
    subjects.forEach(s => {
      const avg = this.getSubjectAverage(s.id, grades);
      if (avg !== null && avg > maxAvg) {
        maxAvg = avg;
        highest = { ...s, average: avg };
      }
    });
    return highest;
  },

  getLowestSubject() {
    const subjects = this.getSubjects();
    const grades = this.getGrades();
    let lowest = null;
    let minAvg = 21;
    subjects.forEach(s => {
      const avg = this.getSubjectAverage(s.id, grades);
      if (avg !== null && avg < minAvg) {
        minAvg = avg;
        lowest = { ...s, average: avg };
      }
    });
    return lowest;
  },

  getRecentGrades(limit = 5) {
    return [...this.getGrades()]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }
};

window.Grades = Grades;
