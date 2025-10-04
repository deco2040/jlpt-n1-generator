// api/generate-reading.js
// JLPT N1 독해 문제 생성 API (최종 버전)

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

// ===== 주제 선택 =====
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
      return wantedLevels.some((w) => lv.includes(w));
    });
    if (items.length) {
      const selected = pick(items);
      return {
        title: selected.topic || selected.title || "現代社会の変化",
        category: catKey,
      };
    }
  }

  return { title: "環境と持続可能性", category: null };
}

// ===== 화자 선택 =====
function selectSpeaker(speakersData, shouldInclude) {
  if (!shouldInclude) {
    return {
      category: "objective",
      label: "客観的な視点",
      ageRange: "-",
      writingStyle: "客観的",
    };
  }

  const categories = speakersData?.speaker_categories || {};
  const categoryKeys = Object.keys(categories);

  if (!categoryKeys.length) {
    return {
      category: "objective",
      label: "客観的な視点",
      ageRange: "-",
      writingStyle: "客観的",
    };
  }

  const categoryKey = pick(categoryKeys);
  const category = categories[categoryKey];
  const typeKeys = Object.keys(category);

  if (!typeKeys.length) {
    return {
      category: "objective",
      label: "客観的な視点",
      ageRange: "-",
      writingStyle: "客観的",
    };
  }

  const typeKey = pick(typeKeys);
  const speaker = category[typeKey];

  return {
    category: categoryKey,
    type: typeKey,
    label: speaker.label || "話者",
    ageRange: pick(speaker.age_ranges || ["-"]),
    writingStyle: pick(speaker.writing_styles || ["標準"]),
  };
}

// ===== 문제 수 결정 =====
function decideQuestionCount(lengthsData, lengthKey, subtypeData) {
  const questionConfig = subtypeData?.question_count;
  if (!questionConfig) return 1;

  const possibleCounts = questionConfig?.possible_counts || [1];
  const countWeights = questionConfig?.weights || possibleCounts.map(() => 1);
  const totalWeight = countWeights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;

  for (let i = 0; i < possibleCounts.length; i++) {
    r -= countWeights[i];
    if (r < 0) return possibleCounts[i];
  }

  return possibleCounts[0];
}

// ===== 프롬프트 생성 =====
function buildPrompt(config, pickFn) {
  const {
    level,
    topic,
    charRange,
    lengthKey,
    genreInfo,
    trapsObj,
    speakerInfo,
    questionCount,
  } = config;

  const isComparative = lengthKey === "comparative";
  const isPractical = lengthKey === "practical";

  let passageInstruction = "";
  let passageJsonStructure = '"passage": "本文全体"';

  if (isComparative) {
    passageInstruction = "\n【比較型】A文とB文、異なる視点を明確に対比";
    passageJsonStructure = '"passages": {"A": "A文", "B": "B文"}';
  } else if (isPractical) {
    passageInstruction = "\n【実用文】3～4個の関連文書、総合理解問題必須";
    passageJsonStructure = '"passages": ["文書1", "文書2", "文書3"]';
  }

  const genreInfoText = genreInfo?.label
    ? `\nジャンル: ${genreInfo.label}`
    : "";

  let trapSection = "";
  if (trapsObj) {
    const trapExamples = [
      pickFn(trapsObj.opening_traps || []),
      pickFn(trapsObj.middle_complexity || []),
      pickFn(trapsObj.conclusion_subtlety || []),
      pickFn(trapsObj.linguistic_devices || []),
    ]
      .filter(Boolean)
      .join("\n- ");

    if (trapExamples) {
      trapSection = `\n【${level}トラップ要素】以下を自然に活用:\n- ${trapExamples}`;
    }
  }

  let speakerSection = "";
  if (speakerInfo && speakerInfo.category !== "objective") {
    speakerSection = `\n【話者】${speakerInfo.label} / ${speakerInfo.ageRange} / ${speakerInfo.writingStyle}
話者の特性と観点を自然に反映`;
  }

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
      "correctAnswer": 2,
      "explanation": "正解の理由を韓国語で説明"
    }${questionCount > 1 ? ",\n    {...}" : ""}
  ]
}

【重要な注意事項】
- correctAnswerは必ず1, 2, 3, 4のいずれかの数字を指定
- explanationは必ず韓国語で記述
- JSON構造を厳密に守り、他のテキストは一切含めない

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

  if (req.method === "OPTIONS") return res.status(200).end();
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

    const actualLevel = levels[0] || "N1";

    const { lk, subtypeKey, subtypeData } = selectSubtype(lengthsData, {
      lengthKey,
      level: actualLevel,
    });

    const selectedTopic = selectTopicByLevel(
      topicsData,
      levels,
      preferredCategory
    );

    const baseInfo = lengthsData.length_categories?.[lk]?.base_info || {};
    const charRange =
      subtypeData?.character_range || baseInfo?.character_range || "450~700字";
    const questionCount = decideQuestionCount(lengthsData, lk, subtypeData);

    const genreList = Array.isArray(genreData) ? genreData : [];
    const trapsObj = genreList.find((g) => g.type === "n1_trap_elements");
    const availableGenres = genreList.filter(
      (g) => g.type !== "n1_trap_elements" && g.length_adaptations?.[lk]
    );
    const selectedGenre = availableGenres.length ? pick(availableGenres) : null;

    const shouldIncludeTraps = Math.random() < 0.6;
    const shouldIncludeSpeaker = Math.random() < 0.7;

    console.log(
      `🎲 함정: ${shouldIncludeTraps ? "포함" : "제외"} | 화자: ${
        shouldIncludeSpeaker ? "포함" : "제외"
      }`
    );

    const speakerInfo = selectSpeaker(speakersData, shouldIncludeSpeaker);

    const prompt = buildPrompt(
      {
        level: actualLevel,
        topic: selectedTopic.title,
        charRange,
        lengthKey: lk,
        genreInfo: selectedGenre,
        trapsObj: shouldIncludeTraps ? trapsObj : null,
        speakerInfo,
        questionCount,
      },
      pick
    );

    if (shouldLogPrompt()) {
      console.log("===== [Claude Prompt] =====");
      console.log(prompt);
      console.log("============================");
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.8,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content?.[0]?.text ?? "";
    const cleanedRaw = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const jsonMatch = cleanedRaw.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("JSON形式が見つかりません");

    const problem = JSON.parse(jsonMatch[0]);

    validateProblem(problem, questionCount, lk);

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
        includesSpeaker: shouldIncludeSpeaker,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[generate-reading] ERROR:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
