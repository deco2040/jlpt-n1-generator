// api/generate-reading-enhanced.js (기존 generate-reading.js 개선 버전)
import fs from "fs";
import path from "path";
import {
  generateSpeakerPromptText,
  selectOptimalSpeaker,
} from "../utils/speakerUtils.js";

// 기존 JSON 로딩 함수들 (변경 없음)
function loadLengthDefinitions() {
  try {
    const lengthPath = path.join(process.cwd(), "data/length-definitions.json");
    const lengthContent = fs.readFileSync(lengthPath, "utf8");
    return JSON.parse(lengthContent);
  } catch (error) {
    console.error("length-definitions.json 로드 실패:", error);
    return null;
  }
}

function loadTopics() {
  try {
    const topicsPath = path.join(process.cwd(), "data/topics.json");
    const topicsContent = fs.readFileSync(topicsPath, "utf8");
    return JSON.parse(topicsContent);
  } catch (error) {
    console.error("topics.json 로드 실패:", error);
    return null;
  }
}

function loadGenres() {
  try {
    const genrePath = path.join(process.cwd(), "data/genre.json");
    const genreContent = fs.readFileSync(genrePath, "utf8");
    return JSON.parse(genreContent);
  } catch (error) {
    console.error("genre.json 로드 실패:", error);
    return null;
  }
}

