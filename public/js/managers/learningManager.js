/**
 * managers/learningManager.js
 * 학습 데이터 관리 (localStorage 기반)
 */

class LearningManager {
  constructor() {
    this.storageKey = "jlptLearningData";
  }

  /**
   * 학습 데이터 가져오기
   */
  getData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : this.getInitialData();
    } catch (error) {
      console.error("학습 데이터 로드 실패:", error);
      return this.getInitialData();
    }
  }

  /**
   * 초기 데이터 구조
   */
  getInitialData() {
    return {
      total: 0,
      correctTotal: 0,
      questionTotal: 0,
      accuracy: 0,
      streak: 0,
      lastStudyDate: null,
      history: [],
    };
  }

  /**
   * 학습 데이터 저장
   */
  saveData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error("학습 데이터 저장 실패:", error);
    }
  }

  /**
   * 통계 가져오기
   */
  getStats() {
    const data = this.getData();
    return {
      total: data.total || 0,
      accuracy: data.accuracy || 0,
      streak: data.streak || 0,
    };
  }

  /**
   * 문제 시도 기록 (새로운 메서드)
   * @param {Object} attemptData - { level, lengthKey, correctCount, totalQuestions, timestamp }
   */
  recordAttempt(attemptData) {
    const { level, lengthKey, correctCount, totalQuestions, timestamp } =
      attemptData;

    const data = this.getData();
    const today = new Date().toDateString();

    // 총 문제 세트 수 증가
    data.total = (data.total || 0) + 1;

    // 정답 수 업데이트
    data.correctTotal = (data.correctTotal || 0) + correctCount;
    data.questionTotal = (data.questionTotal || 0) + totalQuestions;

    // 정답률 계산
    if (data.questionTotal > 0) {
      data.accuracy = Math.round(
        (data.correctTotal / data.questionTotal) * 100
      );
    }

    // 연속 학습일 계산
    const lastStudy = data.lastStudyDate;
    if (lastStudy !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (lastStudy === yesterday) {
        data.streak = (data.streak || 0) + 1;
      } else if (lastStudy !== today) {
        data.streak = 1;
      }
      data.lastStudyDate = today;
    }

    // 히스토리 추가
    if (!data.history) data.history = [];
    data.history.push({
      date: timestamp
        ? new Date(timestamp).toISOString()
        : new Date().toISOString(),
      level: level || "N1",
      lengthKey: lengthKey || "medium",
      correct: correctCount,
      total: totalQuestions,
      accuracy: Math.round((correctCount / totalQuestions) * 100),
    });

    // 히스토리는 최근 100개만 유지
    if (data.history.length > 100) {
      data.history = data.history.slice(-100);
    }

    this.saveData(data);
    console.log("✅ 학습 기록 저장 완료:", {
      total: data.total,
      accuracy: data.accuracy,
      streak: data.streak,
    });
  }

  /**
   * 답안 기록 (기존 메서드 - 하위 호환성 유지)
   */
  recordAnswer(isAllCorrect, details = {}) {
    const data = this.getData();
    const today = new Date().toDateString();

    // 총 문제 수 증가
    data.total = (data.total || 0) + 1;

    // 정답 수 업데이트
    data.correctTotal = (data.correctTotal || 0) + (details.correctCount || 0);
    data.questionTotal = (data.questionTotal || 0) + (details.totalCount || 0);

    // 정답률 계산
    if (data.questionTotal > 0) {
      data.accuracy = Math.round(
        (data.correctTotal / data.questionTotal) * 100
      );
    }

    // 연속 학습일 계산
    const lastStudy = data.lastStudyDate;
    if (lastStudy !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (lastStudy === yesterday) {
        data.streak = (data.streak || 0) + 1;
      } else if (lastStudy !== today) {
        data.streak = 1;
      }
      data.lastStudyDate = today;
    }

    // 히스토리 추가
    if (!data.history) data.history = [];
    data.history.push({
      date: new Date().toISOString(),
      correct: details.correctCount || 0,
      total: details.totalCount || 0,
      isAllCorrect,
    });

    // 히스토리는 최근 100개만 유지
    if (data.history.length > 100) {
      data.history = data.history.slice(-100);
    }

    this.saveData(data);
  }

  /**
   * 데이터 초기화
   */
  reset() {
    this.saveData(this.getInitialData());
    console.log("✅ 학습 데이터 초기화 완료");
  }

  /**
   * 약점 영역 분석
   */
  getWeakAreas() {
    const data = this.getData();
    if (!data.history || data.history.length === 0) {
      return null;
    }

    // 레벨별, 길이별 통계 분석
    const stats = {};

    data.history.forEach((record) => {
      const key = `${record.level || "N1"}_${record.lengthKey || "medium"}`;
      if (!stats[key]) {
        stats[key] = {
          level: record.level || "N1",
          lengthKey: record.lengthKey || "medium",
          totalAttempts: 0,
          totalCorrect: 0,
          totalQuestions: 0,
        };
      }

      stats[key].totalAttempts += 1;
      stats[key].totalCorrect += record.correct || 0;
      stats[key].totalQuestions += record.total || 0;
    });

    // 정확도 계산 및 정렬
    const areas = Object.values(stats).map((stat) => ({
      ...stat,
      accuracy:
        stat.totalQuestions > 0
          ? Math.round((stat.totalCorrect / stat.totalQuestions) * 100)
          : 0,
    }));

    // 정확도가 낮은 순으로 정렬
    areas.sort((a, b) => a.accuracy - b.accuracy);

    return areas;
  }
}

export const learningManager = new LearningManager();
