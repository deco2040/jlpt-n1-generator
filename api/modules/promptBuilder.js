// api/modules/promptBuilder.js
// Claude API용 프롬프트 생성 - 단순화 버전
// selectionEngine에서 이미 필터링된 데이터를 받아 조립만 함

/**
 * 메인 프롬프트 빌더
 * @param {Object} params - 프롬프트 생성에 필요한 모든 파라미터 (이미 필터링됨)
 * @returns {string} 완성된 프롬프트 텍스트
 */
export function buildPrompt(params) {
  const {
    level,
    topicData,
    genreFullData,
    charRange,
    questionCount,
    subtypeData,
    speakerData,
    lengthKey,
    lengthsData,
    trapElement,
  } = params;

  const isComparative = lengthKey === "comparative";
  const isPractical = lengthKey === "practical";

  // ===== 주제 정보 =====
  const topicSection = buildTopicSection(topicData);

  // ===== 서브타입 정보 =====
  const subtypeSection = buildSubtypeSection(subtypeData);

  // ===== 장르 정보 =====
  const genreSection = buildGenreSection(genreFullData, lengthKey, lengthsData);

  // ===== 화자 정보 (있을 경우만) =====
  const speakerSection = speakerData ? buildSpeakerSection(speakerData) : "";

  // ===== 함정 요소 (N1, 있을 경우만) =====
  const trapSection = trapElement ? buildTrapSection(trapElement, level) : "";

  // ===== JSON 구조 =====
  const structureText = buildStructureText(
    isComparative,
    isPractical,
    charRange
  );

  // ===== 최종 프롬프트 조립 =====
  return `以下の条件で${level}レベルの読解問題を生成してください。

${topicSection}
【ジャンル】${genreFullData?.label || "一般文章"}
${subtypeSection}
${genreSection.characteristics}
${speakerSection}

【文字数】${charRange}
【問題数】${questionCount}問
${
  subtypeData?.question_focus ? `【問題焦点】${subtypeData.question_focus}` : ""
}
${
  subtypeData?.vocabulary_level
    ? `【語彙レベル】${subtypeData.vocabulary_level}`
    : ""
}
${genreSection.vocabulary}
${genreSection.grammar}
${genreSection.textStructure}
${genreSection.variations}
${genreSection.lengthAdaptation}
${genreSection.questionTypes}
${genreSection.instructions}
${trapSection}

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
${speakerSection ? "- 【話者設定】の文体、語調、語彙レベルを反映すること" : ""}
${genreSection.instructions ? "- 【作成指針】を厳守すること" : ""}${
    trapSection
      ? "\n- **【ひっかけ要素】を必ず活用し、N1レベルの実戦的な難易度を確保すること**"
      : ""
  }

【ルール】
1. 正確なJSON出力のみ返す
2. 他の説明文やマークダウンは含めない
3. 問題の質を最優先に考える`;
}

/**
 * 주제 섹션 생성
 */
function buildTopicSection(topicData) {
  if (!topicData) return "【テーマ】一般的な話題";

  const parts = [`【テーマ】${topicData.name || "一般的な話題"}`];

  if (topicData.description) {
    parts.push(`【主題説明】${topicData.description}`);
  }

  if (topicData.keywords?.length) {
    parts.push(`【キーワード】${topicData.keywords.join("、")}`);
  }

  // 이미 필터링된 데이터이므로 존재하면 그대로 추가
  if (topicData.culturalContext) {
    parts.push(`【文化的背景】${topicData.culturalContext}`);
  }

  if (topicData.controversyLevel) {
    parts.push(`【論争性】${topicData.controversyLevel}`);
  }

  return parts.join("\n");
}

/**
 * 서브타입 섹션 생성
 */
