// api/modules/logCollector.js
// API 호출 중 발생하는 모든 로그를 수집하여 응답에 포함

class LogCollector {
  constructor() {
    this.logs = [];
    this.startTime = Date.now();
  }

  /**
   * 로그 추가
   * @param {string} level - 로그 레벨 (info, success, warning, error)
   * @param {string} category - 로그 카테고리 (예: dataLoader, selectionEngine)
   * @param {string} message - 로그 메시지
   * @param {Object} data - 추가 데이터 (선택)
   */
  add(level, category, message, data = null) {
    const timestamp = Date.now() - this.startTime;
    const log = {
      timestamp,
      level,
      category,
      message,
    };

    if (data !== null) {
      log.data = data;
    }

    this.logs.push(log);

    // 콘솔에도 출력 (Vercel 로그용)
    const emoji = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    }[level] || "📝";

    console.log(`${emoji} [${category}] ${message}`, data || "");
  }

  info(category, message, data = null) {
    this.add("info", category, message, data);
  }

  success(category, message, data = null) {
    this.add("success", category, message, data);
  }

  warning(category, message, data = null) {
    this.add("warning", category, message, data);
  }

  error(category, message, data = null) {
    this.add("error", category, message, data);
  }

  /**
   * 섹션 구분선
   */
  separator(title = "") {
    const line = "========================================";
    if (title) {
      this.add("info", "SYSTEM", `\n${line}\n${title}\n${line}`);
    } else {
      this.add("info", "SYSTEM", line);
    }
  }

  /**
   * 수집된 모든 로그 가져오기
   */
  getLogs() {
    return this.logs;
  }

  /**
   * 로그를 읽기 쉬운 텍스트로 포맷
   */
  getFormattedLogs() {
    return this.logs
      .map((log) => {
        const time = `[${log.timestamp}ms]`;
        const level = log.level.toUpperCase().padEnd(7);
        const category = log.category.padEnd(20);
        let line = `${time} ${level} ${category} ${log.message}`;
        if (log.data) {
          line += `\n${JSON.stringify(log.data, null, 2)}`;
        }
        return line;
      })
      .join("\n");
  }

  /**
   * 로그 요약 통계
   */
  getSummary() {
    const total = this.logs.length;
    const byLevel = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      byLevel,
      duration: Date.now() - this.startTime,
    };
  }
}

export default LogCollector;
