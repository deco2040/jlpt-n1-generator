// api/generate-reading.js
import fs from "fs";
import path from "path";

const usedPrompts = new Set();

// 글 길이 정의
const LENGTH_DEFINITIONS = {
  short: {
    label: "단문 (短文)",
    description: "짧은 지문으로 핵심 내용 파악",
    characterRange: "200~400자",
    questionCount: "1문항",
    characteristics: "문법/어휘와 연계된 내용 이해 중심",
  },
  medium: {
    label: "중문 (中文)",
    description: "적당한 길이의 논설문이나 설명문",
    characterRange: "450~700자",
    questionCount: "1~2문제",
    characteristics: "논설문, 설명문, 에세이 등의 구조적 이해",
  },
  long: {
    label: "장문 (長文)",
    description: "긴 지문으로 심화된 독해력 평가",
    characterRange: "800~1,000자 이상",
    questionCount: "3~5문제",
    characteristics: "신문 기사, 논문, 소설 등의 종합적 분석",
  },
  comparative: {
    label: "종합 이해 (統合理解)",
    description: "두 개의 지문을 비교 분석",
    characterRange: "각 300~500자 (총 2개 지문)",
    questionCount: "복합 문제",
    characteristics: "서로 다른 관점이나 의견을 비교하여 이해",
  },
  practical: {
    label: "정보 검색 (情報検索)",
    description: "실용문서나 자료를 활용한 정보 검색",
    characterRange: "600~1,200자",
    questionCount: "정보 검색 문제",
    characteristics: "안내문, 광고, 메뉴얼 등 실용 문서 분석",
  },
};

// JSON 파일 읽기 함수들
function loadTopicsData() {
  try {
    const topicsPath = path.join(process.cwd(), "data/topics.json");
    const topicsContent = fs.readFileSync(topicsPath, "utf8");
    return JSON.parse(topicsContent);
  } catch (error) {
    console.error("topics.json 로드 실패:", error);
    return null;
  }
}

function loadGenresData() {
  try {
    const genresPath = path.join(process.cwd(), "data/genre.json");
    const genresContent = fs.readFileSync(genresPath, "utf8");
    return JSON.parse(genresContent);
  } catch (error) {
    console.error("genre.json 로드 실패:", error);
    return null;
  }
}

// 랜덤 토픽 선택
function getRandomTopic() {
  const topicsData = loadTopicsData();
  if (!topicsData || !topicsData.topics) {
    throw new Error("topics.json 데이터를 불러올 수 없습니다.");
  }

  const categoryKeys = Object.keys(topicsData.topics);
  const randomCategory =
    topicsData.topics[
      categoryKeys[Math.floor(Math.random() * categoryKeys.length)]
    ];
  const randomTopic =
    randomCategory.items[
      Math.floor(Math.random() * randomCategory.items.length)
    ];

  return {
    category: randomCategory.category,
    description: randomCategory.description,
    topic: randomTopic,
  };
}

// 랜덤 장르 선택
function getRandomGenre() {
  const genresData = loadGenresData();
  if (!genresData || !Array.isArray(genresData)) {
    throw new Error("genre.json 데이터를 불러올 수 없습니다.");
  }

  // n1_trap_elements는 제외하고 실제 장르만 선택
  const actualGenres = genresData.filter(
    (genre) => genre.type !== "n1_trap_elements"
  );
  return actualGenres[Math.floor(Math.random() * actualGenres.length)];
}

// N1 함정 요소 가져오기
function getN1TrapElements() {
  const genresData = loadGenresData();
  if (!genresData || !Array.isArray(genresData)) {
    return null;
  }

  return genresData.find((item) => item.type === "n1_trap_elements");
}

