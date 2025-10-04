// api/modules/selectionEngine.js
// 주제, 장르, 서브타입, 화자 선택 로직 + 확률 기반 동적 선택

/**
 * 유틸리티: 배열에서 랜덤 선택
 */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * 유틸리티: 배열 셔플
 */
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

/**
 * ========================================
 * 확률 기반 선택 유틸리티 (NEW)
 * ========================================
 */

/**
 * 확률 기반으로 특정 요소를 포함할지 결정
 * @param {number} probability - 0~1 사이의 확률 (예: 0.7 = 70%)
 * @returns {boolean} 포함 여부
 */
function shouldInclude(probability) {
  return Math.random() < probability;
}

/**
 * 선택 확률 설정 (필요에 따라 조정 가능)
 */
const SELECTION_PROBABILITIES = {
  // 필수 요소 (항상 100%)
  topic: 1.0,
  genre: 1.0,
  subtype: 1.0,

  // 선택적 요소 (확률 조정 가능)
  speaker: 0.6, // 60% 확률로 화자 포함
  trap: 0.7, // 70% 확률로 함정 요소 포함 (N1만)
  culturalContext: 0.5, // 50% 확률로 문화적 배경 포함
  characteristics: 0.8, // 80% 확률로 문장 특징 포함
  vocabularyFocus: 0.7, // 70% 확률로 어휘 초점 포함
  grammarStyle: 0.7, // 70% 확률로 문법 스타일 포함
  textStructure: 0.6, // 60% 확률로 문장 구조 포함
  variations: 0.5, // 50% 확률로 구조 변형 포함
  lengthAdaptation: 0.6, // 60% 확률로 길이별 적응 포함
  instructions: 0.9, // 90% 확률로 작성 지침 포함
};

/**
 * ========================================
 * 기존 선택 함수들
 * ========================================
 */

/**
 * 레벨별 주제 선택
 * @param {Object} topicsData - topics.json 데이터
 * @param {string[]} wantedLevels - 원하는 레벨 배열 (예: ["N1"])
 * @param {string|null} preferredCategory - 선호 카테고리 (선택)
 * @returns {Object|null} 선택된 주제 데이터
 */
export function selectTopicByLevel(
  topicsData,
  wantedLevels,
  preferredCategory = null
) {
  const topicsRoot = topicsData.topics || {};
  const allCats = Object.keys(topicsRoot);
  const cats =
    preferredCategory && topicsRoot[preferredCategory]
      ? [preferredCategory]
      : allCats;

  for (const catKey of shuffle(cats)) {
    const items = (topicsRoot[catKey]?.items || []).filter((item) => {
      const lv = Array.isArray(item.levels)
        ? item.levels
        : item.level
        ? [item.level]
        : [];
      return lv.some((l) => wantedLevels.includes(l));
    });

    if (items.length) return pick(items);
  }

  console.warn(`[selectionEngine] 레벨 ${wantedLevels}에 맞는 주제 없음`);
  return null;
}

/**
 * 서브타입 선택 (length-definitions.json 기반)
 * @param {Object} lengthsData - length-definitions.json
 * @param {Object} params - { lengthKey, level }
 * @returns {Object} { lk, subtypeKey, subtypeData }
 */
export function selectSubtype(lengthsData, { lengthKey, level }) {
  const lenCats = lengthsData.length_categories || {};
  const lk = lenCats[lengthKey] ? lengthKey : "medium";
  const category = lenCats[lk] || {};
  const subtypes = category.subtypes ? Object.keys(category.subtypes) : [];

  const levelMapping = lengthsData.jlpt_level_mapping?.subtypes || {};
  const filtered = subtypes.filter((st) => {
    const allowed = levelMapping[st] || [];
    return allowed.includes(level);
  });

  const pool = filtered.length ? filtered : subtypes;
  if (!pool.length) return { lk, subtypeKey: null, subtypeData: null };

  const weights = lengthsData.random_selection_weights?.[lk] || {};
  const total = pool.reduce((s, k) => s + (weights[k] || 1), 0);
  let r = Math.random() * total;

  for (const k of pool) {
    r -= weights[k] || 1;
    if (r <= 0) {
      return { lk, subtypeKey: k, subtypeData: category.subtypes[k] };
    }
  }

  return { lk, subtypeKey: pool[0], subtypeData: category.subtypes[pool[0]] };
}