function buildSubtypeSection(subtypeData) {
  if (!subtypeData) return "";

  const parts = [];

  if (subtypeData.label) {
    parts.push(`【タイプ】${subtypeData.label}`);
  }

  if (subtypeData.description) {
    parts.push(`【スタイル】${subtypeData.description}`);
  }

  // 이미 필터링된 데이터이므로 존재하면 그대로 추가
  if (subtypeData.characteristics?.length) {
    parts.push(
      `【文章特徴】\n${subtypeData.characteristics
        .map((c) => `- ${c}`)
        .join("\n")}`
    );
  }

  if (subtypeData.example_topics?.length) {
    parts.push(`(参考:${subtypeData.example_topics.join("、")})`);
  }

  return parts.join("\n");
}

/**
 * 장르 섹션 생성
 */
function buildGenreSection(genreFullData, lengthKey, lengthsData) {
  const section = {
    characteristics: "",
    questionTypes: "",
    vocabulary: "",
    grammar: "",
    textStructure: "",
    variations: "",
    lengthAdaptation: "",
    instructions: "",
  };

  if (!genreFullData) return section;

  // 이미 필터링된 데이터이므로 존재하는 것만 추가

  // 장르 특성
  if (genreFullData.characteristics?.length) {
    section.characteristics = `\n【ジャンル特性】\n${genreFullData.characteristics
      .map((c) => `- ${c}`)
      .join("\n")}`;
  }

  // 출제 타입
  if (genreFullData.question_types) {
    const entries = Object.entries(genreFullData.question_types);
    section.questionTypes = `\n【出題タイプ】\n${entries
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n")}`;
  }

  // 어휘
  if (genreFullData.vocabulary_focus) {
    section.vocabulary = `\n【ジャンル語彙】${genreFullData.vocabulary_focus}`;
  }

  // 문법
  if (genreFullData.grammar_style) {
    section.grammar = `\n【文法スタイル】${genreFullData.grammar_style}`;
  }

  // 문장 구조
  if (genreFullData.text_structure?.basic_flow) {
    section.textStructure = `\n【文章構造】${genreFullData.text_structure.basic_flow}`;
  }

  // 구조 변형 패턴
  if (genreFullData.text_structure?.variation_patterns?.length) {
    section.variations = `\n【構造バリエーション】\n${genreFullData.text_structure.variation_patterns
      .map((p) => `- ${p}`)
      .join("\n")}`;
  }

  // 길이별 적응
  const adaptation = genreFullData.length_adaptations?.[lengthKey];
  if (adaptation) {
    const lengthLabel =
      lengthsData?.length_categories?.[lengthKey]?.base_info?.label ||
      lengthKey;

    section.lengthAdaptation = `\n【${lengthLabel}文章の焦点】
- 重点: ${adaptation.focus || ""}
- 構成: ${adaptation.structure || ""}
- 問題強調: ${adaptation.question_emphasis || ""}`;
  }

  // 작성 지침
  if (genreFullData.instructions) {
    section.instructions = `\n【作成指針】${genreFullData.instructions}`;
  }

  return section;
}

/**
 * 화자 섹션 생성
 */
function buildSpeakerSection(speakerData) {
  if (!speakerData) return "";

  return `\n【話者設定】
- 立場: ${speakerData.label || ""}
- 年齢層: ${speakerData.age || ""}
- 文体: ${speakerData.style || ""}
- 語彙: ${speakerData.vocabulary || ""}
- 語調: ${speakerData.tone || ""}`;
}

/**
 * 함정 요소 섹션 (N1 전용)
 */
function buildTrapSection(trapElement, level) {
  if (level !== "N1" || !trapElement) return "";

  return `\n【ひっかけ要素 (N1実戦レベル)】
- ${trapElement}`;
}

/**
 * JSON 구조 텍스트 생성
 */
function buildStructureText(isComparative, isPractical, charRange) {
  if (isComparative) {
    return `{
  "passages": {
    "A": "文章A(${charRange})",
    "B": "文章B(${charRange})"
  },
  "questions": [
    {...}
  ]
}`;
  }

  if (isPractical) {
    return `{
  "passages": [
    "案内文",
    "通知文",
    "申請書"
  ],
  "questions": [
    {...}
  ]
}`;
  }

  return `{
  "passage": "本文(${charRange})",
  "questions": [
    {...}
  ]
}`;
}
