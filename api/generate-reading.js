// api/generate-reading.js
// Next.js API Route - JLPT N1 독해 문제 생성 (통합 버전)
// js2의 기능들(화자 시스템, 함정 요소, 가중치 로직)을 js에 통합

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ===== 유틸리티 함수 =====
function loadJSONFromPublicData(filename) {
  const p = path.join(process.cwd(), "public", "data", filename);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

// 가중치 기반 랜덤 선택 (js2에서 추가)
const pickWeighted = (entries, weights) => {
  if (!entries?.length) return ["", null];
  const total = entries.reduce((sum, [key]) => sum + (weights[key] ?? 1), 0);
  let r = Math.random() * total;
  for (const [key, value] of entries) {
    r -= weights[key] ?? 1;
    if (r < 0) return [key, value];
  }
  return entries[0];
};

// 프롬프트 로그 출력 조건
function shouldLogPrompt() {
  if (process.env.LOG_FULL_PROMPT === "true") return true;
  return process.env.NODE_ENV !== "production";
}

// ===== 길이/서브타입 선택 =====
function selectSubtype(lengthsData, { lengthKey, level }) {
  const lenCats = lengthsData.length_categories || {};
  const lk = lenCats[lengthKey] ? lengthKey : "medium";
  const category = lenCats[lk] || {};
  const subtypes = category.subtypes ? Object.keys(category.subtypes) : [];

  // 레벨 매핑으로 서브타입 제한
  const levelMapping = lengthsData.jlpt_level_mapping?.subtypes || {};
  const filtered = subtypes.filter((st) => {
    const allowed = levelMapping[st] || [];
    return allowed.includes(level);
  });

  const pool = filtered.length ? filtered : subtypes;
  if (!pool.length) return { lk, subtypeKey: null, subtypeData: null };

  // 가중 랜덤 (js2 방식 적용)
  const weights = lengthsData.random_selection_weights?.[lk] || {};
  const total = pool.reduce((s, k) => s + (weights[k] || 1), 0);
  let r = Math.random() * total;
  for (const k of pool) {
    r -= weights[k] || 1;
    if (r <= 0) {
      return { lk, subtypeKey: k, subtypeData: category.subtypes[k] };
    }
  }
  const fallback = pool[0];
  return { lk, subtypeKey: fallback, subtypeData: category.subtypes[fallback] };
}

// ===== 레벨 필터 + 카테고리 균등 랜덤 =====
function selectTopicByLevel(
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
      const lv = Array.isArray(item.levels) ? item.levels : [];
      return lv.some((v) => wantedLevels.includes(v));
    });
    if (items.length) {
      const picked = pick(items);
      return { title: picked.topic, category: catKey };
    }
  }
  return { title: "環境と持続可能性", category: null };
}

// ===== 화자 선택 (js2에서 추가) =====
function selectSpeaker(speakersData, shouldIncludeSpeaker) {
  if (!shouldIncludeSpeaker) {
    return {
      category: "objective",
      type: "neutral_narrator",
      label: "客観的叙述",
      ageRange: "-",
      writingStyle: "中立的、事実中心",
      vocabularyLevel: "N1標準語彙",
      toneCharacteristic: "客観的、情報伝達中心",
    };
  }

  try {
    const spCats = Object.keys(speakersData.speaker_categories || {});
    if (spCats.length > 0) {
      const spCatKey = pick(spCats);
      const spCat = speakersData.speaker_categories[spCatKey] || {};
      const types = Object.keys(spCat);

      if (types.length > 0) {
        const typeKey = pick(types);
        const sp = spCat[typeKey];

        return {
          category: spCatKey,
          type: typeKey,
          label: sp?.label || "",
          ageRange: pick(sp?.age_ranges || ["30代"]),
          writingStyle: pick(sp?.writing_styles || ["論理的、体系的"]),
          vocabularyLevel: pick(sp?.vocabulary_levels || ["N1学術用語"]),
          toneCharacteristic: pick(
            sp?.tone_characteristics || ["客観的、分析的"]
          ),
        };
      }
    }
  } catch (e) {
    console.warn("話者選択失敗:", e);
  }

  // 기본값 반환
  return {
    category: "objective",
    type: "neutral_narrator",
    label: "客観的叙述",
    ageRange: "-",
    writingStyle: "中立的、事実中心",
    vocabularyLevel: "N1標準語彙",
    toneCharacteristic: "客観的、情報伝達中心",
  };
}

