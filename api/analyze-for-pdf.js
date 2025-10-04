// api/analyze-for-pdf.js
export default async function handler(req, res) {
  // CORS 설정
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
    });
  }

  try {
    const { problem, metadata } = req.body;

    if (!problem) {
      return res.status(400).json({
        success: false,
        error: "Problem data is required",
      });
    }

    // 본문 추출
    const passage = extractPassage(problem);

    // Claude API 호출
    const analysis = await analyzeWithClaude(passage, problem, metadata);

    return res.status(200).json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("PDF분석 에러:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Analysis failed",
    });
  }
}

// 본문 추출
function extractPassage(problem) {
  if (problem.passage) {
    return problem.passage;
  }

  if (problem.passages?.A && problem.passages?.B) {
    return `【本文A】\n${problem.passages.A}\n\n【本文B】\n${problem.passages.B}`;
  }

  if (Array.isArray(problem.passages)) {
    return problem.passages
      .map((p, i) => `【文書${i + 1}】\n${p}`)
      .join("\n\n");
  }

  return "";
}

// Claude API로 분석
async function analyzeWithClaude(passage, problem, metadata) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const prompt = buildAnalysisPrompt(passage, problem, metadata);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.2,
      system:
        "You are a JLPT N1 teacher. You MUST write all explanations in Korean language. Never use Japanese for explanations. 모든 해설은 반드시 한국어로 작성해야 하며, 요청된 JSON 스키마를 완벽하게 준수하여 **오직 JSON 형식만** 출력해야 합니다. JSON이 중간에 잘리거나 미완성되면 안 됩니다.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let responseText = data.content[0].text.trim();

  // JSON 추출 및 전처리 로직
  let jsonString = responseText;

  // 1. Markdown 코드 블록 태그 및 주변 공백/줄바꿈을 확실하게 제거
  jsonString = jsonString
    .replace(/^\s*```json\s*|^\s*```\s*|\s*```\s*$/g, "")
    .trim();

  // 2. JSON 객체만 추출 (앞뒤에 붙은 설명 텍스트 제거)
  const startIndex = jsonString.indexOf("{");
  const endIndex = jsonString.lastIndexOf("}");

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    jsonString = jsonString.substring(startIndex, endIndex + 1);
  } else {
    console.warn("JSON 객체 시작/종료점 추출 실패. 원본 텍스트 사용.");
  }

  try {
    const parsed = JSON.parse(jsonString);

    // 한국어 검증: explanation에 일본어가 있으면 경고
    if (parsed.questionExplanations) {
      parsed.questionExplanations.forEach((qe, idx) => {
        if (
          qe.explanation &&
          /[\u3040-\u309F\u30A0-\u30FF]/.test(qe.explanation)
        ) {
          console.warn(
            `문제 ${idx + 1}의 해설에 일본어가 포함되어 있습니다:`,
            qe.explanation
          );
        }
      });
    }

    return parsed;
  } catch (e) {
    console.error("JSON파싱 실패:", jsonString);
    throw new Error("Failed to parse Claude response as JSON");
  }
}

// 프롬프트 생성 (핵심 포인트 요소 삭제 적용)
function buildAnalysisPrompt(passage, problem, metadata) {
  // 문제 형식 포맷팅
  const formattedQuestions = problem.questions
    .map(
      (q, i) => `
問題${i + 1}: ${q.question}
選択肢:
${q.options.map((opt, j) => `${j + 1}. ${opt}`).join("\n")}
正解: ${q.correctAnswer + 1}番
`
    )
    .join("\n");

  return `あなたはJLPT N1の日本語教師です。以下の読解問題を分析し、韓国人学習者のために**必須で韓国語による詳細な解説**を提供してください。

**【厳守事項】すべての解説は韓国語で書いてください。日本語での解説は厳禁です。**

**【本文】**
${passage}

**【問題】**
${formattedQuestions}

**【メタ데이터】**
カテゴリー: ${metadata.category || ""} / テーマ: ${
    metadata.topic || ""
  } / ジャンル: ${metadata.genre || ""}

**【출력 형식】**
**다른 설명이나 텍스트는 절대 포함하지 않고, 다음 JSON 형식만을 완벽하게 준수하여 출력해야 합니다.**

{
  "translation": "본문 전체의 자연스럽고 정확한 한국어 번역 (존댓말 사용)",
  "questionExplanations": [
    {
      "questionNumber": 1,
      "correctAnswer": 1,
      "explanation": "정답 해설 (반드시 한국어로, 3~4문장 정도로 간결하게 설명)", 
      "whyWrong": {
        "option1": "1번 선택지가 틀린 구체적인 이유 (한국어, 1~2문장)",
        "option2": "2번 선택지가 틀린 구체적인 이유 (한국어, 1~2문장)",
        "option3": "3번 선택지가 틀린 구체적인 이유 (한국어, 1~2문장)",
        "option4": "4번 선택지가 틀린 구체적인 이유 (한국어, 1~2문장)"
      }
      // ⚠️ "keyPoint" 요소 삭제됨
    }
  ],
  "vocabulary": [
    {
      "word": "본문 중 중요 N1 단어 (일본어)",
      "reading": "히라가나",
      "meaning": "한국어 의미",
      "level": "N1",
      "example": "예문 (일본어)"
    }
  ],
  "grammar": [
    {
      "pattern": "문법 패턴 (일본어)",
      "meaning": "한국어 의미",
      "example": "예문 (일본어)",
      "usage": "사용 방법 (한국어)"
    }
  ],
  "keyExpressions": [
    {
      "expression": "중요 표현 (일본어)",
      "meaning": "한국어 의미",
      "context": "사용 맥락 (한국어)"
    }
  ],
  "readingTips": [
    "독해 팁 1 (한국어)",
    "독해 팁 2 (한국어)"
  ]
}
`;
}