/**
 * ========================================
 * 확률 기반 선택 함수들 (NEW)
 * ========================================
 */

/**
 * 화자(speaker) 선택 - 확률 기반
 * @param {Object} speakersData - speaker.json
 * @param {string} level - JLPT 레벨
 * @returns {Object|null} 선택된 화자 데이터 또는 null
 */
export function selectSpeaker(speakersData, level) {
  // 확률 체크: 60% 확률로만 화자 포함
  if (!shouldInclude(SELECTION_PROBABILITIES.speaker)) {
    console.log("🎲 화자 선택 스킵 (확률적 제외)");
    return null;
  }

  if (!speakersData?.speakers) return null;

  const pool = speakersData.speakers.filter((spk) =>
    spk.適用レベル?.includes(level)
  );

  return pool.length ? pick(pool) : null;
}

/**
 * 함정 요소 선택 (N1 전용) - 확률 기반
 * @param {Object} trapData - trap.json
 * @param {string} level - JLPT 레벨
 * @returns {string|null} 선택된 함정 요소 텍스트 또는 null
 */
export function selectTrapElement(trapData, level) {
  if (level !== "N1" || !trapData) return null;

  // 확률 체크: 70% 확률로만 함정 요소 포함
  if (!shouldInclude(SELECTION_PROBABILITIES.trap)) {
    console.log("🎲 함정 요소 선택 스킵 (확률적 제외)");
    return null;
  }

  const allTraps = [
    ...(trapData.opening_traps || []),
    ...(trapData.middle_complexity || []),
    ...(trapData.conclusion_subtlety || []),
    ...(trapData.linguistic_devices || []),
  ];

  return allTraps.length ? pick(allTraps) : null;
}

/**
 * 장르 데이터 추출
 * @param {Array} genreData - genre.json의 배열
 * @param {string} genreHint - 찾을 장르 힌트 (label 또는 type)
 * @returns {Object|null} 매칭된 장르 데이터
 */
export function extractGenreData(genreData, genreHint) {
  if (!Array.isArray(genreData)) return null;

  const matched = genreData.find(
    (g) => g.label === genreHint || g.type === genreHint
  );

  return matched || null;
}

/**
 * ========================================
 * 선택적 요소 필터링 (NEW)
 * ========================================
 */

/**
 * 주제 데이터에서 선택적 요소 필터링
 * @param {Object} topicData - 원본 주제 데이터
 * @returns {Object} 확률 기반 필터링된 주제 데이터
 */
export function filterTopicData(topicData) {
  if (!topicData) return null;

  const filtered = {
    name: topicData.name, // 필수
    description: topicData.description, // 필수
    keywords: topicData.keywords, // 필수
    levels: topicData.levels, // 필수
  };

  // 문화적 배경: 50% 확률
  if (
    topicData.culturalContext &&
    shouldInclude(SELECTION_PROBABILITIES.culturalContext)
  ) {
    filtered.culturalContext = topicData.culturalContext;
  }

  // 논쟁성: 있으면 항상 포함 (중요 정보)
  if (topicData.controversyLevel) {
    filtered.controversyLevel = topicData.controversyLevel;
  }

  return filtered;
}

/**
 * 서브타입 데이터에서 선택적 요소 필터링
 * @param {Object} subtypeData - 원본 서브타입 데이터
 * @returns {Object} 확률 기반 필터링된 서브타입 데이터
 */