// ===== 문제 수 결정 (js2의 가중치 방식) =====
function decideQuestionCount(lengthsData, lk, subtypeData) {
  // 서브타입에 명시적 문제 수가 있으면 사용
  if (subtypeData?.question_count) return subtypeData.question_count;

  // 가중치 기반 랜덤 선택
  const questionConfig = lengthsData.question_count_config?.ranges?.[lk];
  const possibleCounts = questionConfig?.possible_counts || [1];
  const countWeights = questionConfig?.weights || possibleCounts.map(() => 1);

  const totalWeight = countWeights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;

  for (let i = 0; i < possibleCounts.length; i++) {
    r -= countWeights[i];
    if (r < 0) {
      return possibleCounts[i];
    }
  }

  return possibleCounts[0];
}

// ===== 프롬프트 구성 (일본어, js2 스타일) =====
function buildPrompt(config, pickFn) {
  const {
    level,
    topic,
    charRange,
    lengthKey,
    subtypeInfo,
    genreInfo,
    genreAdaptation,
    trapsObj,
    speakerInfo,
    questionCount,
  } = config;

  const isComparative = lengthKey === "comparative";
  const isPractical = lengthKey === "practical";
  const hasSpeaker = speakerInfo.category !== "objective";

  // 지문 구조 지시 (간결화)
  let passageInstruction = "";
  let passageJsonStructure = '"passage": "本文全体"';

  if (isComparative) {
    passageInstruction = "\n【比較型】A文とB文、異なる視点を明確に対比";
    passageJsonStructure = '"passages": {"A": "A文", "B": "B文"}';
  } else if (isPractical) {
    passageInstruction = "\n【実用文】3～4個の関連文書、総合理解問題必須";
    passageJsonStructure = '"passages": ["文書1", "文書2", "文書3"]';
  }

  // 장르 정보 (간결화)
  const genreInfoText = genreInfo?.label
    ? `\nジャンル: ${genreInfo.label}`
    : "";

  // 함정 요소 (간결화)
  const trapExamples = trapsObj
    ? [
        pickFn(trapsObj.opening_traps || []),
        pickFn(trapsObj.middle_complexity || []),
        pickFn(trapsObj.conclusion_subtlety || []),
        pickFn(trapsObj.linguistic_devices || []),
      ]
        .filter(Boolean)
        .join("\n- ")
    : "";

  // 화자 설정 (조건부)
  const speakerSection = hasSpeaker
    ? `\n【話者】${speakerInfo.label} / ${speakerInfo.ageRange} / ${speakerInfo.writingStyle}
話者の特性と観点を自然に反映`
    : "";

  // 함정 요소 섹션 (조건부)
  const trapSection = trapExamples
    ? `\n【${level}トラップ要素】以下を自然に活用:\n- ${trapExamples}`
    : "";

  // 추가 규칙 (조건부)
  const additionalRules = [];
  if (isComparative) additionalRules.push("対照的な観点提示");
  if (isPractical) additionalRules.push("文書総合理解問題");
  const rulesText = additionalRules.length
    ? `3. ${additionalRules.join("、")}`
    : "";

  return `JLPT ${level}読解問題出題専門家として、実試験同等レベルの問題を生成。

【必須】
主題: "${topic}"
文字数: ${charRange}
問題数: ${questionCount}問${genreInfoText}${passageInstruction}${speakerSection}${trapSection}

【出力】JSON形式のみ、他テキスト禁止:
{
  ${passageJsonStructure},
  "questions": [
    {
      "question": "問題文",
      "options": ["1", "2", "3", "4"],
      "correctAnswer": 2,  // 必ず1〜4の数字を指定（この例では選択肢2が正解）
      "explanation": "正解の理由を韓国語で説明"
    }${questionCount > 1 ? ",\n    {...}" : ""}
  ]
}

【重要な注意事項】
- correctAnswerは必ず1, 2, 3, 4のいずれかの数字を指定してください
- 0を使用しないでください
- correctAnswerは正解の選択肢番号を示します（1が「選択肢1」、2が「選択肢2」...）
- explanationは必ず韓国語で記述してください
- JSON構造を厳密に守り、他のテキストは一切含めないでください
- 自然な日本語を使ってください

【ルール】
1. ${level}語彙・文法必須
2. 選択肢各15-25字、全て妥当
${rulesText}`;
}

