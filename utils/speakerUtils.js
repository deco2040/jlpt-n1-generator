// utils/speakerUtils.js
import fs from "fs";
import path from "path";

/**
 * 화자 데이터베이스 로드 함수
 */
function loadSpeakerDatabase() {
  try {
    const speakerPath = path.join(process.cwd(), "data/speakers.json");
    const speakerContent = fs.readFileSync(speakerPath, "utf8");
    return JSON.parse(speakerContent);
  } catch (error) {
    console.error("speakers.json 로드 실패:", error);
    return null;
  }
}

/**
 * 주제 카테고리에 따른 적합한 화자 선택
 */
function selectSpeakerByTopic(topicCategory, lengthType = "medium") {
  const speakerDB = loadSpeakerDatabase();
  if (!speakerDB) return getDefaultSpeaker();

  // 주제별 추천 화자 가져오기
  const topicWeights =
    speakerDB.speaker_selection_weights.by_topic_category[topicCategory];
  const lengthWeights =
    speakerDB.speaker_selection_weights.by_length_type[lengthType];

  let candidateSpeakers = [];

  // 1차: 주제에 적합한 화자들
  if (topicWeights) {
    candidateSpeakers = [...topicWeights.primary, ...topicWeights.secondary];
  }

  // 2차: 길이 타입에 따른 필터링
  if (lengthWeights) {
    if (lengthWeights.avoid) {
      candidateSpeakers = candidateSpeakers.filter(
        (speaker) => !lengthWeights.avoid.includes(speaker)
      );
    }
    if (lengthWeights.preferred) {
      // 선호 화자가 후보에 있으면 우선순위 부여
      const preferredInCandidates = candidateSpeakers.filter((speaker) =>
        lengthWeights.preferred.includes(speaker)
      );
      if (preferredInCandidates.length > 0) {
        candidateSpeakers = preferredInCandidates;
      }
    }
  }

  // 3차: 랜덤 선택 (가중치 적용)
  if (candidateSpeakers.length === 0) {
    candidateSpeakers = getAllSpeakerIds(speakerDB);
  }

  const selectedSpeakerId =
    candidateSpeakers[Math.floor(Math.random() * candidateSpeakers.length)];
  return getSpeakerDetails(speakerDB, selectedSpeakerId);
}

/**
 * 모든 화자 ID 목록 가져오기
 */
function getAllSpeakerIds(speakerDB) {
  const allSpeakers = [];

  Object.values(speakerDB.speaker_categories).forEach((category) => {
    if (category.speakers) {
      Object.keys(category.speakers).forEach((speakerId) => {
        allSpeakers.push(speakerId);
      });
    } else {
      // 세대별 관점 등 중첩 구조 처리
      Object.values(category).forEach((subCategory) => {
        if (subCategory.speakers) {
          Object.keys(subCategory.speakers).forEach((speakerId) => {
            allSpeakers.push(speakerId);
          });
        }
      });
    }
  });

  return allSpeakers;
}

/**
 * 화자 상세 정보 가져오기
 */
function getSpeakerDetails(speakerDB, speakerId) {
  // 모든 카테고리에서 화자 찾기
  for (const categoryKey of Object.keys(speakerDB.speaker_categories)) {
    const category = speakerDB.speaker_categories[categoryKey];

    if (category.speakers && category.speakers[speakerId]) {
      return {
        id: speakerId,
        category: categoryKey,
        ...category.speakers[speakerId],
      };
    }

    // 중첩 구조 처리 (세대별 관점 등)
    for (const subCategoryKey of Object.keys(category)) {
      const subCategory = category[subCategoryKey];
      if (subCategory.speakers && subCategory.speakers[speakerId]) {
        return {
          id: speakerId,
          category: categoryKey,
          subCategory: subCategoryKey,
          ...subCategory.speakers[speakerId],
        };
      }
    }
  }

  return getDefaultSpeaker();
}

/**
 * 기본 화자 정보 (fallback)
 */
function getDefaultSpeaker() {
  return {
    id: "social_commentator",
    label: "사회 논평가",
    description: "사회 문제에 대한 깊이 있는 관찰과 제언",
    writing_style: "균형잡힌, 다각적, 건설적",
    vocabulary_level: "사회 과학 용어, 정책 관련 어휘",
    sentence_patterns: [
      "社会的に見ると～",
      "制度の観点から～",
      "政策として考えれば～",
    ],
    tone_characteristics: "균형감 있는, 건설적, 미래 지향적",
    age_range: "40-60세",
  };
}

/**
 * 화자 기반 프롬프트 텍스트 생성
 */