// 길이별 문제 구조 생성
function generateLengthSpecificStructure(lengthType) {
  const lengthDef = LENGTH_DEFINITIONS[lengthType];

  switch (lengthType) {
    case "short":
      return {
        outputFormat: `{
  "type": "reading",
  "length": "short",
  "passage": "<${lengthDef.characterRange} 일본어 지문>",
  "question": "<지문의 핵심 내용에 대한 질문>",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct": 0,
  "explanation": "<정답 해설 - 한국어>"
}`,
        instructions: `• 본문: 정확히 ${lengthDef.characterRange}의 일본어로 구성
• 핵심 아이디어나 주장이 명확히 드러나도록 작성
• 1개의 질문으로 지문의 핵심을 파악하는 문제 구성`,
      };

    case "medium":
      return {
        outputFormat: `{
  "type": "reading",
  "length": "medium", 
  "passage": "<${lengthDef.characterRange} 일본어 지문>",
  "questions": [
    {
      "question": "<첫 번째 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": 0,
      "explanation": "<해설>"
    },
    {
      "question": "<두 번째 질문 (선택사항)>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"], 
      "correct": 1,
      "explanation": "<해설>"
    }
  ]
}`,
        instructions: `• 본문: 정확히 ${lengthDef.characterRange}의 일본어로 구성
• 논리적 구조가 명확한 논설문이나 설명문 형태
• 1~2개의 질문으로 구성 (필자의 주장, 근거, 결론 등)`,
      };

    case "long":
      return {
        outputFormat: `{
  "type": "reading",
  "length": "long",
  "passage": "<${lengthDef.characterRange} 일본어 지문>", 
  "questions": [
    {
      "question": "<전체 내용 파악 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": 0,
      "explanation": "<해설>"
    },
    {
      "question": "<세부 내용 이해 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": 1, 
      "explanation": "<해설>"
    },
    {
      "question": "<필자의 의도나 주장 파악 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": 2,
      "explanation": "<해설>"
    }
  ]
}`,
        instructions: `• 본문: 정확히 ${lengthDef.characterRange}의 일본어로 구성
• 복잡한 논리 구조와 다층적 의미를 가진 글
• 3~5개의 질문으로 다각적 이해도 평가 (주제, 세부사항, 추론, 비판적 사고)`,
      };

    case "comparative":
      return {
        outputFormat: `{
  "type": "reading",
  "length": "comparative",
  "passage1": "<첫 번째 지문: ${lengthDef.characterRange}>",
  "passage2": "<두 번째 지문: ${lengthDef.characterRange}>", 
  "questions": [
    {
      "question": "<두 지문의 공통점이나 차이점에 대한 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": 0,
      "explanation": "<해설>"
    },
    {
      "question": "<종합적 판단이나 추론 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": 1,
      "explanation": "<해설>"
    }
  ]
}`,
        instructions: `• 지문: 각각 ${lengthDef.characterRange}의 일본어로 구성
• 같은 주제에 대한 서로 다른 관점이나 상반된 의견 제시
• 비교, 대조, 종합적 사고를 요구하는 문제 구성`,
      };

    case "practical":
      return {
        outputFormat: `{
  "type": "reading", 
  "length": "practical",
  "passage": "<${lengthDef.characterRange} 실용문 지문>",
  "questions": [
    {
      "question": "<구체적 정보 검색 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": 0,
      "explanation": "<해설>"
    },
    {
      "question": "<조건에 맞는 정보 찾기 질문>",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correct": 1,
      "explanation": "<해설>"
    }
  ]
}`,
        instructions: `• 본문: 정확히 ${lengthDef.characterRange}의 실용문 (안내문, 광고, 규칙 등)
• 실제 생활에서 마주할 수 있는 문서 형태로 구성
• 필요한 정보를 빠르고 정확하게 찾는 능력 평가`,
      };

    default:
      return generateLengthSpecificStructure("medium"); // 기본값
  }
}

// 완전한 프롬프트 생성
function createFullPrompt(topic, genre, lengthType = "medium") {
  const trapElements = getN1TrapElements();
  const lengthDef = LENGTH_DEFINITIONS[lengthType];
  const lengthStructure = generateLengthSpecificStructure(lengthType);

  // 장르별 특성 문자열 생성
  const characteristicsText = genre.characteristics
    ? genre.characteristics.map((c) => `• ${c}`).join("\n")
    : "";

  // 질문 유형 문자열 생성
  const questionTypesText = genre.question_types
    ? Object.entries(genre.question_types)
        .map(([key, value]) => `• ${key}: ${value}`)
        .join("\n")
    : "";

  // 텍스트 구조 문자열 생성
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
    // 1~2개 요소 랜덤 선택
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

  return `JLPT N1 수준의 ${
    genre.label
  } 독해 문제를 아래 조건에 맞추어 JSON 형식으로 생성해주세요.

**글 길이 유형**: ${lengthDef.label}
**글 길이**: ${lengthDef.characterRange}
**문제 수**: ${lengthDef.questionCount}
**특성**: ${lengthDef.characteristics}

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

**작성 지침**:
${genre.instructions || "주어진 장르의 특성에 맞게 작성하세요."}

**필수 요구사항**:
${lengthStructure.instructions}
• N1 수준의 고급 어휘와 문법 구조 사용
• 논리적 구조와 일관성 유지${trapInstructions}

**출력 형식** (JSON만, 다른 설명 금지):
${lengthStructure.outputFormat}

반드시 올바른 JSON 형식으로만 응답하세요. 코드블록이나 추가 설명은 절대 포함하지 마세요.`;
}

