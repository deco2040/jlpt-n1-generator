// api/generate-reading.js
// JLPT N1 독해 문제 생성 API - 모든 JSON 데이터 100% 활용

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ===== 유틸리티 =====
function loadJSONFromPublicData(filename) {
  const p = path.join(process.cwd(), "public", "data", filename);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

function shouldLogPrompt() {
  if (process.env.LOG_FULL_PROMPT === "true") return true;
  return process.env.NODE_ENV !== "production";
}

// ===== 서브타입 선택 =====
function selectSubtype(lengthsData, { lengthKey, level }) {
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

// ===== 주제 선택 (개선: 모든 필드 활용) =====
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
      const lv = Array.isArray(item.levels)
        ? item.levels
        : item.level
        ? [item.level]
        : [];
      return lv.some((l) => wantedLevels.includes(l));
    });

    if (items.length) {
      const chosen = pick(items);
      return {
        name: chosen.topic || chosen.name || "一般主題",
        description: chosen.description || "",
        difficulty: chosen.difficulty || "",
        keywords: chosen.keywords || [],
        relatedTopics: chosen.related_topics || [],
        culturalContext: chosen.cultural_context || "",
        controversyLevel: chosen.controversy_level || "",
      };
    }
  }

  return {
    name: "一般主題",
    description: "",
    difficulty: "",
    keywords: [],
    relatedTopics: [],
    culturalContext: "",
    controversyLevel: "",
  };
}

// ===== 화자 선택 (신규: speakers.json 완전 활용) =====
function selectSpeaker(speakersData, topic, lengthKey) {
  const categories = speakersData?.speaker_categories || {};
  const weights = speakersData?.selection_weights || {};

  // 주제별 화자 선택
  const topicWeights = weights.by_topic?.[topic] || [];
  const lengthWeights = weights.by_length?.[lengthKey] || [];

  // 가중치 결합
  const preferredSpeakers = [...new Set([...topicWeights, ...lengthWeights])];

  if (preferredSpeakers.length === 0) {
    // 모든 화자 중 랜덤 선택
    const allCategories = Object.values(categories);
    const randomCategory = pick(allCategories);
    const speakerKeys = Object.keys(randomCategory);
    const randomSpeakerKey = pick(speakerKeys);
    return randomCategory[randomSpeakerKey];
  }

  // 선호 화자 중 선택
  const speakerKey = pick(preferredSpeakers);

  // 화자 찾기
  for (const category of Object.values(categories)) {
    if (category[speakerKey]) {
      const speaker = category[speakerKey];
      return {
        label: speaker.label,
        age: pick(speaker.age_ranges || ["30代"]),
        style: pick(speaker.writing_styles || ["客観的、中立的"]),
        vocabulary: pick(speaker.vocabulary_levels || ["標準的な語彙"]),
        tone: pick(speaker.tone_characteristics || ["落ち着いた、丁寧"]),
      };
    }
  }

  return null;
}

// ===== 질문 개수 결정 =====
function decideQuestionCount(lengthsData, lengthKey, subtypeData) {
  const baseCount =
    lengthsData.length_categories?.[lengthKey]?.base_info?.question_count || 3;
  const subtypeCount = subtypeData?.question_count;
  return subtypeCount !== undefined ? subtypeCount : baseCount;
}

// ===== 장르 데이터 추출 =====
function extractGenreData(genreData, genreHint) {
  if (!Array.isArray(genreData)) return null;

  const matchedGenre = genreData.find(
    (g) => g.label === genreHint || g.type === genreHint
  );

  return matchedGenre || null;
}

