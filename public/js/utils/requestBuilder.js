// public/js/utils/requestBuilder.js
/**
 * API 요청 빌더 및 검증 유틸리티
 * 역할: UI 옵션을 검증하고 API 요청 페이로드로 변환
 */

/**
 * UI에서 선택한 값을 API 요청 형식으로 변환
 * @param {Object} options - UI에서 선택한 옵션
 * @param {string} options.lengthKey - 길이 키 (short/medium/long/etc)
 * @param {string[]} options.levels - JLPT 레벨 배열 (예: ["N1"])
 * @param {string|null} options.preferredCategory - 선호 카테고리 (선택사항)
 * @returns {Object} API 요청용 페이로드
 */
export function buildGeneratePayload({ lengthKey, levels, preferredCategory }) {
  // 기본값 설정 및 검증
  const payload = {
    lengthKey: lengthKey || "medium",
    levels: Array.isArray(levels) && levels.length ? levels : ["N1"],
    preferredCategory: preferredCategory || null,
  };

  // 디버깅용 로그 (브라우저 환경에서는 항상 출력)
  console.log("🔧 페이로드 생성:", payload);

  return payload;
}

/**
 * 선택된 레벨 배열 검증
 * @param {string[]} levels - 검증할 레벨 배열
 * @returns {boolean} 유효성 여부
 */
export function validateLevels(levels) {
  const validLevels = ["N1", "N2", "N3", "N4", "N5"];

  if (!Array.isArray(levels) || levels.length === 0) {
    return false;
  }

  return levels.every((level) => validLevels.includes(level));
}

/**
 * 길이 키 검증
 * @param {string} lengthKey - 검증할 길이 키
 * @returns {boolean} 유효성 여부
 */
export function validateLengthKey(lengthKey) {
  const validKeys = [
    "ultra_short",
    "short",
    "medium",
    "long",
    "ultra_long",
    "comparative",
    "practical",
  ];

  return validKeys.includes(lengthKey);
}

/**
 * UI 옵션 전체 검증
 * @param {Object} options - 검증할 옵션 객체
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateOptions(options) {
  const errors = [];

  if (!options || typeof options !== "object") {
    errors.push("オプションオブジェクトが無効です");
    return { valid: false, errors };
  }

  // 레벨 검증
  if (options.levels && !validateLevels(options.levels)) {
    errors.push("無効なJLPTレベルです");
  }

  // 길이 키 검증
  if (options.lengthKey && !validateLengthKey(options.lengthKey)) {
    errors.push("無効な長さキーです");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 페이로드를 쿼리 스트링으로 변환 (GET 요청용)
 * @param {Object} payload - 변환할 페이로드
 * @returns {string} 쿼리 스트링
 */
export function payloadToQueryString(payload) {
  const params = new URLSearchParams();

  if (payload.lengthKey) {
    params.append("lengthKey", payload.lengthKey);
  }

  if (Array.isArray(payload.levels)) {
    params.append("levels", payload.levels.join(","));
  }

  if (payload.preferredCategory) {
    params.append("preferredCategory", payload.preferredCategory);
  }

  return params.toString();
}

/**
 * 빠른 검증 및 페이로드 생성 (원스톱 함수)
 * @param {Object} options - UI 옵션
 * @returns {Object} { success: boolean, payload?: Object, errors?: string[] }
 */
export function validateAndBuild(options) {
  // 1. 옵션 검증
  const validation = validateOptions(options);

  if (!validation.valid) {
    console.error("❌ 옵션 검증 실패:", validation.errors);
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // 2. 페이로드 생성
  try {
    const payload = buildGeneratePayload(options);
    return {
      success: true,
      payload,
    };
  } catch (error) {
    console.error("❌ 페이로드 생성 실패:", error);
    return {
      success: false,
      errors: [error.message || "ペイロード生成に失敗しました"],
    };
  }
}

/**
 * 기본 옵션 생성 (폴백용)
 * @returns {Object} 기본 옵션
 */
export function getDefaultOptions() {
  return {
    lengthKey: "medium",
    levels: ["N1"],
    preferredCategory: null,
  };
}