// 기존 유틸리티 함수들 (변경 없음)
function getRandomQuestionCount(lengthType) {
  const lengthData = loadLengthDefinitions();

  if (!lengthData || !lengthData.question_count_config) {
    const fallbackRanges = {
      short: [1],
      medium: [1, 2],
      long: [3, 4, 5],
      comparative: [2, 3],
      practical: [2, 3, 4],
    };
    const range = fallbackRanges[lengthType] || [1];
    return range[Math.floor(Math.random() * range.length)];
  }

  const config = lengthData.question_count_config.ranges[lengthType];
  if (!config) {
    return 1;
  }

  const { possible_counts, weights, default: defaultCount } = config;

  if (!weights || weights.length !== possible_counts.length) {
    const randomIndex = Math.floor(Math.random() * possible_counts.length);
    return possible_counts[randomIndex];
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const randomValue = Math.random() * totalWeight;

  let cumulativeWeight = 0;
  for (let i = 0; i < possible_counts.length; i++) {
    cumulativeWeight += weights[i];
    if (randomValue <= cumulativeWeight) {
      return possible_counts[i];
    }
  }

  return defaultCount || possible_counts[0];
}

function getLengthInfo(lengthType) {
  const lengthData = loadLengthDefinitions();
  if (!lengthData || !lengthData.length_categories) {
    return null;
  }
  return lengthData.length_categories[lengthType]?.base_info || null;
}

function getRandomTopic() {
  const topicsData = loadTopics();
  if (!topicsData || !topicsData.topics) {
    return {
      topic: "현대 사회의 기술 발전과 인간관계 변화",
      category: "사회와 기술",
      description: "기술 발전이 사회에 미치는 영향과 인간관계의 변화",
      categoryKey: "technology_innovation_ethics",
    };
  }

  const allTopics = [];
  Object.entries(topicsData.topics).forEach(([categoryKey, categoryData]) => {
    if (categoryData.items && Array.isArray(categoryData.items)) {
      categoryData.items.forEach((topicText) => {
        allTopics.push({
          topic: topicText,
          category: categoryData.category,
          description: categoryData.description,
          categoryKey: categoryKey,
        });
      });
    }
  });

  if (allTopics.length === 0) {
    return {
      topic: "현대 사회의 기술 발전과 인간관계 변화",
      category: "사회와 기술",
      description: "기술 발전이 사회에 미치는 영향과 인간관계의 변화",
      categoryKey: "technology_innovation_ethics",
    };
  }

  const randomIndex = Math.floor(Math.random() * allTopics.length);
  return allTopics[randomIndex];
}

function getRandomGenre() {
  const genreData = loadGenres();
  if (!genreData || !Array.isArray(genreData)) {
    return {
      type: "essay",
      label: "에세이",
      description: "개인적 경험이나 감정을 바탕으로 한 자율적이고 감성적인 글",
      characteristics: ["1인칭 시점", "주관적 서술", "감정적 표현"],
      vocabulary_focus: "감정·심리 관련 고급 어휘",
      grammar_style: "회상과 성찰을 표현하는 N1 문법",
      instructions: "개인적 경험을 바탕으로 한 성찰적 글을 작성하세요.",
    };
  }

  const actualGenres = genreData.filter(
    (genre) => genre.type !== "n1_trap_elements"
  );

  if (actualGenres.length === 0) {
    return {
      type: "essay",
      label: "에세이",
      description: "개인적 경험이나 감정을 바탕으로 한 자율적이고 감성적인 글",
      characteristics: ["1인칭 시점", "주관적 서술", "감정적 표현"],
      vocabulary_focus: "감정·심리 관련 고급 어휘",
      grammar_style: "회상과 성찰을 표현하는 N1 문법",
      instructions: "개인적 경험을 바탕으로 한 성찰적 글을 작성하세요.",
    };
  }

  const randomIndex = Math.floor(Math.random() * actualGenres.length);
  return actualGenres[randomIndex];
}

function getN1TrapElements() {
  const genreData = loadGenres();
  if (!genreData || !Array.isArray(genreData)) {
    return null;
  }

  const trapElements = genreData.find(
    (item) => item.type === "n1_trap_elements"
  );
  return trapElements || null;
}

function generateLengthSpecificStructure(lengthType, questionCount) {
  const lengthInfo = getLengthInfo(lengthType);
  const characterRange = lengthInfo?.character_range || "400~600자";

  if (questionCount === 1) {
    return {
      outputFormat: `{
  "type": "reading",
  "length": "${lengthType}",
  "questionCount": ${questionCount},
  "passage": "<${characterRange} 일본어 지문>",
  "question": "<지문 내용에 대한 질문>",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct": 0,
  "explanation": "<정답 해설 - 한국어>"
}`,
      instructions: `• 본문: 정확히 ${characterRange}의 일본어로 구성
• 1개의 질문으로 지문의 핵심을 파악하는 문제 구성
• N1 수준의 고급 어휘와 문법 구조 사용`,
    };
  }

  if (lengthType === "comparative") {
    const questionExamples = Array.from(
      { length: questionCount },
      (_, i) => `    {
      "question": "<두 지문을 비교한 ${i + 1}번째 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": ${i % 4},
      "explanation": "<해설>"
    }`
    ).join(",\n");

    return {
      outputFormat: `{
  "type": "reading",
  "length": "${lengthType}",
  "questionCount": ${questionCount},
  "passage1": "<첫 번째 지문: ${characterRange}>",
  "passage2": "<두 번째 지문: ${characterRange}>",
  "questions": [
${questionExamples}
  ]
}`,
      instructions: `• 지문: 각각 ${characterRange}의 일본어로 구성
• 정확히 ${questionCount}개의 문제로 구성 (필수)
• 두 지문의 비교, 대조, 종합적 사고를 요구하는 문제`,
    };
  }

  const questionExamples = Array.from(
    { length: questionCount },
    (_, i) => `    {
      "question": "<${i + 1}번째 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": ${i % 4},
      "explanation": "<해설>"
    }`
  ).join(",\n");

  return {
    outputFormat: `{
  "type": "reading",
  "length": "${lengthType}",
  "questionCount": ${questionCount},
  "passage": "<${characterRange} 일본어 지문>",
  "questions": [
${questionExamples}
  ]
}`,
    instructions: `• 본문: 정확히 ${characterRange}의 일본어로 구성
• 정확히 ${questionCount}개의 문제로 구성 (필수)
• 다각적 이해도 평가 (주제, 세부사항, 추론, 비판적 사고)
• N1 수준의 고급 어휘와 문법 구조 사용`,
  };
}

// ✅ 개선된 프롬프트 생성 함수 (화자 시스템 통합)
function createEnhancedPrompt(topic, genre, lengthType = "medium") {
  const trapElements = getN1TrapElements();
  const lengthInfo = getLengthInfo(lengthType);
  const questionCount = getRandomQuestionCount(lengthType);
  const lengthStructure = generateLengthSpecificStructure(
    lengthType,
    questionCount
  );

  // ✅ 화자 선택 (주제 카테고리 기반)
  const topicCategory = topic.categoryKey || "social_structure_and_inequality";
  const speaker = selectOptimalSpeaker(topicCategory, lengthType, true);

  // 장르별 특성 문자열 생성
  const characteristicsText = genre.characteristics
    ? genre.characteristics.map((c) => `• ${c}`).join("\n")
    : "";

  const questionTypesText = genre.question_types
    ? Object.entries(genre.question_types)
        .map(([key, value]) => `• ${key}: ${value}`)
        .join("\n")
    : "";

  const textStructureText = genre.text_structure
    ? `
**기본 구조**: ${genre.text_structure.basic_flow}

**구조 변형 패턴**:
${
  genre.text_structure.variation_patterns
    ? genre.text_structure.variation_patterns.map((p) => `• ${p}`).join("\n")
    : ""
}`
    : "";

  // N1 함정 요소 확률적 적용 (20% 확률)
  const shouldIncludeTrap = Math.random() < 0.2;
  const trapDifficulty = shouldIncludeTrap ? "고난이도" : "기본";

  let trapElementsText = "";
  let trapInstructions = "";

  if (shouldIncludeTrap && trapElements) {
    const numTraps = Math.random() < 0.5 ? 1 : 2;
    const allTraps = [
      ...trapElements.opening_traps,
      ...trapElements.middle_complexity,
      ...trapElements.conclusion_subtlety,
      ...trapElements.linguistic_devices,
    ];

    const selectedTraps = [];
    const usedIndices = new Set();

    for (let i = 0; i < numTraps; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * allTraps.length);
      } while (usedIndices.has(randomIndex));

      usedIndices.add(randomIndex);
      selectedTraps.push(allTraps[randomIndex]);
    }

    trapElementsText = `
**고난이도 N1 함정 요소** (다음 ${numTraps}개 요소 포함):
${selectedTraps.map((trap) => `• ${trap}`).join("\n")}`;

    trapInstructions = `
• 위에 제시된 함정 요소를 자연스럽게 포함
• 함정 요소로 인해 오답을 선택하기 쉽도록 구성
• 정답은 명확하지만 함정에 빠지기 쉬운 선택지 배치`;
  } else {
    trapInstructions = `
• 기본 수준의 N1 독해 문제로 구성
• 명확한 논리 구조와 이해하기 쉬운 전개
• 적절한 난이도의 선택지 구성`;
  }

  const characterRange = lengthInfo?.character_range || "400~600자";
  const lengthLabel = lengthInfo?.label || lengthType;

  // ✅ 화자 정보를 포함한 프롬프트 생성
  const speakerPromptText = generateSpeakerPromptText(
    speaker,
    topic,
    genre,
    lengthType
  );

  const basePrompt = `JLPT N1 수준의 ${
    genre.label
  } 독해 문제를 아래 조건에 맞춰 JSON 형식으로 생성해주세요.

**글 길이 유형**: ${lengthLabel}
**글 길이**: ${characterRange}
**문제 수**: 정확히 ${questionCount}개 문제 (필수)
**특성**: ${lengthInfo?.base_characteristics || "N1 수준 독해 문제"}

**난이도**: ${trapDifficulty} 수준
**주제**: ${topic.topic}
**카테고리**: ${topic.category} (${topic.description})
**장르**: ${genre.label}

**장르 설명**: ${genre.description}

**장르 특징**:
${characteristicsText}

**어휘 중점**: ${genre.vocabulary_focus || "N1 수준 고급 어휘"}
**문법 스타일**: ${genre.grammar_style || "N1 수준 고급 문법"}

${textStructureText}

**예상 질문 유형**:
${questionTypesText}

${trapElementsText}

${speakerPromptText}

**작성 지침**:
${genre.instructions || "주어진 장르의 특성에 맞게 작성하세요."}

**필수 요구사항**:
${lengthStructure.instructions}
• 논리적 구조와 일관성 유지${trapInstructions}

**출력 형식** (JSON만, 다른 설명 금지):
${lengthStructure.outputFormat}

반드시 올바른 JSON 형식으로만 응답하세요. 코드블록이나 추가 설명은 절대 포함하지 마세요.`;

  return {
    prompt: basePrompt,
    metadata: {
      speaker: speaker,
      topic: topic,
      genre: genre,
      lengthType: lengthType,
      questionCount: questionCount,
      trapDifficulty: trapDifficulty,
      shouldIncludeTrap: shouldIncludeTrap,
    },
  };
}