// ===== 프롬프트 빌더 (완전판) =====
function buildPrompt(
  level,
  topicData,
  genreFullData,
  charRange,
  questionCount,
  subtypeData,
  speakerData,
  lengthKey,
  lengthsData,
  trapData
) {
  const isComparative = lengthKey === "comparative";
  const isPractical = lengthKey === "practical";

  // ===== TOPIC 데이터 활용 =====
  const topicName = topicData.name;
  const topicDescription = topicData.description
    ? `\n【主題説明】${topicData.description}`
    : "";

  const topicKeywords = topicData.keywords?.length
    ? `\n【キーワード】${topicData.keywords.join("、")}`
    : "";

  const culturalContext = topicData.culturalContext
    ? `\n【文化的背景】${topicData.culturalContext}`
    : "";

  const controversyNote = topicData.controversyLevel
    ? `\n【論争性】${topicData.controversyLevel}`
    : "";

  // ===== LENGTH-DEFINITIONS 데이터 =====
  const subtypeLabel = subtypeData?.label || "";
  const styleHint = subtypeData?.description || "";

  const characteristicsText = subtypeData?.characteristics
    ? `\n【文章特徴】\n${subtypeData.characteristics
        .map((c) => `- ${c}`)
        .join("\n")}`
    : "";

  const questionFocus = subtypeData?.question_focus || "";
  const vocabLevel = subtypeData?.vocabulary_level || "";

  const exampleTopics = subtypeData?.example_topics
    ? `（参考：${subtypeData.example_topics.join("、")}）`
    : "";

  // ===== GENRE 데이터 활용 =====
  let genreCharacteristics = "";
  let genreQuestionTypes = "";
  let genreVocabulary = "";
  let genreGrammar = "";
  let genreTextStructure = "";
  let genreVariationPatterns = "";
  let genreInstructions = "";
  let lengthAdaptation = "";

  if (genreFullData) {
    if (genreFullData.characteristics) {
      genreCharacteristics = `\n【ジャンル特性】\n${genreFullData.characteristics
        .map((c) => `- ${c}`)
        .join("\n")}`;
    }

    if (genreFullData.question_types) {
      const qtEntries = Object.entries(genreFullData.question_types);
      genreQuestionTypes = `\n【出題タイプ】\n${qtEntries
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")}`;
    }

    if (genreFullData.vocabulary_focus) {
      genreVocabulary = `\n【ジャンル語彙】${genreFullData.vocabulary_focus}`;
    }

    if (genreFullData.grammar_style) {
      genreGrammar = `\n【文法スタイル】${genreFullData.grammar_style}`;
    }

    if (genreFullData.text_structure?.basic_flow) {
      genreTextStructure = `\n【文章構造】${genreFullData.text_structure.basic_flow}`;
    }

    // 변형 패턴 추가
    if (genreFullData.text_structure?.variation_patterns) {
      genreVariationPatterns = `\n【構造バリエーション】\n${genreFullData.text_structure.variation_patterns
        .map((p) => `- ${p}`)
        .join("\n")}`;
    }

    if (genreFullData.instructions) {
      genreInstructions = `\n【作成指針】${genreFullData.instructions}`;
    }

    // 길이별 적응 (length_adaptations)
    const adaptation = genreFullData.length_adaptations?.[lengthKey];
    if (adaptation) {
      // lengthKey에 해당하는 label 가져오기
      const lengthLabel =
        lengthsData.length_categories?.[lengthKey]?.base_info?.label ||
        lengthKey;

      lengthAdaptation = `\n【${lengthLabel}文章の焦点】
- 重点: ${adaptation.focus || ""}
- 構成: ${adaptation.structure || ""}
- 問題強調: ${adaptation.question_emphasis || ""}`;
    }
  }

  // ===== SPEAKER 데이터 활용 =====
  let speakerInfo = "";
  if (speakerData) {
    speakerInfo = `\n【話者設定】
- 立場: ${speakerData.label || ""}
- 年齢層: ${speakerData.age || ""}
- 文体: ${speakerData.style || ""}
- 語彙: ${speakerData.vocabulary || ""}
- 語調: ${speakerData.tone || ""}`;
  }

  // ===== TRAP 데이터 활용 (trap.json) - N1 전용 =====
  let trapElements = "";
  if (level === "N1" && trapData) {
    // 모든 함정 요소를 하나의 배열로 통합
    const allTraps = [
      ...(trapData.opening_traps || []),
      ...(trapData.middle_complexity || []),
      ...(trapData.conclusion_subtlety || []),
      ...(trapData.linguistic_devices || []),
    ];

    // 전체 함정 중 1개만 랜덤 선택
    if (allTraps.length > 0) {
      const selectedTrap = pick(allTraps);
      trapElements = `\n【ひっかけ要素 (N1実戦レベル)】
- ${selectedTrap}`;
    }
  }

  const rulesText = subtypeData?.rules
    ? `\n${subtypeData.rules.map((r) => `- ${r}`).join("\n")}`
    : "";

  let structureText = `{\n  "passage": "本文（${charRange}）",\n  "questions": [\n    {...}\n  ]\n}`;

  if (isComparative) {
    structureText = `{\n  "passages": {\n    "A": "文章A（${charRange}）",\n    "B": "文章B（${charRange}）"\n  },\n  "questions": [\n    {...}\n  ]\n}`;
  } else if (isPractical) {
    const exampleDocs = ["案内文", "通知文", "申請書"];
    structureText = `{\n  "passages": [\n    "${exampleDocs[0]}",\n    "${exampleDocs[1]}",\n    "${exampleDocs[2]}"\n  ],\n  "questions": [\n    {...}\n  ]\n}`;
  }

  return `以下の条件で${level}レベルの読解問題を生成してください。

【テーマ】${topicName}${exampleTopics}${topicDescription}${topicKeywords}${culturalContext}${controversyNote}
【ジャンル】${genreFullData?.label || ""}
${subtypeLabel ? `【タイプ】${subtypeLabel}` : ""}
${
  styleHint ? `【スタイル】${styleHint}` : ""
}${characteristicsText}${genreCharacteristics}${speakerInfo}

【文字数】${charRange}
【問題数】${questionCount}問
${questionFocus ? `【問題焦点】${questionFocus}` : ""}
${
  vocabLevel ? `【語彙レベル】${vocabLevel}` : ""
}${genreVocabulary}${genreGrammar}${genreTextStructure}${genreVariationPatterns}${lengthAdaptation}${genreQuestionTypes}${genreInstructions}${trapElements}

【JSON形式で回答】
${structureText}

【各問題の形式】
"questions": [
  {
    "question": "問題文(具体的な質問)",
    "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
    "correctAnswer": 1,
    "explanation": "解説(韓国語)"
  }${questionCount > 1 ? ",\n    {...}" : ""}
]

【重要な注意事項】
- correctAnswerは必ず1, 2, 3, 4のいずれかの数字を指定
- explanationは必ず韓国語で記述
- JSON構造を厳密に守り、他のテキストは一切含まない
- 【問題焦点】と【出題タイプ】に沿った問題を作成すること
- 【語彙レベル】【ジャンル語彙】に適した語彙を使用すること
- 【文法スタイル】に従った文法を使用すること
- 【文章構造】と【構造バリエーション】を参考に多様な展開を試みること
- 【話者設定】の文体、語調、語彙レベルを反映すること
- 【作成指針】を厳守すること${
    level === "N1" && trapElements
      ? "\n- **【ひっかけ要素】を必ず活用し、N1レベルの実戦的な難易度を確保すること**"
      : ""
  }

【ルール】
1. ${level}語彙・文法必須
2. 選択肢各15-25字、全て妥当
${rulesText}`;
}