// 백업 문제 생성 (길이별)
function generateBackupProblem(lengthType = "medium") {
  const lengthDef = LENGTH_DEFINITIONS[lengthType];

  const backupProblems = {
    short: {
      type: "reading",
      length: "short",
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
      topic: "환경 보호와 경제 발전",
      passage:
        "持続可能な発展を実現するためには、環境保護と経済成長の両立が不可欠である。従来の大量生産・大量消費モデルでは、資源の枯渇や環境破壊が深刻化している。そこで注目されているのがグリーンテクノロジーである。再生可能エネルギーの活用や循環型社会の構築により、経済発展と環境保護を同時に実現できる可能性が高まっている。企業も利益追求だけでなく、社会的責任を重視する経営へと転換しつつある。しかし、初期投資コストの高さや技術的課題など、解決すべき問題も多い。",
      questions: [
        {
          question: "この文章の主要な論点として最も適切なものはどれですか。",
          choices: [
            "環境保護が経済発展より重要だと主張している",
            "環境と経済の両立の必要性とその可能性について述べている",
            "グリーンテクノロジーの限界について警告している",
            "企業の社会的責任は不要だと主張している",
          ],
          correct: 1,
          explanation:
            "문장에서는 환경 보호와 경제 성장의 양립이 '불가결'하다고 하면서, 그린 테크놀로지를 통한 해결 가능성을 제시하고 있습니다.",
        },
      ],
    },
  };

  return {
    ...(backupProblems[lengthType] || backupProblems.medium),
    source: "백업 문제",
    generatedAt: new Date().toISOString(),
    isBackup: true,
    lengthInfo: lengthDef,
  };
}

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed",
      message: "POST 요청만 허용됩니다.",
    });
  }

  let requestType = "generate"; // 기본값: 새 문제 생성
  let customPrompt = null;
  let selectedLength = "medium"; // 기본 길이

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // 요청 타입 확인 (generate 또는 custom)
    if (body.type === "custom" && body.prompt) {
      requestType = "custom";
      customPrompt = body.prompt;
    }

    // 길이 타입 확인
    if (body.length && LENGTH_DEFINITIONS[body.length]) {
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

  // API 키 확인
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
    // 사용자 정의 프롬프트에 길이 정보 추가
    const lengthInfo = LENGTH_DEFINITIONS[selectedLength];
    finalPrompt = `${customPrompt}\n\n**글 길이 요구사항**: ${lengthInfo.label} (${lengthInfo.characterRange})\n**문제 수**: ${lengthInfo.questionCount}`;
    promptMeta = {
      type: "custom",
      source: "사용자 정의",
      length: selectedLength,
      lengthInfo: lengthInfo,
    };
  } else {
    // 자동 생성 프롬프트
    try {
      const topic = getRandomTopic();
      const genre = getRandomGenre();
      finalPrompt = createFullPrompt(topic, genre, selectedLength);
      promptMeta = {
        type: "generated",
        topic: topic,
        genre: genre,
        source: "AI 생성",
        length: selectedLength,
        lengthInfo: LENGTH_DEFINITIONS[selectedLength],
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

  // 중복 프롬프트 체크 (생성형만)
  if (requestType === "generate" && usedPrompts.has(finalPrompt.trim())) {
    const backupProblem = generateBackupProblem(selectedLength);
    return res.status(200).json({
      success: false,
      problem: backupProblem,
      message: "중복된 프롬프트로 인해 백업 문제를 사용합니다.",
      isDuplicate: true,
    });
  }

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
        max_tokens: 2500, // 긴 지문 대응을 위해 증가
        temperature: 0.3,
        messages: [{ role: "user", content: finalPrompt }],
      }),
    });

    console.log("API 응답 상태:", response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Claude API 에러 ${response.status}:`, errorData);

      const backupProblem = generateBackupProblem(selectedLength);
      return res.status(200).json({
        success: false,
        problem: backupProblem,
        message: `Claude API 호출 실패 (${response.status}). 백업 문제를 사용합니다.`,
      });
    }

    const data = await response.json();
    let responseText = data.content?.[0]?.text?.trim();

    if (!responseText) {
      throw new Error("Claude API에서 빈 응답을 받았습니다.");
    }

    console.log("Claude 응답 받음:", responseText.substring(0, 100) + "...");

    // JSON 파싱 시도
    let generatedProblem;
    try {
      // JSON 마크다운 제거 및 정리
      responseText = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // JSON 블록 찾기
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedProblem = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("유효한 JSON 형식을 찾을 수 없습니다.");
      }
    } catch (parseError) {
      console.error("JSON 파싱 실패:", parseError, "Response:", responseText);

      const backupProblem = generateBackupProblem(selectedLength);
      return res.status(200).json({
        success: false,
        problem: backupProblem,
        message: "Claude API 응답 파싱 실패. 백업 문제를 사용합니다.",
        rawResponse: responseText,
      });
    }

    // 생성된 문제에 메타데이터 추가
    const problemWithMeta = {
      ...generatedProblem,
      ...promptMeta,
      generatedAt: new Date().toISOString(),
      timestamp: Date.now(),
      promptLength: finalPrompt.length,
    };

    // 성공한 프롬프트 기록 (생성형만)
    if (requestType === "generate") {
      usedPrompts.add(finalPrompt.trim());
    }

    console.log(`독해 문제 생성 성공: ${requestType}, 길이: ${selectedLength}`);

    return res.status(200).json({
      success: true,
      problem: problemWithMeta,
      message: "Claude AI가 새로운 독해 문제를 생성했습니다.",
      metadata: {
        promptType: requestType,
        length: selectedLength,
        generatedAt: problemWithMeta.generatedAt,
        ...(requestType === "generate" && {
          topicCategory: promptMeta.topic?.category,
          genreType: promptMeta.genre?.label,
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
