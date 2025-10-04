// api/modules/responseValidator.js
// Claude 응답 파싱 및 검증

/**
 * JSON 응답 파싱 (마크다운 코드블록 제거)
 * @param {string} text - Claude 응답 텍스트
 * @returns {Object} 파싱된 JSON 객체
 * @throws {Error} JSON 파싱 실패 시
 */
export function parseClaudeResponse(text) {
  try {
    // 마크다운 코드블록 제거
    let cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // JSON 파싱
    const parsed = JSON.parse(cleaned);

    return parsed;
  } catch (error) {
    console.error("❌ JSON 파싱 실패:", error);
    console.error("원본 텍스트:", text.substring(0, 200));
    throw new Error("Claude 응답을 JSON으로 파싱할 수 없습니다");
  }
}

/**
 * 문제 데이터 검증
 * @param {Object} problem - 파싱된 문제 객체
 * @throws {Error} 검증 실패 시
 */
export function validateProblemData(problem) {
  const errors = [];

  // 1. 본문 검증
  if (!problem.passage && !problem.passages) {
    errors.push("본문(passage 또는 passages)이 없습니다");
  }

  // 2. 문제 배열 검증
  if (!Array.isArray(problem.questions) || problem.questions.length === 0) {
    errors.push("문제 배열(questions)이 없거나 비어있습니다");
  }

  // 3. 각 문제 검증
  if (Array.isArray(problem.questions)) {
    problem.questions.forEach((q, index) => {
      const qErrors = validateQuestion(q, index);
      errors.push(...qErrors);
    });
  }

  if (errors.length > 0) {
    throw new Error(`문제 검증 실패:\n- ${errors.join("\n- ")}`);
  }

  return true;
}

/**
 * 개별 문제 검증
 * @param {Object} question - 문제 객체
 * @param {number} index - 문제 인덱스
 * @returns {string[]} 에러 메시지 배열
 */
function validateQuestion(question, index) {
  const errors = [];
  const prefix = `문제 ${index + 1}:`;

  // 필수 필드 검증
  if (!question.question || typeof question.question !== "string") {
    errors.push(`${prefix} question 필드가 없거나 문자열이 아닙니다`);
  }

  if (!Array.isArray(question.options) || question.options.length !== 4) {
    errors.push(`${prefix} options는 4개의 선택지 배열이어야 합니다`);
  }

  if (![1, 2, 3, 4].includes(question.correctAnswer)) {
    errors.push(`${prefix} correctAnswer는 1, 2, 3, 4 중 하나여야 합니다`);
  }

  if (!question.explanation || typeof question.explanation !== "string") {
    errors.push(`${prefix} explanation 필드가 없거나 문자열이 아닙니다`);
  }

  return errors;
}

/**
 * 본문 길이 검증
 * @param {Object} problem - 문제 객체
 * @param {string} expectedRange - 예상 문자 범위 (예: "150-200")
 * @returns {Object} { valid: boolean, actual: number, expected: string, warning?: string }
 */
export function validatePassageLength(problem, expectedRange) {
  let totalLength = 0;

  // passage 또는 passages 길이 계산
  if (problem.passage) {
    totalLength = problem.passage.length;
  } else if (problem.passages) {
    if (
      typeof problem.passages === "object" &&
      !Array.isArray(problem.passages)
    ) {
      // comparative 타입: { A: "...", B: "..." }
      totalLength = Object.values(problem.passages).reduce(
        (sum, text) => sum + text.length,
        0
      );
    } else if (Array.isArray(problem.passages)) {
      // practical 타입: ["...", "...", "..."]
      totalLength = problem.passages.reduce(
        (sum, text) => sum + text.length,
        0
      );
    }
  }

  const [min, max] = expectedRange.split("-").map(Number);
  const valid = totalLength >= min && totalLength <= max;

  const result = {
    valid,
    actual: totalLength,
    expected: expectedRange,
  };

  if (!valid) {
    result.warning = `본문 길이가 범위를 벗어났습니다. 예상: ${expectedRange}자, 실제: ${totalLength}자`;
  }

  return result;
}

/**
 * N1 레벨 적합성 간단 체크 (휴리스틱)
 * @param {Object} problem - 문제 객체
 * @returns {Object} { score: number, warnings: string[] }
 */
export function checkN1Suitability(problem) {
  const warnings = [];
  let score = 100;

  const passage =
    problem.passage || problem.passages?.A || problem.passages?.[0] || "";

  // 1. 한자 비율 체크 (N1은 최소 15% 이상)
  const kanjiCount = (passage.match(/[\u4e00-\u9faf]/g) || []).length;
  const kanjiRatio = kanjiCount / passage.length;

  if (kanjiRatio < 0.15) {
    warnings.push(`한자 비율이 낮습니다 (${(kanjiRatio * 100).toFixed(1)}%)`);
    score -= 10;
  }

  // 2. 문장 길이 체크 (N1은 평균 30자 이상)
  const sentences = passage.split(/[。！？]/);
  const avgLength =
    sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

  if (avgLength < 30) {
    warnings.push(`평균 문장 길이가 짧습니다 (${avgLength.toFixed(0)}자)`);
    score -= 10;
  }

  // 3. 복잡한 문법 패턴 체크
  const complexPatterns = [
    /における/,
    /に関して/,
    /について/,
    /によって/,
    /に対して/,
    /というより/,
    /わけではない/,
    /ざるを得ない/,
  ];

  const patternCount = complexPatterns.filter((p) => p.test(passage)).length;

  if (patternCount < 2) {
    warnings.push("고급 문법 패턴이 부족합니다");
    score -= 10;
  }

  return { score, warnings };
}

/**
 * 종합 검증 (파싱 + 구조 + 품질)
 * @param {string} responseText - Claude 응답 텍스트
 * @param {string} expectedRange - 예상 문자 범위
 * @param {string} level - JLPT 레벨
 * @returns {Object} { problem: Object, metadata: Object }
 * @throws {Error} 검증 실패 시
 */
export function validateFullResponse(responseText, expectedRange, level) {
  // 1. JSON 파싱
  const problem = parseClaudeResponse(responseText);

  // 2. 구조 검증
  validateProblemData(problem);

  // 3. 길이 검증
  const lengthCheck = validatePassageLength(problem, expectedRange);

  // 4. N1 적합성 검증 (선택적)
  let suitabilityCheck = null;
  if (level === "N1") {
    suitabilityCheck = checkN1Suitability(problem);
  }

  return {
    problem,
    metadata: {
      lengthCheck,
      suitabilityCheck,
      validatedAt: new Date().toISOString(),
    },
  };
}