export function filterSubtypeData(subtypeData) {
  if (!subtypeData) return null;

  const filtered = {
    label: subtypeData.label, // 필수
    description: subtypeData.description, // 필수
    question_focus: subtypeData.question_focus, // 필수
    vocabulary_level: subtypeData.vocabulary_level, // 필수
    question_count: subtypeData.question_count, // 필수
    char_range: subtypeData.char_range, // 필수
    genre_hint: subtypeData.genre_hint, // 필수
  };

  // 문장 특징: 80% 확률
  if (
    subtypeData.characteristics &&
    shouldInclude(SELECTION_PROBABILITIES.characteristics)
  ) {
    filtered.characteristics = subtypeData.characteristics;
  }

  // 예시 주제: 60% 확률
  if (subtypeData.example_topics && shouldInclude(0.6)) {
    filtered.example_topics = subtypeData.example_topics;
  }

  return filtered;
}

/**
 * 장르 데이터에서 선택적 요소 필터링
 * @param {Object} genreData - 원본 장르 데이터
 * @returns {Object} 확률 기반 필터링된 장르 데이터
 */
export function filterGenreData(genreData) {
  if (!genreData) return null;

  const filtered = {
    label: genreData.label, // 필수
    type: genreData.type, // 필수
    characteristics: [], // 조건부
    question_types: genreData.question_types, // 필수
  };

  // 장르 특성: 80% 확률
  if (
    genreData.characteristics &&
    shouldInclude(SELECTION_PROBABILITIES.characteristics)
  ) {
    filtered.characteristics = genreData.characteristics;
  }

  // 어휘 초점: 70% 확률
  if (
    genreData.vocabulary_focus &&
    shouldInclude(SELECTION_PROBABILITIES.vocabularyFocus)
  ) {
    filtered.vocabulary_focus = genreData.vocabulary_focus;
  }

  // 문법 스타일: 70% 확률
  if (
    genreData.grammar_style &&
    shouldInclude(SELECTION_PROBABILITIES.grammarStyle)
  ) {
    filtered.grammar_style = genreData.grammar_style;
  }

  // 문장 구조: 60% 확률
  if (
    genreData.text_structure &&
    shouldInclude(SELECTION_PROBABILITIES.textStructure)
  ) {
    filtered.text_structure = genreData.text_structure;
  }

  // 길이별 적응: 60% 확률
  if (
    genreData.length_adaptations &&
    shouldInclude(SELECTION_PROBABILITIES.lengthAdaptation)
  ) {
    filtered.length_adaptations = genreData.length_adaptations;
  }

  // 작성 지침: 90% 확률 (중요!)
  if (
    genreData.instructions &&
    shouldInclude(SELECTION_PROBABILITIES.instructions)
  ) {
    filtered.instructions = genreData.instructions;
  }

  return filtered;
}

/**
 * ========================================
 * 유틸리티 함수들
 * ========================================
 */

/**
 * 문제 개수 추출
 * @param {Object} subtypeData - 선택된 서브타입 데이터
 * @param {Object} lengthsData - length-definitions.json
 * @param {string} lengthKey - 길이 키
 * @returns {number} 문제 개수
 */
export function getQuestionCount(subtypeData, lengthsData, lengthKey) {
  const baseCount =
    lengthsData.length_categories?.[lengthKey]?.base_info?.question_count || 3;
  const subtypeCount = subtypeData?.question_count;
  return subtypeCount !== undefined ? subtypeCount : baseCount;
}

/**
 * 확률 설정 커스터마이징 (외부에서 조정 가능)
 * @param {Object} customProbabilities - 커스텀 확률 객체
 */
export function setSelectionProbabilities(customProbabilities) {
  Object.assign(SELECTION_PROBABILITIES, customProbabilities);
  console.log("🎲 선택 확률 업데이트:", SELECTION_PROBABILITIES);
}

/**
 * 현재 확률 설정 조회
 * @returns {Object} 현재 확률 설정
 */
export function getSelectionProbabilities() {
  return { ...SELECTION_PROBABILITIES };
}
