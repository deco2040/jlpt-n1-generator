// api/generate-reading-enhanced.js (최종 개선본)
// JLPT N1 독해 문제 생성 (모든 JSON 파일 활용 + 메타데이터 출력)

// ========================================
// 🛠️ Node.js 모듈 추가 및 파일 로드 헬퍼 함수
// ========================================
const fs = require("fs/promises");
const path = require("path");

/**
 * 프로젝트 루트 경로 기준으로 JSON 파일을 로드하는 헬퍼 함수
 * @param {string} fileName - 로드할 JSON 파일 이름 (예: "topics.json")
 * @returns {Promise<Object>} JSON 파일 내용
 */
async function loadJson(fileName) {
  // __dirname: 현재 파일(api/generate-reading.js)이 있는 디렉토리 (/project-root/api)
  // '..': 상위 디렉토리로 이동 (/project-root)
  // 'data': data 폴더로 이동 (/project-root/data)
  const filePath = path.join(__dirname, "..", "data", fileName);

  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ JSON 파일 로드 실패: ${filePath}`, error);
    throw new Error(`데이터 파일 로드 실패: ${fileName} - ${error.message}`);
  }
}

// ========================================
// 환경 변수 체크 (개발/프로덕션 모드)
// ========================================
const isDevelopment =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";
const debugLog = isDevelopment ? console.log : () => {};
const debugWarn = isDevelopment ? console.warn : () => {};

/**
 * JLPT N1 독해 문제 생성 메인 함수
 * @returns {Promise<Object>} 생성된 문제와 메타데이터
 */
async function generateReadingProblem() {
  // 문제 생성 시작 시간 기록
  const startTime = Date.now();

  // 메타데이터 객체 초기화
  const metadata = {
    generatedAt: new Date().toISOString(),
    generationTimeMs: 0,
    parameters: {},
    source: "ai", // 'ai' 또는 'fallback'
    version: "2.0.0",
    warnings: [],
  };

  try {
    debugLog("=== JLPT N1 독해 문제 생성 시작 ===");

    // ========================================
    // 1. topics.json에서 주제 랜덤 선택 (fetch -> loadJson으로 변경)
    // ========================================
    debugLog("\n[1단계] 주제 선택 중...");

    // ❌ 기존 코드: fetch("data/topics.json")
    const topicsData = await loadJson("topics.json");

    const topicCategories = Object.keys(topicsData.topics);
    const randomTopicCategory =
      topicCategories[Math.floor(Math.random() * topicCategories.length)];
    const randomTopic =
      topicsData.topics[randomTopicCategory][
        Math.floor(
          Math.random() * topicsData.topics[randomTopicCategory].length
        )
      ];

    metadata.parameters.topic = randomTopic;
    debugLog(`  -> 선택된 주제: ${randomTopic.topic} (${randomTopicCategory})`);

    // ========================================
    // 2. genre.json에서 장르 랜덤 선택 (fetch -> loadJson으로 변경)
    // ========================================
    debugLog("\n[2단계] 장르 선택 중...");

    // ❌ 기존 코드: fetch("data/genre.json")
    const genreData = await loadJson("genre.json");

    const randomGenre =
      genreData.genres[Math.floor(Math.random() * genreData.genres.length)];

    metadata.parameters.genre = randomGenre;
    debugLog(`  -> 선택된 장르: ${randomGenre.label}`);

    // ========================================
    // 3. length-definitions.json에서 길이 랜덤 선택 (fetch -> loadJson으로 변경)
    // ========================================
    debugLog("\n[3단계] 길이 선택 중...");

    // ❌ 기존 코드: fetch("data/length-definitions.json")
    const lengthData = await loadJson("length-definitions.json");

    const randomLength =
      lengthData.lengths[Math.floor(Math.random() * lengthData.lengths.length)];

    metadata.parameters.length = randomLength;
    debugLog(
      `  -> 선택된 길이: ${randomLength.label} (${randomLength.tokens})`
    );

    // ========================================
    // 4. speakers.json에서 화자 랜덤 선택 (fetch -> loadJson으로 변경)
    // ========================================
    debugLog("\n[4단계] 화자 선택 중...");

    // ❌ 기존 코드: fetch("data/speakers.json")
    const speakerData = await loadJson("speakers.json");

    const randomSpeaker =
      speakerData.speakers[
        Math.floor(Math.random() * speakerData.speakers.length)
      ];

    metadata.parameters.speaker = randomSpeaker;
    debugLog(`  -> 선택된 화자: ${randomSpeaker.label}`);

    // ========================================
    // 5. 프롬프트 생성 및 AI 호출 (이 부분은 유지)
    // ========================================
    debugLog("\n[5단계] 프롬프트 생성 및 AI 호출 중...");

    const systemPrompt = `
      あなたは日本語能力試験(JLPT) N1レベルの専門家であり、高度な読解問題を作成するAIです。
      以下のパラメータに基づいて、一つの読解問題（長文とそれに関する設問、選択肢、正解、解説）を生成してください。

      **必須要件:**
      1.  出力은 반드시 유효한 단일 JSON 객체여야 하며, 다른 설명이나 마크다운 마커(예: \`\`\`json)는 포함하지 마세요.
      2.  문제의 난이도는 JLPT N1 수준에 정확히 맞추어야 합니다.
      3.  설문(question)은 항상 "この文章の主張として最も適切なものはどれか。" 또는 "本文の内容と合致するものはどれか。"와 같은 형태로, 전체 내용을 묻는 질문이어야 합니다.
      4.  선택지(options)는 4개여야 하며, 그 중 하나만 정답(correctAnswer)이어야 합니다.
      5.  지문(passage)은 다음 토큰 수에 맞춰야 합니다: ${randomLength.description} (${randomLength.tokens} 토큰 근처).

      **생성 파라미터:**
      - **주제 (Topic):** ${randomTopic.topic}
      - **장르 (Genre):** ${randomGenre.label} (${randomGenre.description})
      - **글의 길이 (Length):** ${randomLength.label} (${randomLength.tokens} トークン)
      - **화자/스타일 (Speaker/Style):** ${randomSpeaker.label} (${randomSpeaker.description})

      **JSON 출력 형식:**
      {
        "passage": "지문 텍스트",
        "question": "질문 텍스트",
        "options": ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
        "correctAnswer": 0, // 0부터 3까지의 인덱스. 정답이 '선택지 1'이면 0, '선택지 4'이면 3
        "explanation": "문제에 대한 상세한 해설 텍스트",
        "grammarPoints": ["주요 문법 1", "주요 문법 2", "..."]
      }
    `;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.");
    }

    const apiUrl = "https://api.anthropic.com/v1/messages";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620", // N1 수준에 적합한 모델
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: "上記パラメータに基づき、読解問題を一つ生成してください。",
          },
        ],
        temperature: 0.7, // 창의성을 위해 약간 높임
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API 요청 실패: ${response.status} ${
          response.statusText
        }. 응답: ${errorText.substring(0, 100)}`
      );
    }

    const data = await response.json();

    // 응답 내용 추출 및 파싱
    let responseText = data.content?.[0]?.text?.trim() || "";

    // JSON 마크다운 제거
    responseText = responseText
      .replace(/^```json\s*/, "")
      .replace(/\s*```$/, "");

    let problemData;
    try {
      problemData = JSON.parse(responseText);
    } catch (parseError) {
      debugWarn("⚠️ AI 응답 JSON 파싱 실패:", responseText);
      metadata.warnings.push(
        "AI가 유효하지 않은 JSON을 반환했습니다. 재시도가 필요할 수 있습니다."
      );
      // 파싱 실패 시, 원시 텍스트를 포함하여 오류를 발생시킴
      throw new Error(
        `JSON 파싱 실패. 원시 응답: ${responseText.substring(0, 500)}`
      );
    }

    // ========================================
    // 6. 품질 검증 및 최종 반환
    // ========================================
    debugLog("\n[6단계] 품질 검증 중...");
    const validationResult = validateProblem(problemData, metadata);
    metadata.validation = validationResult;

    if (!validationResult.isValid) {
      // 문제 내용에 심각한 오류가 있을 경우 (예: 정답 인덱스가 범위를 벗어남)
      // 이 부분을 서버 로그에만 남기고 클라이언트에는 백업으로 대응할지,
      // 아니면 에러를 발생시켜 클라이언트가 500 에러를 받게 할지 결정해야 합니다.
      // 여기서는 일단 경고를 남기고 진행합니다.
      // 더 엄격하게 하려면 throw new Error("문제 품질 검증 실패")를 사용할 수 있습니다.
      debugWarn("⚠️ 품질 검증 경고:", validationResult.warnings);
    }

    // 문제 생성 완료 시간 및 메타데이터 기록
    metadata.generationTimeMs = Date.now() - startTime;
    printMetadata(metadata);

    return { problem: problemData, metadata };
  } catch (error) {
    // catch 블록에서 문제 생성 오류 로깅
    console.error("❌ 독해 문제 생성 중 오류:", error.message);

    // 오류 정보를 메타데이터에 기록
    metadata.error = { message: error.message, stack: error.stack };
    metadata.generationTimeMs = Date.now() - startTime;
    metadata.source = "error";

    // 클라이언트에게 500 에러를 반환해야 하므로, 여기서 에러를 다시 던집니다.
    // 서버 프레임워크가 이 에러를 잡아서 500 응답으로 변환합니다.
    throw error;
  }
}

// ... (validateProblem, printMetadata 함수는 변경 없이 유지)

/**
 * 생성된 문제 객체의 유효성을 검사합니다.
 * (이 함수는 파일 로드와 관련 없으므로 내용은 유지합니다.)
 */
function validateProblem(problem, metadata) {
  // ... (기존 validateProblem 로직 유지)

  // ... (기존 validateProblem 로직 유지)
  const warnings = [];

  if (
    !problem.passage ||
    typeof problem.passage !== "string" ||
    problem.passage.length < 50
  ) {
    warnings.push("지문(passage)이 너무 짧거나 누락되었습니다.");
  }
  if (
    !problem.question ||
    typeof problem.question !== "string" ||
    problem.question.length < 10
  ) {
    warnings.push("질문(question)이 너무 짧거나 누락되었습니다.");
  }
  if (!Array.isArray(problem.options) || problem.options.length !== 4) {
    warnings.push(
      `선택지(options)의 개수가 4개가 아닙니다. (현재: ${problem.options?.length})`
    );
  }
  if (
    typeof problem.correctAnswer !== "number" ||
    problem.correctAnswer < 0 ||
    problem.correctAnswer >= 4
  ) {
    warnings.push(
      `정답 인덱스(correctAnswer)가 유효한 범위(0-3)를 벗어났습니다. (현재: ${problem.correctAnswer})`
    );
  }
  if (
    !problem.explanation ||
    typeof problem.explanation !== "string" ||
    problem.explanation.length < 10
  ) {
    warnings.push("해설(explanation)이 너무 짧거나 누락되었습니다.");
  }
  if (!Array.isArray(problem.grammarPoints)) {
    warnings.push("문법 포인트(grammarPoints)가 배열 형식이 아닙니다.");
  }

  return {
    isValid: warnings.length === 0,
    warnings: warnings,
  };
}

/**
 * 메타데이터를 콘솔에 출력합니다.
 * (이 함수는 파일 로드와 관련 없으므로 내용은 유지합니다.)
 */
function printMetadata(metadata) {
  // ... (기존 printMetadata 로직 유지)
  console.log("\n" + "=".repeat(80));
  console.log("✅ 문제 생성 완료 메타데이터 (서버 로그용)");
  console.log(
    `  - 생성 시간: ${new Date(metadata.generatedAt).toLocaleString()}`
  );
  console.log(`  - 소요 시간: ${metadata.generationTimeMs}ms`);
  console.log(`  - 출처: ${metadata.source}`);
  console.log(`  - 버전: ${metadata.version}`);

  console.log("\n📘 요청 파라미터:");
  if (metadata.parameters.topic) {
    console.log(`  - 주제: ${metadata.parameters.topic.topic}`);
  }
  if (metadata.parameters.genre) {
    console.log(`  - 장르: ${metadata.parameters.genre.label}`);
  }
  if (metadata.parameters.length) {
    console.log(
      `  - 길이: ${metadata.parameters.length.label} (${metadata.parameters.length.tokens} 토큰)`
    );
  }
  if (metadata.parameters.speaker) {
    console.log(`  - 화자: ${metadata.parameters.speaker.label}`);
  }

  if (metadata.validation) {
    console.log("\n✅ 품질 검증:");
    console.log(
      `  - 검증 결과: ${metadata.validation.isValid ? "통과" : "경고 있음"}`
    );
    if (metadata.validation.warnings.length > 0) {
      console.log(`  - 경고사항:`);
      metadata.validation.warnings.forEach((warning) => {
        console.log(`    ⚠️ ${warning}`);
      });
    }
  }

  if (metadata.warnings && metadata.warnings.length > 0) {
    console.log("\n⚠️ 기타 경고:");
    metadata.warnings.forEach((warning) => {
      console.log(`  - ${warning}`);
    });
  }

  if (metadata.error) {
    console.log("\n❌ 오류 정보:");
    console.log(`  - 메시지: ${metadata.error.message}`);
    if (metadata.error.stack) {
      console.log(
        `  - 스택 트레이스: ${metadata.error.stack.substring(0, 300)}...`
      );
    }
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

// ========================================
// Export 및 전역 사용 설정
// ========================================

// 브라우저 환경에서 전역으로 사용 가능하도록 설정 (이 부분은 이제 사용되지 않음)
if (typeof window !== "undefined") {
  window.generateReadingProblem = generateReadingProblem;
  window.printMetadata = printMetadata;
}

// Node.js 환경을 위한 export (서버에서 이 함수를 불러서 API 엔드포인트를 만듭니다)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateReadingProblem,
    printMetadata,
    validateProblem,
  };
}