// ===== 검증 =====
function validateProblem(problem, expectedQuestionCount, lengthKey) {
  const isComparative = lengthKey === "comparative";
  const isPractical = lengthKey === "practical";

  if (isComparative) {
    if (!problem.passages?.A || !problem.passages?.B) {
      throw new Error("比較型はpassages.AとBが必要です");
    }
  } else if (isPractical) {
    if (!Array.isArray(problem.passages) || problem.passages.length < 3) {
      throw new Error("実用文は3～4個の文章が必要です");
    }
  } else {
    if (!problem.passage) {
      throw new Error("passageフィールドが必要です");
    }
  }

  if (
    !Array.isArray(problem.questions) ||
    problem.questions.length !== expectedQuestionCount
  ) {
    throw new Error(`問題数が${expectedQuestionCount}個必要です`);
  }

  problem.questions.forEach((q, idx) => {
    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`問題${idx + 1}の形式が不正です`);
    }
    if (
      typeof q.correctAnswer !== "number" ||
      q.correctAnswer < 1 ||
      q.correctAnswer > 4
    ) {
      throw new Error(`問題${idx + 1}の正解番号が不正です`);
    }
    if (!q.explanation) {
      throw new Error(`問題${idx + 1}に解説が必要です`);
    }
  });

  return true;
}

// ===== 메인 핸들러 =====
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      lengthKey = "medium",
      levels = ["N1"],
      preferredCategory = null,
    } = req.body || {};

    const topicsData = loadJSONFromPublicData("topics.json");
    const genreData = loadJSONFromPublicData("genre.json");
    const lengthsData = loadJSONFromPublicData("length-definitions.json");
    const speakersData = loadJSONFromPublicData("speakers.json");
    const trapData = loadJSONFromPublicData("trap.json");

    const actualLevel = levels[0] || "N1";

    const { lk, subtypeKey, subtypeData } = selectSubtype(lengthsData, {
      lengthKey,
      level: actualLevel,
    });

    // ✅ 개선: 전체 주제 데이터 활용
    const topicData = selectTopicByLevel(topicsData, levels, preferredCategory);

    const baseInfo = lengthsData.length_categories?.[lk]?.base_info || {};
    const charRange =
      subtypeData?.character_range || baseInfo?.character_range || "450~700字";
    const questionCount = decideQuestionCount(lengthsData, lk, subtypeData);

    // ✅ 개선: 장르 데이터 완전 활용
    let genreFullData = null;
    if (Array.isArray(genreData)) {
      genreFullData = genreData[Math.floor(Math.random() * genreData.length)];
    }

    // ✅ 개선: 화자 선택 시스템 추가
    const selectedSpeaker = selectSpeaker(
      speakersData,
      preferredCategory || "social",
      lk
    );

    const prompt = buildPrompt(
      actualLevel,
      topicData,
      genreFullData,
      charRange,
      questionCount,
      subtypeData,
      selectedSpeaker,
      lk,
      lengthsData,
      trapData
    );

    if (shouldLogPrompt()) {
      console.log("\n=== PROMPT ===\n", prompt, "\n==============\n");
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = message.content[0].text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Claudeが有効なJSONを返しませんでした");
    }

    const problem = JSON.parse(jsonMatch[0]);
    validateProblem(problem, questionCount, lk);

    res.status(200).json({
      success: true,
      problem,
      metadata: {
        level: actualLevel,
        topic: topicData.name,
        lengthKey: lk,
        subtypeKey,
        questionCount,
        speaker: selectedSpeaker?.label,
        genre: genreFullData?.label,
      },
    });
  } catch (error) {
    console.error("❌ 문제 생성 실패:", error);
    res.status(500).json({
      success: false,
      error: error.message || "文章生成に失敗しました",
    });
  }
}
