// api/generate-reading.js
import fs from "fs";
import path from "path";

const usedPrompts = new Set();

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

// 완전한 프롬프트 생성
function createFullPrompt(topic, genre) {
  const trapElements = getN1TrapElements();

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
• 본문: 정확히 120~180자의 일본어
• N1 수준의 고급 어휘와 문법 구조 사용
• 논리적 구조와 일관성 유지${trapInstructions}

**출력 형식** (JSON만, 다른 설명 금지):
{
  "type": "reading",
  "topic": "${topic.topic}",
  "genre": "${genre.type}",
  "difficulty": "${trapDifficulty}",
  "passage": "<120~180자 일본어 지문>",
  "question": "<지문 내용에 대한 고차원적 이해 질문>",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct": 0,
  "explanation": "<정답 해설 - 한국어>"
}

반드시 올바른 JSON 형식으로만 응답하세요. 코드블록이나 추가 설명은 절대 포함하지 마세요.`;
}

// 백업 문제 생성
function generateBackupProblem() {
  const backupTopics = [
    {
      topic: "현대 사회에서 기술 혁신의 속도는 가속도적으로 증가하고 있다",
      passage:
        "現代社会において、技術革新の速度は加速度的に増している。特にAI技術の発達により、従来人間が行っていた業務の多くが自動化されつつある。この変化は効率性の向上をもたらす一方で、雇用への影響という新たな課題を生み出している。今後は技術の恩恵を享受しながらも、人間らしい価値を見失わない社会の構築が求められる。",
      question:
        "この文章で述べられているAI技術に関する考察として最も適切なものはどれですか。",
      choices: [
        "AI技術の発展には利点と課題の両面があることを示している",
        "AI技術は完全に否定的な影響しか与えないと主張している",
        "AI技術の発展速度が遅いことを批判している",
        "AI技術は労働市場にのみ影響を与えると述べている",
      ],
      correct: 0,
      explanation:
        "문장에서는 AI 기술의 '효율성 향상'이라는 이점과, '고용에 대한 영향'이라는 과제의 양면에 대해 언급하고 있습니다.",
    },
    {
      topic: "환경 보호와 경제 발전의 균형",
      passage:
        "持続可能な発展を実現するためには、環境保護と経済成長の両立が不可欠である。しかし、これは非常に困難な課題であり、多くの国がこの問題に直面している。近年、グリーンテクノロジーの発達により、解決の糸口が見え始めた。企業も利益追求だけでなく、社会的責任を重視する経営へと転換しつつある。",
      question: "この文章の主要な論点として最も適切なものはどれですか。",
      choices: [
        "環境保護が経済発展より重要だと主張している",
        "環境と経済の両立の困難さとその解決可能性について述べている",
        "グリーンテクノロジーの限界について警告している",
        "企業の社会的責任は不要だと主張している",
      ],
      correct: 1,
      explanation:
        "문장에서는 환경 보호와 경제 성장의 양립이 '어려운 과제'라고 하면서도, 그린 테크놀로지의 발달로 '해결의 실마리가 보이기 시작했다'고 긍정적 가능성을 제시하고 있습니다.",
    },
  ];

  const randomBackup =
    backupTopics[Math.floor(Math.random() * backupTopics.length)];

  return {
    type: "reading",
    topic: randomBackup.topic,
    passage: randomBackup.passage,
    question: randomBackup.question,
    choices: randomBackup.choices,
    correct: randomBackup.correct,
    explanation: randomBackup.explanation,
    source: "백업 문제",
    generatedAt: new Date().toISOString(),
    isBackup: true,
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

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // 요청 타입 확인 (generate 또는 custom)
    if (body.type === "custom" && body.prompt) {
      requestType = "custom";
      customPrompt = body.prompt;
    }

    console.log(
      `[${new Date().toISOString()}] 독해 문제 생성 요청: ${requestType}`
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
    const backupProblem = generateBackupProblem();
    return res.status(200).json({
      success: false,
      problem: backupProblem,
      message: "API 키가 설정되지 않아 백업 문제를 사용합니다.",
    });
  }

  let finalPrompt;
  let promptMeta = {};

  if (requestType === "custom") {
    // 사용자 정의 프롬프트 사용
    finalPrompt = customPrompt;
    promptMeta = {
      type: "custom",
      source: "사용자 정의",
    };
  } else {
    // 자동 생성 프롬프트
    try {
      const topic = getRandomTopic();
      const genre = getRandomGenre();
      finalPrompt = createFullPrompt(topic, genre);
      promptMeta = {
        type: "generated",
        topic: topic,
        genre: genre,
        source: "AI 생성",
      };
    } catch (error) {
      console.error("JSON 데이터 로드 실패:", error);
      const backupProblem = generateBackupProblem();
      return res.status(200).json({
        success: false,
        problem: backupProblem,
        message: `데이터 파일 로드 실패: ${error.message}. 백업 문제를 사용합니다.`,
      });
    }
  }

  // 중복 프롬프트 체크 (생성형만)
  if (requestType === "generate" && usedPrompts.has(finalPrompt.trim())) {
    const backupProblem = generateBackupProblem();
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
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{ role: "user", content: finalPrompt }],
      }),
    });

    console.log("API 응답 상태:", response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Claude API 에러 ${response.status}:`, errorData);

      const backupProblem = generateBackupProblem();
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

      const backupProblem = generateBackupProblem();
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

    console.log(`독해 문제 생성 성공: ${requestType}`);

    return res.status(200).json({
      success: true,
      problem: problemWithMeta,
      message: "Claude AI가 새로운 독해 문제를 생성했습니다.",
      metadata: {
        promptType: requestType,
        generatedAt: problemWithMeta.generatedAt,
        ...(requestType === "generate" && {
          topicCategory: promptMeta.topic?.category,
          genreType: promptMeta.genre?.label,
        }),
      },
    });
  } catch (error) {
    console.error("Claude API 호출 중 에러:", error);

    const backupProblem = generateBackupProblem();
    return res.status(200).json({
      success: false,
      problem: backupProblem,
      message: `문제 생성 실패: ${error.message}. 백업 문제를 사용합니다.`,
      error: error.message,
    });
  }
}