function generateSpeakerPromptText(speaker, topic, genre, lengthType) {
  if (!speaker) return "";

  const speakerContext = `
**화자 설정**: ${speaker.label}
**화자 특성**: ${speaker.description}
**문체 스타일**: ${speaker.writing_style}
**어휘 수준**: ${speaker.vocabulary_level}
**어조 특징**: ${speaker.tone_characteristics}
**연령대**: ${speaker.age_range}

**화자별 문장 패턴 활용**:
${
  speaker.sentence_patterns
    ? speaker.sentence_patterns.map((pattern) => `• ${pattern}`).join("\n")
    : ""
}

**작성 지침**:
• 위 화자의 관점과 전문성을 일관되게 유지하세요
• 해당 화자가 실제로 사용할 법한 어휘와 표현을 선택하세요
• 화자의 연령대와 사회적 위치에 맞는 언어 사용을 하세요
• 화자의 문체 스타일을 자연스럽게 반영하세요
`;

  return speakerContext;
}

/**
 * 랜덤 화자 선택 (다양성 보장)
 */
function selectRandomSpeaker(excludeIds = []) {
  const speakerDB = loadSpeakerDatabase();
  if (!speakerDB) return getDefaultSpeaker();

  const allSpeakerIds = getAllSpeakerIds(speakerDB);
  const availableSpeakers = allSpeakerIds.filter(
    (id) => !excludeIds.includes(id)
  );

  if (availableSpeakers.length === 0) {
    // 모든 화자가 제외된 경우 다시 시작
    return selectRandomSpeaker([]);
  }

  const selectedId =
    availableSpeakers[Math.floor(Math.random() * availableSpeakers.length)];
  return getSpeakerDetails(speakerDB, selectedId);
}

/**
 * 화자 호환성 체크 (주제와 화자의 적합성)
 */
function checkSpeakerTopicCompatibility(speaker, topicCategory) {
  const speakerDB = loadSpeakerDatabase();
  if (!speakerDB || !speaker) return true;

  const topicWeights =
    speakerDB.speaker_selection_weights.by_topic_category[topicCategory];
  if (!topicWeights) return true;

  const allRecommendedSpeakers = [
    ...topicWeights.primary,
    ...topicWeights.secondary,
  ];
  return allRecommendedSpeakers.includes(speaker.id);
}

/**
 * 화자 다양성 관리자
 */
class SpeakerDiversityManager {
  constructor() {
    this.recentSpeakers = []; // 최근 사용된 화자들
    this.maxHistory = 5; // 최대 기억할 화자 수
  }

  selectDiverseSpeaker(topicCategory, lengthType) {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const speaker = selectSpeakerByTopic(topicCategory, lengthType);

      if (!this.recentSpeakers.includes(speaker.id)) {
        this.addToHistory(speaker.id);
        return speaker;
      }

      attempts++;
    }

    // 10번 시도해도 새로운 화자를 찾지 못한 경우
    this.clearHistory();
    return selectSpeakerByTopic(topicCategory, lengthType);
  }

  addToHistory(speakerId) {
    this.recentSpeakers.push(speakerId);
    if (this.recentSpeakers.length > this.maxHistory) {
      this.recentSpeakers.shift();
    }
  }

  clearHistory() {
    this.recentSpeakers = [];
  }

  getRecentSpeakers() {
    return [...this.recentSpeakers];
  }
}

// 전역 다양성 관리자 인스턴스
const globalDiversityManager = new SpeakerDiversityManager();

/**
 * 메인 화자 선택 함수 (다양성 보장)
 */
function selectOptimalSpeaker(
  topicCategory,
  lengthType = "medium",
  ensureDiversity = true
) {
  if (ensureDiversity) {
    return globalDiversityManager.selectDiverseSpeaker(
      topicCategory,
      lengthType
    );
  } else {
    return selectSpeakerByTopic(topicCategory, lengthType);
  }
}

/**
 * 화자 정보를 프롬프트에 통합하는 메인 함수
 */
function integrateSpreakerIntoPrompt(basePrompt, topic, genre, lengthType) {
  const topicCategory = topic.categoryKey || "social_structure_and_inequality";
  const speaker = selectOptimalSpeaker(topicCategory, lengthType);

  const speakerPromptText = generateSpeakerPromptText(
    speaker,
    topic,
    genre,
    lengthType
  );

  // 기존 프롬프트에 화자 정보 삽입
  const integratedPrompt = basePrompt.replace(
    "**작성 지침**:",
    speakerPromptText + "\n**작성 지침**:"
  );

  return {
    prompt: integratedPrompt,
    speaker: speaker,
    speakerInfo: {
      label: speaker.label,
      category: speaker.category,
      subCategory: speaker.subCategory,
      writing_style: speaker.writing_style,
      tone_characteristics: speaker.tone_characteristics,
    },
  };
}

// 내보내기
export {
  checkSpeakerTopicCompatibility,
  generateSpeakerPromptText,
  globalDiversityManager,
  integrateSpreakerIntoPrompt,
  loadSpeakerDatabase,
  selectOptimalSpeaker,
  selectRandomSpeaker,
  selectSpeakerByTopic,
  SpeakerDiversityManager,
};
