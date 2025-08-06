const usedPassages = new Set();

export default async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] API 호출됨 - Method: ${req.method}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'POST 요청만 허용됩니다.'
    });
  }

  let problemType;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    problemType = body.problemType;
    if (!problemType) {
      return res.status(400).json({ success: false, error: 'Missing problemType', message: 'problemType이 필요합니다.' });
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: 'Invalid JSON', message: '잘못된 요청 형식입니다.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      success: false,
      problem: getBackupProblem(problemType),
      message: 'API 키가 설정되지 않아 백업 문제를 사용합니다.'
    });
  }

  try {
    const prompt = getPrompt(problemType);

    if (problemType === 'reading') {
      const problem = await getUniqueReadingProblemFromClaude(apiKey, prompt);
      return res.status(200).json({ success: true, problem, message: "Claude AI가 새로운 독해 문제를 생성했습니다." });
    }

    const response = await callClaudeAPI(apiKey, prompt);
    const parsed = parseClaudeResponse(response);

    return res.status(200).json({
      success: true,
      problem: {
        ...parsed,
        type: problemType,
        source: "Claude API",
        generatedAt: new Date().toISOString(),
        timestamp: Date.now()
      },
      message: "Claude AI가 새로운 문제를 생성했습니다."
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      problem: getBackupProblem(problemType),
      message: `문제 생성 실패: ${error.message}. 백업 문제를 사용합니다.`
    });
  }
}

// ⚠️ JSON 출력 강제 프리픽스
const strictJsonPrefix = `
⚠️ This is an automated API. You MUST respond ONLY with valid JSON.
DO NOT include any explanation, greeting, or commentary.
응답은 반드시 JSON으로 시작해야 합니다. JSON 외 텍스트는 금지합니다.
`;

function getPrompt(problemType) {
  const prompts = {
    kanji: strictJsonPrefix + `
다음 조건을 만족하는 JLPT N1 한자 읽기 문제를 생성해주세요:
- 고급 한자 사용 (例: 潜在, 洞察, 顕著, 拝見 등)
- 문장 내 **밑줄 표시된 한자어** 포함
- 4개의 선택지 (정답 1개 + 헷갈리는 오답 3개)

출력 형식:
{
  "question": "한자어가 **로 감싸진 문장",
  "underlined": "밑줄친 한자어",
  "choices": ["읽기1", "읽기2", "읽기3", "읽기4"],
  "correct": 0~3,
  "explanation": "정답과 의미에 대한 한국어 해설"
}
`,

    grammar: strictJsonPrefix + `
다음 조건을 만족하는 JLPT N1 문법 문제를 생성해주세요:
- 고급 문형 사용 (例: にもかかわらず, を余儀なくされる 등)
- 문장 중 (　)에 적절한 문형 선택
- 4개의 선택지 구성 (정답 1개 + 유사 문형 오답 3개)

출력 형식:
{
  "question": "문장 (　) 포함",
  "choices": ["문법1", "문법2", "문법3", "문법4"],
  "correct": 0~3,
  "explanation": "정답 문형에 대한 한국어 해설"
}
`,

    vocabulary: strictJsonPrefix + `
다음 조건을 만족하는 JLPT N1 어휘 문제를 생성해주세요:
- 고급 어휘 사용 (例: 革新, 要因, 懸念, 潜在 등)
- 문맥 기반 어휘 선택 문제
- 4개의 선택지 구성 (정답 1개 + 의미 유사 오답 3개)

출력 형식:
{
  "question": "어휘 빈칸 포함 문장",
  "choices": ["어휘1", "어휘2", "어휘3", "어휘4"],
  "correct": 0~3,
  "explanation": "정답 어휘에 대한 한국어 해설"
}
`,

    reading: strictJsonPrefix + `
다음 조건을 만족하는 JLPT N1 독해 문제를 생성해주세요.

📌 목적: 고급 독해력, 추론 능력, 비판적 사고 평가

🧠 주제: Claude가 적절하다고 판단한 현대적 주제를 자유롭게 선택
- 유형 예시 포함 가능: 비유, 수필, 칼럼, 사례, 실험 해석 등

📋 지문 조건:
- 길이: 150~300자
- 스타일: 설명문, 수필, 비판 칼럼, 에세이 등 자유
- 복문, 고급 어휘, 논리 흐름 포함

📝 질문 조건:
- 질문 유형: 주제/의도/인과/구조/전제/비판적 추론 등
- 선택지는 모두 자연스럽지만 하나만 정답

출력 형식:
{
  "passage": "150~300자 일본어 지문",
  "question": "논리적 독해를 요구하는 질문",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct": 0~3,
  "explanation": "정답 근거 및 오답과 차이 (한국어 해설)"
}
`
  };

  return prompts[problemType] || prompts.kanji;
}

async function callClaudeAPI(apiKey, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Claude API 호출 실패 (${res.status}): ${errorData}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text;
}

// ✅ JSON 파싱 완전 방어
function parseClaudeResponse(text) {
  const jsonStart = text.indexOf("{");

  if (jsonStart === -1) {
    throw new Error("Claude 응답에 JSON 형식이 감지되지 않았습니다.");
  }

  const clean = text.slice(jsonStart).replace(/```json\n?|```|\n```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch (err) {
    console.error("JSON 파싱 실패. 응답 내용:", clean);
    throw new Error("Claude API 응답이 올바른 JSON 형식이 아닙니다.");
  }
}

async function getUniqueReadingProblemFromClaude(apiKey, prompt) {
  for (let i = 0; i < 5; i++) {
    const response = await callClaudeAPI(apiKey, prompt);
    const parsed = parseClaudeResponse(response);

    if (!usedPassages.has(parsed.passage)) {
      usedPassages.add(parsed.passage);
      return {
        ...parsed,
        type: 'reading',
        source: 'Claude API',
        generatedAt: new Date().toISOString(),
        timestamp: Date.now()
      };
    }
  }

  throw new Error("모든 생성 지문이 중복되었습니다.");
}

function getBackupProblem(type) {
  const backup = {
    kanji: {
      question: "この地域は**豊穣**な土地として知られている。",
      underlined: "豊穣",
      choices: ["ほうじょう", "ほうろう", "ぽうじょう", "ぼうじょう"],
      correct: 0,
      explanation: "豊穣（ほうじょう） = 풍요로운, 비옥한"
    },
    grammar: {
      question: "彼は忙しい（　）、毎日勉強を続けている。",
      choices: ["にもかかわらず", "によって", "において", "に対して"],
      correct: 0,
      explanation: "にもかかわらず = ~에도 불구하고"
    },
    vocabulary: {
      question: "新しいシステムの（　）を図るため、研修を行う。",
      choices: ["浸透", "沈殿", "浸水", "沈没"],
      correct: 0,
      explanation: "浸透（しんとう） = 침투, 보급"
    },
    reading: {
      passage: "現代社会における技術革新の速度は加速度的に増している。AIの進展により、従来人間が行っていた業務が自動化され、効率性은 향상되었지만, 일자리 감소라는 새로운 문제도 발생하고 있다。",
      question: "この文章の主なテーマは何か？",
      choices: ["技術革新の歴史", "AIによる雇用の喪失", "技術進化の影響", "効率化の方法"],
      correct: 2,
      explanation: "기술 발전이 가져오는 영향 전체를 포괄적으로 다루고 있음"
    }
  };

  return {
    ...backup[type] || backup.kanji,
    type,
    source: '백업 문제',
    generatedAt: new Date().toISOString(),
    isBackup: true
  };
}