// 백업 문제 생성 함수 (변경 없음)
function generateBackupProblem(lengthType = "medium") {
  const lengthInfo = getLengthInfo(lengthType);
  const questionCount = getRandomQuestionCount(lengthType);

  const backupProblems = {
    short: {
      type: "reading",
      length: "short",
      questionCount: 1,
      topic: "기술과 사회 변화",
      passage:
        "現代社会において、スマートフォンの普及により情報アクセスが容易になった。しかし、この便利さの一方で、人々の集中力低下や対面コミュニケーションの減少が指摘されている。技術の恩恵を享受しながらも、人間らしい価値を見失わない社会の構築が重要である。",
      question:
        "この文章で述べられているスマートフォンの普及について最も適切なものはどれですか。",
      choices: [
        "利便性と問題の両面があることを示している",
        "完全に肯定的な影響しかないと述べている",
        "技術の発展が遅いことを批判している",
        "対面コミュニケーションが増加したと述べている",
      ],
      correct: 0,
      explanation:
        "문장에서는 스마트폰 보급의 편리함과 함께 집중력 저하, 대면 소통 감소 등의 문제점도 함께 언급하고 있습니다.",
    },

    medium: {
      type: "reading",
      length: "medium",
      questionCount: questionCount,
      topic: "환경 보호와 경제 발전",
      passage:
        "持続可能な発展を実現するためには、環境保護と経済成長の両立が不可欠である。従来の大量生産・大量消費モデルでは、資源の枯渇や環境破壊が深刻化している。そこで注目されているのがグリーンテクノロジーである。再生可能エネルギーの活用や循環型社会の構築により、経済発展と環境保護を同時に実現できる可能性が高まっている。企業も利益追求だけでなく、社会的責任を重視する経営へと転換しつつある。しかし、初期投資コストの高さや技術的課題など、解決すべき問題も多い。",
      ...(questionCount === 1
        ? {
            question: "이 문장의 주요한 논점으로 최적절한 것은?",
            choices: [
              "환경 보호와 경제 발전의 양립 필요성",
              "환경이 경제보다 중요하다는 주장",
              "경제 발전만을 우선시해야 한다는 관점",
              "그린 테크놀로지의 한계점",
            ],
            correct: 0,
            explanation:
              "지속가능한 발전을 위해서는 환경 보호와 경제 성장의 양립이 '불가결'하다고 언급하고 있습니다.",
          }
        : {
            questions: generateBackupQuestions(questionCount),
          }),
    },

    long: {
      type: "reading",
      length: "long",
      questionCount: questionCount,
      topic: "현대 사회의 가족 형태 변화",
      passage:
        "現代社会における家族形態の多様化は、従来の核家族を中心とした社会構造に大きな変化をもたらしている。単身世帯の増加、晩婚化、少子化などの現象により、家族に対する価値観や役割分担も変化している。特に都市部では、個人のライフスタイルを重視する傾向が強まり、家族の絆よりも個人の自由を優先する人々が増えている。一方で、高齢化社会の進展により、介護問題や世代間の支援体制の構築が重要な課題となっている。社会保障制度の充実とともに、地域コミュニティや企業の支援体制も求められている。このような変化の中で、家族の意味や役割を再定義し、多様な家族形態を受け入れる社会づくりが必要である。",
      questions: generateBackupQuestions(questionCount),
    },

    comparative: {
      type: "reading",
      length: "comparative",
      questionCount: questionCount,
      passage1:
        "日本の伝統的な働き方は、終身雇用制度を基盤とし、企業への忠誠心と安定性を重視してきた。長時間労働も当然とされ、会社の飲み会や残業を通じて同僚との関係を深めることが重要視されていた。",
      passage2:
        "欧米の働き方は、個人のスキルと成果を重視し、転職によるキャリアアップが一般的である。ワークライフバランスが重視され、効率的な働き方と個人の時間の確保が重要とされている。",
      questions: generateBackupQuestions(questionCount),
    },

    practical: {
      type: "reading",
      length: "practical",
      questionCount: questionCount,
      passage:
        "東京都美術館では、来月より特別展「現代アートの挑戦」を開催いたします。開催期間は4月1日から6月30日まで、休館日は毎週月曜日（祝日の場合は翌日）です。入場料は一般1500円、大学生1000円、高校生以下無料です。事前予約制となっており、ウェブサイトまたは電話にて受け付けております。館内では写真撮影が可能ですが、フラッシュの使用は禁止されています。また、音声ガイドの貸し出しも行っており、日本語、英語、中国語、韓国語に対応しています。",
      questions: generateBackupQuestions(questionCount),
    },
  };

  const selectedBackup = backupProblems[lengthType] || backupProblems.medium;

  return {
    ...selectedBackup,
    questionCount: questionCount,
    source: "백업 문제",
    generatedAt: new Date().toISOString(),
    isBackup: true,
    lengthInfo: {
      ...(lengthInfo || {}),
      actualQuestionCount: questionCount,
    },
    // ✅ 백업 문제에도 기본 화자 정보 추가
    speaker: {
      id: "social_commentator",
      label: "사회 논평가",
      category: "intellectuals",
      writing_style: "균형잡힌, 다각적, 건설적",
    },
  };
}

