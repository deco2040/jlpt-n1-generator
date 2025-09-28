// api/generate-reading.js (통합 및 최적화 버전)
import fs from "fs";
import path from "path";
import {
  generateSpeakerPromptText,
  selectOptimalSpeaker,
} from "../utils/speakerUtils.js";

// 데이터 로딩 함수들
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

// 유틸리티 함수들
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

// 개선된 프롬프트 생성 함수 (화자 시스템 통합)
function createEnhancedPrompt(topic, genre, lengthType = "medium") {
  const trapElements = getN1TrapElements();
  const lengthInfo = getLengthInfo(lengthType);
  const questionCount = getRandomQuestionCount(lengthType);
  const lengthStructure = generateLengthSpecificStructure(
    lengthType,
    questionCount
  );

  // 화자 선택 (주제 카테고리 기반)
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
    const selectedTraps = [];

    if (trapElements.vocabulary_traps) {
      selectedTraps.push(...trapElements.vocabulary_traps.slice(0, numTraps));
    }

    if (trapElements.grammar_traps && selectedTraps.length < numTraps) {
      selectedTraps.push(
        ...trapElements.grammar_traps.slice(0, numTraps - selectedTraps.length)
      );
    }

    if (selectedTraps.length > 0) {
      trapElementsText = `\n**N1 함정 요소 포함** (고난이도):\n${selectedTraps
        .map((trap) => `• ${trap}`)
        .join("\n")}\n`;
      trapInstructions = `\n• 위 함정 요소를 자연스럽게 포함하되, 과도하지 않게 적용`;
    }
  }

  // 화자별 프롬프트 텍스트 생성
  const speakerPromptText = generateSpeakerPromptText(speaker);

  const basePrompt = `당신은 JLPT N1 독해 문제 출제 전문가입니다.

${speakerPromptText}

**주제**: ${topic.topic}
**카테고리**: ${topic.category}
**설명**: ${topic.description}

**장르**: ${genre.label} (${genre.type})
**장르 설명**: ${genre.description}

**장르별 특성**:
${characteristicsText}

**문체 및 어휘**:
• 어휘 중점: ${genre.vocabulary_focus || "N1 수준 고급 어휘"}
• 문법 스타일: ${genre.grammar_style || "N1 수준 복합 문법 구조"}

${questionTypesText ? `**출제 문제 유형**:\n${questionTypesText}\n` : ""}

${textStructureText}

${genre.instructions ? `**장르별 지침**: ${genre.instructions}\n` : ""}

${trapElementsText}

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

// 백업 문제 생성 함수
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
        "東京都美術館では、来月より特別展「現代アートの挑戦」を開催いたします。開催期間は4月1日から6月30日まで、休館日は毎週月曜日（祝日の場合は翌日）です。入場料は一般1500円、大学生1000円、高校生以下無料となっております。事前予約制となっており、公式ウェブサイトまたは電話（03-1234-5678）にてお申し込みください。",
      questions: generateBackupQuestions(questionCount),
    },
  };

  return backupProblems[lengthType] || backupProblems.medium;
}

// 백업 질문 생성 함수
function generateBackupQuestions(count) {
  const baseQuestions = [
    {
      question: "이 문장의 주요 주제는 무엇입니까?",
      choices: [
        "현대 사회의 변화와 대응 방안",
        "전통적 가치의 완전한 회복",
        "기술 발전의 부정적 측면만",
        "개인주의 문화의 확산",
      ],
      correct: 0,
      explanation:
        "문장 전체에서 현대 사회의 변화와 그에 대한 대응 방안을 논하고 있습니다.",
    },
    {
      question: "저자의 관점에서 가장 중요하게 여기는 것은?",
      choices: [
        "균형잡힌 접근과 종합적 해결책",
        "전통적 방식의 고수",
        "급진적 변화의 추진",
        "개별적 해결책의 적용",
      ],
      correct: 0,
      explanation:
        "다양한 관점을 종합하여 균형잡힌 해결책을 제시하고 있습니다.",
    },
    {
      question: "문장에서 제시된 문제의 원인으로 언급되지 않은 것은?",
      choices: [
        "자연재해의 영향",
        "사회 구조의 변화",
        "가치관의 다양화",
        "기술 발전의 부작용",
      ],
      correct: 0,
      explanation: "자연재해에 대한 언급은 문장에서 찾을 수 없습니다.",
    },
  ];

  return baseQuestions.slice(0, count);
}

// Claude API 호출 함수
async function callClaudeAPI(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// JSON 응답 파싱 함수
function parseClaudeResponse(responseText) {
  try {
    // 마크다운 코드 블록 제거
    let cleanedResponse = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // JSON 파싱
    const problem = JSON.parse(cleanedResponse);

    // 기본 검증
    if (!problem.type || !problem.passage) {
      throw new Error("필수 필드가 누락된 응답");
    }

    return problem;
  } catch (error) {
    console.error("JSON 파싱 실패:", error);
    throw new Error(`응답 파싱 실패: ${error.message}`);
  }
}

// 메인 핸들러 함수
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 메서드만 허용됩니다." });
  }

  const { type: requestType, length: selectedLength } = req.body;

  // 요청 타입 검증
  if (requestType !== "generate") {
    return res.status(400).json({ error: "지원하지 않는 요청 타입입니다." });
  }

  // 길이 타입 검증
  const validLengths = ["short", "medium", "long", "comparative", "practical"];
  if (!validLengths.includes(selectedLength)) {
    return res.status(400).json({ error: "유효하지 않은 길이 타입입니다." });
  }

  try {
    // 랜덤 요소 선택
    const topic = getRandomTopic();
    const genre = getRandomGenre();
    const expectedQuestionCount = getRandomQuestionCount(selectedLength);

    // 프롬프트 생성
    const { prompt, metadata: promptMeta } = createEnhancedPrompt(
      topic,
      genre,
      selectedLength
    );

    console.log(
      `문제 생성 시작: ${selectedLength} (예상 문제 수: ${expectedQuestionCount})`
    );

    // Claude API 호출
    const claudeResponse = await callClaudeAPI(prompt);
    const problem = parseClaudeResponse(claudeResponse);

    // 실제 문제 수 확인
    const actualQuestionCount = problem.questions
      ? problem.questions.length
      : 1;

    console.log(
      `문제 생성 완료: 예상 ${expectedQuestionCount}개, 실제 ${actualQuestionCount}개`
    );

    // 메타데이터와 함께 응답
    const problemWithMeta = {
      ...problem,
      generatedAt: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      problem: problemWithMeta,
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
