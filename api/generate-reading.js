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

// ===== 요약 메타 헬퍼 =====
function summarizeGenreForClient(g) {
  if (!g || typeof g !== "object") return null;
  return { type: g.type, label: g.label };
}
function summarizeTopicForClient(t) {
  if (!t || typeof t !== "object") return null;
  return { category: t.category, topic: t.topic };
}

// ===== 자동 번역 관련 함수들 =====
function containsKorean(text) {
  return /[가-힣]/.test(text);
}
function isPrimaryJapanese(text) {
  if (!text || typeof text !== "string") return false;
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const japaneseChars = (
    text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || []
  ).length;
  return japaneseChars > koreanChars || koreanChars === 0;
}

async function translateToKorean(text, apiKey) {
  const translatePrompt = `다음 텍스트를 자연스러운 한국어로 번역해주세요. JLPT 독해 문제의 해설이므로 학습자가 이해하기 쉽게 번역해주세요.\n\n번역할 텍스트: "${text}"\n\n번역 결과만 출력하고 다른 설명은 하지 마세요.`;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 300,
        temperature: 0.1,
        messages: [{ role: "user", content: translatePrompt }],
      }),
    });
    if (!response.ok) throw new Error(`번역 API 실패: ${response.status}`);
    const data = await response.json();
    const translatedText = data.content?.[0]?.text?.trim();
    if (!translatedText) throw new Error("번역 결과가 비어있습니다");
    return translatedText;
  } catch (error) {
    console.error("번역 실패:", error);
    return "지문의 내용을 정확히 파악하면 정답을 찾을 수 있습니다.";
  }
}

async function autoTranslateExplanations(problem, apiKey) {
  let hasTranslated = false;
  const translationResults = [];
  try {
    if (problem.explanation && isPrimaryJapanese(problem.explanation)) {
      const original = problem.explanation;
      problem.explanation = await translateToKorean(
        problem.explanation,
        apiKey
      );
      hasTranslated = true;
      translationResults.push(
        `단일 해설: "${original}" → "${problem.explanation}"`
      );
    }
    if (problem.questions && Array.isArray(problem.questions)) {
      for (let i = 0; i < problem.questions.length; i++) {
        const q = problem.questions[i];
        if (q.explanation && isPrimaryJapanese(q.explanation)) {
          const original = q.explanation;
          q.explanation = await translateToKorean(q.explanation, apiKey);
          hasTranslated = true;
          translationResults.push(
            `문제 ${i + 1} 해설: "${original}" → "${q.explanation}"`
          );
        }
      }
    }
    if (hasTranslated) {
      problem.autoTranslated = true;
      problem.translatedAt = new Date().toISOString();
      problem.translationLog = translationResults;
    }
  } catch (e) {
    console.error("자동 번역 중 오류:", e);
  }
  return problem;
}

async function processGeneratedProblem(generatedProblem, apiKey, promptMeta) {
  const problemWithMeta = {
    ...generatedProblem,
    ...promptMeta, // 여기의 topic/genre는 이미 요약본
    generatedAt: new Date().toISOString(),
    timestamp: Date.now(),
  };
  const finalProblem = await autoTranslateExplanations(problemWithMeta, apiKey);
  return finalProblem;
}