function generateBackupQuestions(count) {
  const baseQuestions = [
    {
      question: "이 문장의 주요한 테마는 무엇인가?",
      choices: [
        "환경 보호와 경제 성장의 양립 필요성",
        "환경이 경제보다 중요하다는 주장",
        "경제 발전만을 우선시해야 한다는 주장",
        "환경 문제는 해결 불가능하다는 관점",
      ],
      correct: 0,
      explanation:
        "지속가능한 발전을 위해서는 환경 보호와 경제 성장의 양립이 필요하다고 언급하고 있습니다.",
    },
    {
      question: "글에서 언급되지 않은 것은?",
      choices: [
        "그린 테크놀로지의 가능성",
        "기업의 사회적 책임",
        "교육 제도의 개혁",
        "지속가능한 발전",
      ],
      correct: 2,
      explanation: "교육 제도의 개혁에 대한 언급은 없습니다.",
    },
    {
      question: "그린 테크놀로지에 대한 설명으로 적절한 것은?",
      choices: [
        "환경과 경제를 동시에 고려하는 기술",
        "단순히 환경만 보호하는 기술",
        "경제 효율성만 추구하는 기술",
        "실현 불가능한 이상적 기술",
      ],
      correct: 0,
      explanation:
        "그린 테크놀로지는 경제발전과 환경보호를 동시에 실현할 수 있는 기술로 설명되고 있습니다.",
    },
    {
      question: "필자의 관점으로 가장 적절한 것은?",
      choices: [
        "환경과 경제의 조화로운 발전 추구",
        "환경보다 경제 발전 우선",
        "경제보다 환경 보호 우선",
        "현재 상황에 대한 비관적 시각",
      ],
      correct: 0,
      explanation:
        "필자는 환경 보호와 경제 성장의 균형잡힌 발전을 주장하고 있습니다.",
    },
    {
      question: "문제점으로 제시된 것은?",
      choices: [
        "초기 투자 비용과 기술적 과제",
        "정부의 정책 부족",
        "시민 의식의 부족",
        "국제 협력의 어려움",
      ],
      correct: 0,
      explanation:
        "초기투자 코스트의 높음과 기술적 과제가 해결해야 할 문제로 언급되어 있습니다.",
    },
  ];

  return baseQuestions.slice(0, Math.min(count, 5));
}