// ===== 검증 함수 (js2의 엄격한 검증) =====
function validateProblem(problem, expectedQuestionCount, lengthKey) {
  const isComparative = lengthKey === "comparative";
  const isPractical = lengthKey === "practical";

  if (isComparative) {
    if (!problem.passages || typeof problem.passages !== "object") {
      throw new Error("比較型はpassagesオブジェクトが必要です。");
    }
    if (!problem.passages.A || !problem.passages.B) {
      throw new Error("比較型はpassages.AとBが必要です。");
    }
    if (
      typeof problem.passages.A !== "string" ||
      typeof problem.passages.B !== "string"
    ) {
      throw new Error("各文章は文字列である必要があります。");
    }
  } else if (isPractical) {
    if (!Array.isArray(problem.passages)) {
      throw new Error("実用文はpassages配列が必要です。");
    }
    if (problem.passages.length < 3 || problem.passages.length > 4) {
      throw new Error("実用文は3～4個の文章が必要です。");
    }
    problem.passages.forEach((p, idx) => {
      if (typeof p !== "string") {
        throw new Error(`文章${idx + 1}は文字列である必要があります。`);
      }
    });
  } else {
    if (!problem.passage || typeof problem.passage !== "string") {
      throw new Error("passageフィールドがないか文字列ではありません。");
    }
  }

  if (
    !Array.isArray(problem.questions) ||
    problem.questions.length !== expectedQuestionCount
  ) {
    throw new Error(
      `questionsは${expectedQuestionCount}個の配列である必要があります。`
    );
  }

  problem.questions.forEach((q, idx) => {
    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`問題${idx + 1}の形式が正しくありません。`);
    }

    if (
      typeof q.correctAnswer !== "number" ||
      q.correctAnswer < 0 ||
      q.correctAnswer > 3
    ) {
      throw new Error(`問題${idx + 1}の正解インデックスが正しくありません。`);
    }

    if (!q.explanation || typeof q.explanation !== "string") {
      throw new Error(`問題${idx + 1}に解説がありません。`);
    }
  });

  return true;
}

// ===== 메인 핸들러 =====
export default async function generateReadingProblem(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });

  try {
    const {
      lengthKey = "medium",
      levels = ["N1"],
      preferredCategory = null,
    } = req.body || {};

    // 1) 데이터 로드
    const topicsData = loadJSONFromPublicData("topics.json");
    const genreData = loadJSONFromPublicData("genre.json");
    const lengthsData = loadJSONFromPublicData("length-definitions.json");
    const speakersData = loadJSONFromPublicData("speakers.json"); // js2에서 추가

    const actualLevel = levels[0] || "N1";

    // 2) 서브타입/길이
    const { lk, subtypeKey, subtypeData } = selectSubtype(lengthsData, {
      lengthKey,
      level: actualLevel,
    });

    // 3) 주제 선택
    const selectedTopic = selectTopicByLevel(
      topicsData,
      levels,
      preferredCategory
    );

    // 4) 문자수/문제수
    const baseInfo = lengthsData.length_categories?.[lk]?.base_info || {};
    const charRange =
      subtypeData?.character_range || baseInfo?.character_range || "450~700字";
    const questionCount = decideQuestionCount(lengthsData, lk, subtypeData);

    // 5) 장르 (js2 방식)
    const genreList = Array.isArray(genreData) ? genreData : [];
    const trapsObj = genreList.find((g) => g.type === "n1_trap_elements");
    const availableGenres = genreList.filter(
      (g) => g.type !== "n1_trap_elements" && g.length_adaptations?.[lk]
    );
    const selectedGenre = availableGenres.length ? pick(availableGenres) : null;
    const genreAdaptation = selectedGenre?.length_adaptations?.[lk];

    // 6) 함정 요소 및 화자 포함 여부 (js2에서 추가)
    const shouldIncludeTraps = Math.random() < 0.2; // 20% 확률
    const shouldIncludeSpeaker = Math.random() < 0.4; // 40% 확률

    // 7) 화자 선택 (js2에서 추가)
    const speakerInfo = selectSpeaker(speakersData, shouldIncludeSpeaker);

    // 8) 프롬프트 생성 (일본어, js2 스타일)
    const prompt = buildPrompt(
      {
        level: actualLevel, // 레벨 추가
        topic: selectedTopic.title,
        charRange,
        lengthKey: lk,
        subtypeInfo: subtypeData,
        genreInfo: selectedGenre,
        genreAdaptation,
        trapsObj: shouldIncludeTraps ? trapsObj : null,
        speakerInfo,
        questionCount,
      },
      pick
    );

    // 🔍 전체 프롬프트 로그 (조건부)
    if (shouldLogPrompt()) {
      console.log("===== [Claude Prompt - 日本語] =====");
      console.log(prompt);
      console.log("=====================================");
    }

    // 9) Claude API 호출
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.8,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content?.[0]?.text ?? "";

    // JSON 추출 (js2 방식)
    const cleanedRaw = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const jsonMatch = cleanedRaw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON形式が見つかりません");

    const problem = JSON.parse(jsonMatch[0]);

    // 10) 검증 (js2의 엄격한 검증)
    validateProblem(problem, questionCount, lk);

    // 11) 응답
    return res.status(200).json({
      success: true,
      problem,
      metadata: {
        level: actualLevel,
        levels,
        lengthKey: lk,
        subtypeKey,
        topic: selectedTopic.title,
        category: selectedTopic.category,
        genre: selectedGenre?.name || null,
        charRange,
        questionCount,
        speaker: speakerInfo,
        includesTraps: shouldIncludeTraps,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[generate-reading] ERROR:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