// ===== 데이터 로더 =====
function loadTopicsData() {
  try {
    const topicsPath = path.join(process.cwd(), "data/topics.json");
    const content = fs.readFileSync(topicsPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("topics.json 로드 실패:", error);
    return null;
  }
}
function loadGenresData() {
  try {
    const genresPath = path.join(process.cwd(), "data/genre.json");
    const content = fs.readFileSync(genresPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("genre.json 로드 실패:", error);
    return null;
  }
}

// ===== 랜덤 선택기 =====
function getRandomTopic() {
  const topicsData = loadTopicsData();
  if (!topicsData || !topicsData.topics)
    throw new Error("topics.json 데이터를 불러올 수 없습니다.");
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
function getRandomGenre() {
  const genresData = loadGenresData();
  if (!genresData || !Array.isArray(genresData))
    throw new Error("genre.json 데이터를 불러올 수 없습니다.");
  const actualGenres = genresData.filter((g) => g.type !== "n1_trap_elements");
  return actualGenres[Math.floor(Math.random() * actualGenres.length)];
}
function getN1TrapElements() {
  const genresData = loadGenresData();
  if (!genresData || !Array.isArray(genresData)) return null;
  return genresData.find((item) => item.type === "n1_trap_elements");
}

// ===== 길이별 출력 스펙 =====
function generateLengthSpecificStructure(lengthType) {
  const lengthDef = LENGTH_DEFINITIONS[lengthType];
  switch (lengthType) {
    case "short":
      return {
        outputFormat: `{
  "type": "reading",
  "length": "short",
  "passage": "<${lengthDef.characterRange} 일본어 지문>",
  "question": "<지문의 핵심 내용에 대한 일본어 질문>",
  "choices": ["일본어 선택지1", "일본어 선택지2", "일본어 선택지3", "일본어 선택지4"],
  "correct": 0,
  "explanation": "<정답 해설 - 한국어로만>"
}`,
        instructions: `• 본문: 정확히 ${lengthDef.characterRange}의 일본어로 구성\n• 핵심 아이디어나 주장이 명확히 드러나도록 작성\n• 1개의 질문으로 지문의 핵심을 파악하는 문제 구성\n• 질문과 선택지는 일본어, 해설만 한국어로 작성`,
      };
    case "medium":
      return {
        outputFormat: `{
  "type": "reading",
  "length": "medium",
  "passage": "<${lengthDef.characterRange} 일본어 지문>",
  "questions": [
    {"question": "<첫 번째 일본어 질문>", "choices": ["일본어 선택지1", "일본어 선택지2", "일본어 선택지3", "일본어 선택지4"], "correct": 0, "explanation": "<한국어 해설>"},
    {"question": "<두 번째 일본어 질문 (선택사항)>", "choices": ["일본어 선택지1", "일본어 선택지2", "일본어 선택지3", "일본어 선택지4"], "correct": 1, "explanation": "<한국어 해설>"}
  ]
}`,
        instructions: `• 본문: 정확히 ${lengthDef.characterRange}의 일본어로 구성\n• 논리적 구조가 명확한 논설문이나 설명문 형태\n• 1~2개의 질문으로 구성 (필자의 주장, 근거, 결론 등)\n• 질문과 선택지는 일본어, 해설만 한국어로 작성`,
      };
    case "long":
      return {
        outputFormat: `{
  "type": "reading",
  "length": "long",
  "passage": "<${lengthDef.characterRange} 일본어 지문>",
  "questions": [
    {"question": "<전체 내용 파악 일본어 질문>", "choices": ["일본어 선택지1", "일본어 선택지2", "일본어 선택지3", "일본어 선택지4"], "correct": 0, "explanation": "<한국어 해설>"},
    {"question": "<세부 내용 이해 일본어 질문>", "choices": ["일본어 선택지1", "일본어 선택지2", "일본어 선택지3", "일본어 선택지4"], "correct": 1, "explanation": "<한국어 해설>"},
    {"question": "<필자의 의도나 주장 파악 일본어 질문>", "choices": ["일본어 선택지1", "일본어 선택지2", "일본어 선택지3", "일본어 선택지4"], "correct": 2, "explanation": "<한국어 해설>"}
  ]
}`,
        instructions: `• 본문: 정확히 ${lengthDef.characterRange}의 일본어로 구성\n• 복잡한 논리 구조와 다층적 의미를 가진 글\n• 3~5개의 질문으로 다각적 이해도 평가 (주제, 세부사항, 추론, 비판적 사고)\n• 질문과 선택지는 일본어, 해설만 한국어로 작성`,
      };
    case "comparative":
      return {
        outputFormat: `{
  "type": "reading",
  "length": "comparative",
  "passage1": "<${lengthDef.characterRange} 일본어 지문 1>",
  "passage2": "<${lengthDef.characterRange} 일본어 지문 2>",
  "questions": [
    {"question": "<두 지문의 공통점/차이점 일본어 질문>", "choices": ["일본어 선택지1", "일본어 선택지2", "일본어 선택지3", "일본어 선택지4"], "correct": 0, "explanation": "<한국어 해설>"}
  ]
}`,
        instructions: `• 두 지문을 비교 분석하여 통합 이해를 평가\n• 공통 주제/논점 파악 및 비판적 비교\n• 질문과 선택지는 일본어, 해설만 한국어로 작성`,
      };
    case "practical":
      return {
        outputFormat: `{
  "type": "reading",
  "length": "practical",
  "passage": "<${lengthDef.characterRange} 실용문 지문>",
  "questions": [
    {"question": "<구체적 정보 검색 일본어 질문>", "choices": ["일본어 선택지1", "일본어 선택지2", "일본어 선택지3", "일본어 선택지4"], "correct": 0, "explanation": "<한국어 해설>"},
    {"question": "<조건에 맞는 정보 찾기 일본어 질문>", "choices": ["일본어 선택지1", "일본어 선택지2", "일본어 선택지3", "일본어 선택지4"], "correct": 1, "explanation": "<한국어 해설>"}
  ]
}`,
        instructions: `• 본문: 정확히 ${lengthDef.characterRange}의 실용문 (안내문, 광고, 규칙 등)\n• 실제 생활에서 마주할 수 있는 문서 형태로 구성\n• 필요한 정보를 빠르고 정확하게 찾는 능력 평가\n• 질문과 선택지는 일본어, 해설만 한국어로 작성`,
      };
    default:
      return generateLengthSpecificStructure("medium");
  }
}

function createFullPrompt(topic, genre, lengthType = "medium") {
  const trapElements = getN1TrapElements();
  const lengthDef = LENGTH_DEFINITIONS[lengthType];
  const lengthStructure = generateLengthSpecificStructure(lengthType);

  const characteristicsText = genre.characteristics
    ? genre.characteristics.map((c) => `• ${c}`).join("\n")
    : "";
  const questionTypesText = genre.question_types
    ? Object.entries(genre.question_types)
        .map(([k, v]) => `• ${k}: ${v}`)
        .join("\n")
    : "";
  const textStructureText = genre.text_structure
    ? `\n**기본 구조**: ${
        genre.text_structure.basic_flow
      }\n\n**구조 변형 패턴**:\n${
        genre.text_structure.variation_patterns
          ? genre.text_structure.variation_patterns
              .map((p) => `• ${p}`)
              .join("\n")
          : ""
      }`
    : "";

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
    const used = new Set();
    for (let i = 0; i < numTraps; i++) {
      let idx;
      do {
        idx = Math.floor(Math.random() * allTraps.length);
      } while (used.has(idx));
      used.add(idx);
      selectedTraps.push(allTraps[idx]);
    }
    trapElementsText = `\n**고난이도 N1 함정 요소** (다음 ${numTraps}개 요소 포함):\n${selectedTraps
      .map((t) => `• ${t}`)
      .join("\n")}`;
    trapInstructions = `\n• 위에 제시된 함정 요소를 자연스럽게 포함\n• 함정 요소로 인해 오답을 선택하기 쉽도록 구성\n• 정답은 명확하지만 함정에 빠지기 쉬운 선택지 배치`;
  } else {
    trapInstructions = `\n• 기본 수준의 N1 독해 문제로 구성\n• 명확한 논리 구조와 이해하기 쉬운 전개\n• 적절한 난이도의 선택지 구성`;
  }

  return `JLPT N1 수준의 ${
    genre.label
  } 독해 문제를 아래 조건에 맞추어 JSON 형식으로 생성해주세요.

**📝 언어 사용 규칙 (매우 중요):**
- passage/passage1/passage2: 일본어로만 작성
- question, choices: 일본어로 작성 (실제 JLPT와 동일)
- explanation만: 반드시 한국어로만 작성

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
• **explanation만 한국어로 작성, 문제와 선택지는 일본어 유지**

**출력 형식** (JSON만, 다른 설명 금지):
${lengthStructure.outputFormat}

❗ 반드시 올바른 JSON 형식으로만 응답하고, explanation만 한국어로 작성하세요.`;
}

// ===== 백업 문제 =====
function generateBackupProblem(lengthType = "medium") {
  const lengthDef = LENGTH_DEFINITIONS[lengthType];
  const backupProblems = {
    medium: {
      type: "reading",
      length: "medium",
      topic: "환경 보호와 경제 발전",
      passage:
        "持続可能な発展を実現するためには、環境保護と経済成長の両立が不可欠である。従来の大量生産・大量消費モデルでは、資源の枯渇や環境破壊が深刻化している。そこで注目されているのがグリーンテクノロジーである。再生可能エネルギーの活用や循環型社会の構築により、経済発展と環境保護を同時に実現できる可能性が高まっている。企業も利益追求だけでなく、社会的責任を重視する経営へと転換しつつある。しかし、初期投資コストの高さや技術的課題など、解決すべき問題も多い。",
      questions: [
        {
          question: "この文章の主要な論点として最も適切なものはどれか。",
          choices: [
            "環境保護が経済発展より重要だと主張している",
            "環境と経済の両立の必要性とその可能性について述べている",
            "グリーンテクノロジーの限界について警告している",
            "企業の社会的責任は不要だと主張している",
          ],
          correct: 1,
          explanation:
            "지문에서는 환경 보호와 경제 성장의 양립이 '불가결'하다고 하면서, 그린 테크놀로지를 통한 해결 가능성을 제시하고 있습니다.",
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

// ===== 메인 핸들러 =====
export default async function handler(req, res) {
  // CORS
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

  let requestType = "generate";
  let customPrompt = null;
  let selectedLength = "medium";

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (body.type === "custom" && body.prompt) {
      requestType = "custom";
      customPrompt = body.prompt;
    }
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
    const lengthInfo = LENGTH_DEFINITIONS[selectedLength];
    finalPrompt = `${customPrompt}\n\n**글 길이 요구사항**: ${lengthInfo.label} (${lengthInfo.characterRange})\n**문제 수**: ${lengthInfo.questionCount}\n**중요: 해설(explanation)만 한국어로 작성하고, 문제와 선택지는 일본어로 작성해주세요.**`;
    promptMeta = {
      type: "custom",
      source: "사용자 정의",
      length: selectedLength,
      lengthInfo,
    };
  } else {
    try {
      const topic = getRandomTopic();
      const genreDetail = getRandomGenre(); // 프롬프트용
      finalPrompt = createFullPrompt(topic, genreDetail, selectedLength);
      promptMeta = {
        type: "generated",
        topic: summarizeTopicForClient(topic), // ✅ 클라이언트 노출용 요약만 유지
        genre: summarizeGenreForClient(genreDetail), // ✅ 클라이언트 노출용 요약만 유지
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

  // 중복 프롬프트 방지
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
    if (!response.ok) {
      const backupProblem = generateBackupProblem(selectedLength);
      return res.status(200).json({
        success: false,
        problem: backupProblem,
        message: `Claude API 호출 실패 (${response.status}). 백업 문제를 사용합니다.`,
      });
    }

    const data = await response.json();
    let responseText = data.content?.[0]?.text?.trim();
    if (!responseText) throw new Error("Claude API에서 빈 응답을 받았습니다.");

    // JSON 파싱 (```json 래퍼 제거)
    let generatedProblem;
    try {
      responseText = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("유효한 JSON 형식을 찾을 수 없습니다.");
      generatedProblem = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      const backupProblem = generateBackupProblem(selectedLength);
      return res.status(200).json({
        success: false,
        problem: backupProblem,
        message: "Claude API 응답 파싱 실패. 백업 문제를 사용합니다.",
        rawResponse: responseText,
      });
    }

    // 후처리 + 번역
    const finalProblem = await processGeneratedProblem(
      generatedProblem,
      apiKey,
      promptMeta
    );

    if (requestType === "generate") usedPrompts.add(finalPrompt.trim());

    return res.status(200).json({
      success: true,
      problem: finalProblem,
      message: finalProblem.autoTranslated
        ? "Claude AI가 새로운 독해 문제를 생성하고 해설을 한국어로 번역했습니다."
        : "Claude AI가 새로운 독해 문제를 생성했습니다.",
      metadata: {
        promptType: requestType,
        length: selectedLength,
        generatedAt: finalProblem.generatedAt,
        autoTranslated: finalProblem.autoTranslated || false,
        translationCount: finalProblem.translationLog?.length || 0,
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
