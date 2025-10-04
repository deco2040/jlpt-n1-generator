// api/generate-reading.js
// JLPT N1 독해 문제 생성 API - 확률 기반 선택 적용

import { callClaudeAPI, shouldLogPrompt } from "./modules/claudeClient.js";
import { loadAllData } from "./modules/dataLoader.js";
import { buildPrompt } from "./modules/promptBuilder.js";
import { validateFullResponse } from "./modules/responseValidator.js";
import {
  extractGenreData,
  filterGenreData,
  filterSubtypeData,
  // NEW: 확률 기반 필터링 함수들
  filterTopicData,
  getQuestionCount,
  selectSpeaker,
  selectSubtype,
  selectTopicByLevel,
  selectTrapElement,
} from "./modules/selectionEngine.js";

/**
 * 메인 핸들러
 */
export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다" });
  }

  try {
    // 1. 파라미터 추출
    const params = extractParameters(req.body);

    // 2. 데이터 로드
    const data = loadAllData();

    // 3. 문제 생성 요소 선택 (확률 기반 필터링 포함)
    const selectedElements = selectElements(params, data);

    // 4. 프롬프트 생성
    const prompt = buildPrompt({
      level: params.level,
      topicData: selectedElements.topicData,
      genreFullData: selectedElements.genreFullData,
      charRange: selectedElements.charRange,
      questionCount: selectedElements.questionCount,
      subtypeData: selectedElements.subtypeData,
      speakerData: selectedElements.speakerData,
      lengthKey: selectedElements.lengthKey,
      lengthsData: data.lengthsData,
      trapElement: selectedElements.trapElement,
    });

    // 5. Claude API 호출
    const responseText = await callClaudeAPI(prompt, shouldLogPrompt());

    // 6. 응답 검증
    const { problem, metadata } = validateFullResponse(
      responseText,
      selectedElements.charRange,
      params.level
    );

    // 7. 성공 응답
    return res.status(200).json({
      success: true,
      problem,
      metadata: {
        ...metadata,
        level: params.level,
        selectedLevel: params.selectedLevel,
        lengthKey: selectedElements.lengthKey,
        subtypeKey: selectedElements.subtypeKey,
        topicName: selectedElements.topicData?.name,
        genreLabel: selectedElements.genreFullData?.label,
        // 디버깅용: 어떤 요소가 포함되었는지 표시
        includedElements: {
          hasSpeaker: !!selectedElements.speakerData,
          hasTrap: !!selectedElements.trapElement,
          hasCulturalContext: !!selectedElements.topicData?.culturalContext,
        },
      },
    });
  } catch (error) {
    console.error("❌ 문제 생성 실패:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "문제 생성 중 오류가 발생했습니다",
    });
  }
}

/**
 * 요청 파라미터 추출 및 검증
 */
function extractParameters(body) {
  const {
    level = "N1",
    selectedLevel,
    lengthKey = "medium",
    topicCategory,
  } = body;

  // 레벨 검증
  const validLevels = ["N1", "N2", "N3", "N4", "N5"];
  if (!validLevels.includes(level)) {
    throw new Error(`유효하지 않은 레벨: ${level}`);
  }

  return {
    level,
    selectedLevel: selectedLevel || level,
    lengthKey,
    topicCategory,
  };
}

/**
 * 문제 생성에 필요한 모든 요소 선택 (확률 기반 필터링 적용)
 */
