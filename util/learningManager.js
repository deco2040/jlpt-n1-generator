// utils/learningManager.js
class LearningManager {
  constructor() {
    this.storageKey = "jlpt_n1_learning_data";
    this.data = this.loadData();
  }

  // ===== 데이터 로드/저장 =====
  loadData() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("학습 데이터 로드 실패:", e);
    }

    return {
      totalProblems: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      history: [],
      weakAreas: {},
      categoryStats: {},
      lengthStats: {},
      streak: 0,
      lastStudyDate: null,
      studyDates: [],
      achievements: [],
      totalStudyTime: 0,
      createdAt: new Date().toISOString(),
    };
  }

  saveData() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.error("학습 데이터 저장 실패:", e);
      return false;
    }
  }

  // ===== 학습 결과 기록 =====
  recordResult(result) {
    const {
      lengthKey,
      category,
      genre,
      correctCount,
      totalQuestions,
      questions,
      studyTime = 0,
    } = result;

    const accuracy = Math.round((correctCount / totalQuestions) * 100);
    const today = new Date().toISOString().split("T")[0];

    // 기본 통계 업데이트
    this.data.totalProblems += totalQuestions;
    this.data.correctAnswers += correctCount;
    this.data.wrongAnswers += totalQuestions - correctCount;
    this.data.totalStudyTime += studyTime;

    // 학습 기록 추가
    this.data.history.unshift({
      date: new Date().toISOString(),
      lengthKey,
      category,
      genre,
      correctCount,
      totalQuestions,
      accuracy,
      studyTime,
      timestamp: Date.now(),
    });

    // 최대 100개까지만 보관
    if (this.data.history.length > 100) {
      this.data.history = this.data.history.slice(0, 100);
    }

    // 카테고리별 통계
    if (category) {
      if (!this.data.categoryStats[category]) {
        this.data.categoryStats[category] = {
          total: 0,
          correct: 0,
          wrong: 0,
        };
      }
      this.data.categoryStats[category].total += totalQuestions;
      this.data.categoryStats[category].correct += correctCount;
      this.data.categoryStats[category].wrong += totalQuestions - correctCount;
    }

    // 길이별 통계
    if (lengthKey) {
      if (!this.data.lengthStats[lengthKey]) {
        this.data.lengthStats[lengthKey] = {
          total: 0,
          correct: 0,
          wrong: 0,
        };
      }
      this.data.lengthStats[lengthKey].total += totalQuestions;
      this.data.lengthStats[lengthKey].correct += correctCount;
      this.data.lengthStats[lengthKey].wrong += totalQuestions - correctCount;
    }

    // 약점 영역 분석
    questions.forEach((q) => {
      const area = category || "기타";
      if (!this.data.weakAreas[area]) {
        this.data.weakAreas[area] = { wrong: 0, total: 0 };
      }
      this.data.weakAreas[area].total++;
      if (!q.isCorrect) {
        this.data.weakAreas[area].wrong++;
      }
    });

    // 연속 학습일 계산
    this.updateStreak(today);

    // 업적 체크
    this.checkAchievements();

    this.saveData();
  }

  // ===== 연속 학습일 업데이트 =====
  updateStreak(today) {
    if (this.data.lastStudyDate === today) {
      // 오늘 이미 공부함 - 유지
    } else if (this.isYesterday(this.data.lastStudyDate)) {
      // 어제 공부함 - 연속 증가
      this.data.streak++;
      this.data.lastStudyDate = today;
      if (!this.data.studyDates.includes(today)) {
        this.data.studyDates.push(today);
      }
    } else {
      // 연속 끊김 - 리셋
      this.data.streak = 1;
      this.data.lastStudyDate = today;
      if (!this.data.studyDates.includes(today)) {
        this.data.studyDates.push(today);
      }
    }
  }

  isYesterday(dateStr) {
    if (!dateStr) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return dateStr === yesterday.toISOString().split("T")[0];
  }

  // ===== 통계 조회 =====
  getStats() {
    const totalAttempts = this.data.correctAnswers + this.data.wrongAnswers;
    const overallAccuracy =
      totalAttempts > 0
        ? Math.round((this.data.correctAnswers / totalAttempts) * 100)
        : 0;

    // 약점 영역 정렬 (정답률 낮은 순)
    const weakAreas = Object.entries(this.data.weakAreas)
      .map(([area, stats]) => ({
        area,
        accuracy:
          stats.total > 0
            ? Math.round(((stats.total - stats.wrong) / stats.total) * 100)
            : 0,
        total: stats.total,
        wrong: stats.wrong,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    // 카테고리별 통계
    const categoryStats = Object.entries(this.data.categoryStats)
      .map(([cat, stats]) => ({
        category: cat,
        accuracy:
          stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        total: stats.total,
        correct: stats.correct,
        wrong: stats.wrong,
      }))
      .sort((a, b) => b.total - a.total);

    // 길이별 통계
    const lengthStats = Object.entries(this.data.lengthStats).map(
      ([len, stats]) => ({
        length: len,
        accuracy:
          stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        total: stats.total,
      })
    );

    // 최근 학습 기록
    const recentHistory = this.data.history.slice(0, 10);

    // 최근 7일 정답률 추이
    const last7Days = this.getLast7DaysStats();

    return {
      totalProblems: this.data.totalProblems,
      correctAnswers: this.data.correctAnswers,
      wrongAnswers: this.data.wrongAnswers,
      overallAccuracy,
      streak: this.data.streak,
      totalStudyDays: this.data.studyDates.length,
      totalStudyTime: this.data.totalStudyTime,
      weakAreas,
      categoryStats,
      lengthStats,
      recentHistory,
      last7Days,
      achievements: this.data.achievements,
    };
  }

  // ===== 최근 7일 통계 =====
  getLast7DaysStats() {
    const today = new Date();
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const dayRecords = this.data.history.filter(
        (h) => h.date.split("T")[0] === dateStr
      );

      const totalQuestions = dayRecords.reduce(
        (sum, r) => sum + r.totalQuestions,
        0
      );
      const correctAnswers = dayRecords.reduce(
        (sum, r) => sum + r.correctCount,
        0
      );
      const accuracy =
        totalQuestions > 0
          ? Math.round((correctAnswers / totalQuestions) * 100)
          : 0;

      days.push({
        date: dateStr,
        dayName: date.toLocaleDateString("ja-JP", { weekday: "short" }),
        problems: totalQuestions,
        accuracy,
      });
    }

    return days;
  }

  // ===== 추천 난이도 =====
  getRecommendedLevel() {
    if (this.data.history.length < 5) {
      return "medium"; // 데이터 부족 시 중간
    }

    const recentAccuracy =
      this.data.history.slice(0, 5).reduce((sum, h) => sum + h.accuracy, 0) / 5;

    if (recentAccuracy >= 85) return "long";
    if (recentAccuracy >= 65) return "medium";
    return "short";
  }

  // ===== 약점 카테고리 =====
  getWeakestCategory() {
    const stats = this.getStats();
    return stats.weakAreas.length > 0 ? stats.weakAreas[0].area : null;
  }

  // ===== 업적 시스템 =====
  checkAchievements() {
    const achievements = [
      {
        id: "first_problem",
        name: "첫 발걸음",
        desc: "첫 문제 풀이",
        icon: "🎯",
        condition: () => this.data.totalProblems >= 1,
      },
      {
        id: "problem_10",
        name: "열심히",
        desc: "10문제 돌파",
        icon: "📚",
        condition: () => this.data.totalProblems >= 10,
      },
      {
        id: "problem_50",
        name: "노력가",
        desc: "50문제 돌파",
        icon: "🏃",
        condition: () => this.data.totalProblems >= 50,
      },
      {
        id: "problem_100",
        name: "백전노장",
        desc: "100문제 돌파",
        icon: "🎖️",
        condition: () => this.data.totalProblems >= 100,
      },
      {
        id: "streak_3",
        name: "꾸준함",
        desc: "3일 연속",
        icon: "🔥",
        condition: () => this.data.streak >= 3,
      },
      {
        id: "streak_7",
        name: "일주일 마스터",
        desc: "7일 연속",
        icon: "⭐",
        condition: () => this.data.streak >= 7,
      },
      {
        id: "streak_30",
        name: "한 달의 기적",
        desc: "30일 연속",
        icon: "👑",
        condition: () => this.data.streak >= 30,
      },
      {
        id: "perfect_score",
        name: "완벽주의자",
        desc: "100점 달성",
        icon: "💯",
        condition: () => this.data.history.some((h) => h.accuracy === 100),
      },
      {
        id: "accuracy_80",
        name: "실력자",
        desc: "전체 정답률 80% 이상",
        icon: "🌟",
        condition: () => {
          const total = this.data.correctAnswers + this.data.wrongAnswers;
          return total > 0 && this.data.correctAnswers / total >= 0.8;
        },
      },
    ];

    achievements.forEach((ach) => {
      if (ach.condition() && !this.data.achievements.includes(ach.id)) {
        this.data.achievements.push(ach.id);
        this.showAchievementNotification(ach);
      }
    });
  }

  showAchievementNotification(achievement) {
    // 브라우저 알림 (선택사항)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🎉 업적 달성!", {
        body: `${achievement.icon} ${achievement.name}: ${achievement.desc}`,
        icon: "/icon.png",
      });
    }

    console.log(`🎉 업적 달성: ${achievement.name}`);
  }

  // ===== 데이터 관리 =====
  resetData() {
    if (
      confirm("すべての学習記録を削除しますか？\n이 작업은 되돌릴 수 없습니다.")
    ) {
      this.data = {
        totalProblems: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        history: [],
        weakAreas: {},
        categoryStats: {},
        lengthStats: {},
        streak: 0,
        lastStudyDate: null,
        studyDates: [],
        achievements: [],
        totalStudyTime: 0,
        createdAt: new Date().toISOString(),
      };
      this.saveData();
      return true;
    }
    return false;
  }

  exportData() {
    const dataStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jlpt-n1-study-data-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importData(jsonString) {
    try {
      const imported = JSON.parse(jsonString);

      // 데이터 유효성 검증
      if (
        typeof imported.totalProblems !== "number" ||
        !Array.isArray(imported.history)
      ) {
        throw new Error("잘못된 데이터 형식입니다.");
      }

      // 기존 데이터와 병합할지 확인
      if (
        confirm(
          "기존 데이터와 병합하시겠습니까?\n(취소하면 기존 데이터가 삭제됩니다)"
        )
      ) {
        // 병합
        this.data.totalProblems += imported.totalProblems;
        this.data.correctAnswers += imported.correctAnswers;
        this.data.wrongAnswers += imported.wrongAnswers;
        this.data.history = [...imported.history, ...this.data.history]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 100);
      } else {
        // 교체
        this.data = imported;
      }

      this.saveData();
      return true;
    } catch (e) {
      console.error("데이터 가져오기 실패:", e);
      alert("데이터 가져오기 실패: " + e.message);
      return false;
    }
  }
}

// 싱글톤 인스턴스
const learningManager = new LearningManager();

// ES6 모듈로 내보내기
export default learningManager;

// 브라우저 전역 객체로도 사용 가능
if (typeof window !== "undefined") {
  window.learningManager = learningManager;
}