// ✅ 메인 핸들러 (화자 정보 포함하여 응답)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      message: "POST 요청만 허용됩니다.",
    });
  }

  let requestType = "generate";
  let customPrompt = null;
  let selectedLength = "medium";

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (body.type === "custom" && body.prompt) {
      requestType = "custom";
      customPrompt = body.prompt.trim();
    }

    if (body.length && getLengthInfo(body.length)) {
      selectedLength = body.length;
    }

    console.log(
      `[${new Date().toISOString()}] 독해 문제 생성 요청: ${requestType}, 길이: ${selectedLength}`
    );
  } catch (error) {
    console.error("요청 데이터 파싱 실패:", error);
    return res.status(400).json({
      success: false,
      error: "Invalid JSON",
      message: "잘못된 요청 형식입니다.",
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    const backupProblem = generateBackupProblem(selectedLength);
    return res.status(200).json({
      success: false,
      problem: backupProblem,
      message: "API 키가 설정되지 않아 백업 문제를 사용합니다.",
    });
  }

  let finalPrompt;
  let promptMeta = {};

  if (requestType === "custom") {
    // 커스텀 프롬프트에 화자 정보 추가
    const questionCount = getRandomQuestionCount(selectedLength);
    const lengthInfo = getLengthInfo(selectedLength);

    // 기본 화자 선택 (주제 불명확할 때)
    const defaultSpeaker = selectOptimalSpeaker(
      "social_structure_and_inequality",
      selectedLength
    );
    const speakerPromptText = generateSpeakerPromptText(
      defaultSpeaker,
      null,
      null,
      selectedLength
    );

    finalPrompt = `${customPrompt}\n\n${speakerPromptText}\n\n**글 길이 요구사항**: ${
      lengthInfo?.label || selectedLength
    } (${
      lengthInfo?.character_range || "표준 길이"
    })\n**문제 수**: 정확히 ${questionCount}개 문제`;

    promptMeta = {
      type: "custom",
      source: "사용자 정의",
      length: selectedLength,
      questionCount: questionCount,
      speaker: defaultSpeaker,
      lengthInfo: {
        ...(lengthInfo || {}),
        actualQuestionCount: questionCount,
      },
    };
  } else {
    // 자동 생성 프롬프트 (화자 시스템 완전 통합)
    try {
      const topic = getRandomTopic();
      const genre = getRandomGenre();

      const promptResult = createEnhancedPrompt(topic, genre, selectedLength);
      finalPrompt = promptResult.prompt;

      promptMeta = {
        type: "generated",
        topic: topic,
        genre: genre,
        source: "AI 생성",
        length: selectedLength,
        questionCount: promptResult.metadata.questionCount,
        speaker: promptResult.metadata.speaker,
        trapDifficulty: promptResult.metadata.trapDifficulty,
        lengthInfo: {
          ...(getLengthInfo(selectedLength) || {}),
          actualQuestionCount: promptResult.metadata.questionCount,
        },
      };
    } catch (error) {
      console.error("JSON 데이터 로드 실패:", error);
      const backupProblem = generateBackupProblem(selectedLength);
      return res.status(200).json({
        success: false,
        problem: backupProblem,
        message: `데이터 파일 로드 실패: ${error.message}. 백업 문제를 사용합니다.`,
      });
    }
  }

  // Claude API 호출
  try {
    console.log("Claude API 호출 시작...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2500,
        temperature: 0.3,
        messages: [{ role: "user", content: finalPrompt }],
      }),
    });

    console.log(
      `Claude API 응답 상태: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API 에러 ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let responseText = data.content?.[0]?.text?.trim();

    if (!responseText) {
      throw new Error("Claude API 응답에서 텍스트를 찾을 수 없습니다.");
    }

    console.log("Claude API 응답 받음, JSON 파싱 시도...");

    // JSON 파싱
    responseText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("응답에서 유효한 JSON을 찾을 수 없습니다.");
    }

    let generatedProblem;
    try {
      generatedProblem = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("JSON 파싱 실패:", parseError);
      throw new Error(`JSON 파싱 실패: ${parseError.message}`);
    }

    // ✅ 생성된 문제에 화자 정보 포함하여 메타데이터 추가
    const problemWithMeta = {
      ...generatedProblem,
      ...promptMeta,
      generatedAt: new Date().toISOString(),
      timestamp: Date.now(),
      promptLength: finalPrompt.length,
      speakerInfo: {
        id: promptMeta.speaker?.id,
        label: promptMeta.speaker?.label,
        category: promptMeta.speaker?.category,
        subCategory: promptMeta.speaker?.subCategory,
        writing_style: promptMeta.speaker?.writing_style,
        tone_characteristics: promptMeta.speaker?.tone_characteristics,
        age_range: promptMeta.speaker?.age_range,
      },
    };

    // 문제 수 일관성 검증
    const expectedQuestionCount = promptMeta.questionCount;
    let actualQuestionCount = 0;

    if (problemWithMeta.questions && Array.isArray(problemWithMeta.questions)) {
      actualQuestionCount = problemWithMeta.questions.length;
    } else if (problemWithMeta.question) {
      actualQuestionCount = 1;
    }

    if (expectedQuestionCount !== actualQuestionCount) {
      console.warn(
        `문제 수 불일치: 예상 ${expectedQuestionCount}개, 실제 ${actualQuestionCount}개`
      );
      problemWithMeta.questionCountMismatch = true;
    }

    console.log(
      `독해 문제 생성 성공: ${requestType}, 길이: ${selectedLength}, 문제 수: ${actualQuestionCount}/${expectedQuestionCount}, 화자: ${promptMeta.speaker?.label}`
    );

    return res.status(200).json({
      success: true,
      problem: problemWithMeta,
      message: "Claude AI가 새로운 독해 문제를 생성했습니다.",
      metadata: {
        promptType: requestType,
        length: selectedLength,
        expectedQuestionCount: expectedQuestionCount,
        actualQuestionCount: actualQuestionCount,
        isConsistent: expectedQuestionCount === actualQuestionCount,
        generatedAt: problemWithMeta.generatedAt,
        speaker: {
          id: promptMeta.speaker?.id,
          label: promptMeta.speaker?.label,
          category: promptMeta.speaker?.category,
        },
        ...(requestType === "generate" && {
          topicCategory: promptMeta.topic?.category,
          genreType: promptMeta.genre?.label,
          trapDifficulty: promptMeta.trapDifficulty,
        }),
      },
    });
  } catch (error) {
    console.error("Claude API 호출 중 에러:", error);
    const backupProblem = generateBackupProblem(selectedLength);
    return res.status(200).json({
      success: false,
      problem: backupProblem,
      message: `문제 생성 실패: ${error.message}. 백업 문제를 사용합니다.`,
      error: error.message,
    });
  }
}