function selectElements(params, data) {
  const { level, lengthKey, topicCategory } = params;
  const { topicsData, genreData, lengthsData, speakersData, trapData } = data;

  console.log("🎲 확률 기반 요소 선택 시작...");

  // 1. 서브타입 선택
  const {
    lk,
    subtypeKey,
    subtypeData: rawSubtypeData,
  } = selectSubtype(lengthsData, {
    lengthKey,
    level,
  });

  // 서브타입 데이터 필터링 (확률 기반)
  const subtypeData = filterSubtypeData(rawSubtypeData);

  // 2. 주제 선택
  const rawTopicData = selectTopicByLevel(topicsData, [level], topicCategory);

  if (!rawTopicData) {
    console.warn(
      `[selectionEngine] ${level} 레벨에 맞는 주제를 찾을 수 없습니다. 기본 주제 사용.`
    );

    // 기본 주제 제공
    const defaultTopic = {
      name: "一般的な話題",
      description: "社会問題に関する一般的な話題",
      keywords: ["社会", "問題", "課題"],
      levels: [level],
    };

    return createDefaultElements(
      level,
      lk,
      subtypeKey,
      subtypeData,
      defaultTopic,
      genreData,
      speakersData,
      trapData,
      lengthsData
    );
  }

  // 주제 데이터 필터링 (확률 기반) - rawTopicData가 존재할 때만 실행
  const topicData = filterTopicData(rawTopicData);

  // 3. 장르 선택 - 필터링된 topicData 사용
  const genreHint =
    subtypeData?.genre_hint ||
    topicData?.genre ||
    rawTopicData?.genre ||
    "論説文";
  const rawGenreData = extractGenreData(genreData, genreHint);

  // 장르 데이터 필터링 (확률 기반)
  const genreFullData = filterGenreData(rawGenreData);

  // 4. 화자 선택 (확률 기반 - 함수 내부에서 처리)
  const speakerData = selectSpeaker(speakersData, level);

  // 5. 함정 요소 선택 (확률 기반 - 함수 내부에서 처리, N1 전용)
  const trapElement = selectTrapElement(trapData, level);

  // 6. 문자 범위 결정
  const charRange = determineCharRange(lengthsData, lk, subtypeData);

  // 7. 문제 개수 결정
  const questionCount = getQuestionCount(subtypeData, lengthsData, lk);

  // 선택 결과 로깅 (더 상세하게)
  console.log("✅ 요소 선택 완료:", {
    lengthKey: lk,
    subtypeKey,
    topic: topicData?.name || "undefined", // ← 여기 수정
    genre: genreFullData?.label || "undefined", // ← 여기도 수정
    hasSpeaker: !!speakerData,
    hasTrap: !!trapElement,
    hasCulturalContext: !!topicData?.culturalContext,
    characteristicsIncluded: !!subtypeData?.characteristics,
  });

  return {
    lengthKey: lk,
    subtypeKey,
    subtypeData,
    topicData,
    genreFullData,
    speakerData,
    trapElement,
    charRange,
    questionCount,
  };
}

/**
 * 기본 요소 생성 (주제를 찾을 수 없을 때)
 */
function createDefaultElements(
  level,
  lk,
  subtypeKey,
  subtypeData,
  defaultTopic,
  genreData,
  speakersData,
  trapData,
  lengthsData
) {
  const genreHint = subtypeData?.genre_hint || "論説文";
  const rawGenreData = extractGenreData(genreData, genreHint);
  const genreFullData = filterGenreData(rawGenreData);

  const speakerData = selectSpeaker(speakersData, level);
  const trapElement = selectTrapElement(trapData, level);

  const charRange = determineCharRange(lengthsData, lk, subtypeData);
  const questionCount = getQuestionCount(subtypeData, lengthsData, lk);

  return {
    lengthKey: lk,
    subtypeKey,
    subtypeData,
    topicData: defaultTopic,
    genreFullData,
    speakerData,
    trapElement,
    charRange,
    questionCount,
  };
}

/**
 * 문자 범위 결정
 */
function determineCharRange(lengthsData, lengthKey, subtypeData) {
  // 서브타입에 명시된 범위가 있으면 우선
  if (subtypeData?.char_range) {
    return subtypeData.char_range;
  }

  // 기본 범위 사용
  const baseInfo = lengthsData.length_categories?.[lengthKey]?.base_info;
  return baseInfo?.char_range || "150-200";
}
