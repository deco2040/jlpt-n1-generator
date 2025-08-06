const usedPassages = new Set();

export default async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] API 호출 - Method: ${req.method}`);

  // CORS 헤더 설정
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

  // 요청 데이터 검증
  let problemType;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    problemType = body.problemType;
    if (!problemType) {
      return res.status(400).json({ success: false, error: 'Missing problemType' });
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: 'Invalid JSON' });
  }

  // API 키 확인
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
      const problem = await getUniqueReadingProblem(apiKey, prompt);
      return res.status(200).json({ success: true, problem });
    }

    const response = await callClaudeAPI(apiKey, prompt);
    const parsed = parseClaudeResponse(response);

    return res.status(200).json({
      success: true,
      problem: {
        ...parsed,
        type: problemType,
        source: "Claude API",
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("문제 생성 실패:", error.message);
    return res.status(200).json({
      success: false,
      problem: getBackupProblem(problemType),
      message: `문제 생성 실패: ${error.message}. 백업 문제를 사용합니다.`
    });
  }
}

// 🎯 강화된 JSON 전용 프롬프트
function getPrompt(problemType) {
  const jsonOnlyHeader = `⚠️ CRITICAL: You MUST respond ONLY with valid JSON. NO explanations, greetings, or commentary allowed.
응답은 반드시 JSON 형식으로만 해야 합니다. 다른 텍스트는 절대 금지입니다.

`;

  const prompts = {
    kanji: jsonOnlyHeader + `
JLPT N1 한자 읽기 문제를 생성하세요:

조건:
- 고급 한자 사용 (潜在, 洞察, 顕著, 拝見, 慎重, 綿密, 繊細, 抽象 등)
- 문장 내 **밑줄 표시된 한자어** 포함  
- 4개 선택지: 정답 1개 + 발음이 헷갈리는 오답 3개
- 일본어 문장은 자연스럽고 N1 수준의 어휘/문법 사용

출력 형식:
{
  "question": "한자어가 **로 감싸진 문장",
  "underlined": "밑줄친 한자어",
  "choices": ["읽기1", "읽기2", "읽기3", "읽기4"],
  "correct": 0~3,
  "explanation": "정답 한자의 읽기와 의미에 대한 한국어 해설"
}`,

    grammar: jsonOnlyHeader + `
JLPT N1 문법 문제를 생성하세요:

조건:
- 고급 문형 사용 (にもかかわらず, を余儀なくされる, ざるを得ない, に際して, をもって 등)
- 문장 중 (　)에 적절한 문형을 넣는 문제
- 4개 선택지: 정답 1개 + 의미나 형태가 유사한 오답 3개
- 문맥상 정답이 명확하게 구분되도록 작성

출력 형식:
{
  "question": "문장에 (　) 포함",
  "choices": ["문법1", "문법2", "문법3", "문법4"],
  "correct": 0~3,
  "explanation": "정답 문형의 의미와 사용법에 대한 한국어 해설"
}`,

    vocabulary: jsonOnlyHeader + `
JLPT N1 어휘 문제를 생성하세요:

조건:
- 고급 어휘 사용 (革新, 要因, 懸念, 潜在, 顕在, 抽象, 具体, 概念, 本質 등)
- 문맥에 적합한 어휘를 선택하는 문제
- 4개 선택지: 정답 1개 + 의미가 유사하거나 헷갈리는 오답 3개
- 비즈니스, 학술, 사회 문제 등 다양한 분야의 어휘 활용

출력 형식:
{
  "question": "어휘 빈칸이 포함된 문장",
  "choices": ["어휘1", "어휘2", "어휘3", "어휘4"],
  "correct": 0~3,
  "explanation": "정답 어휘의 의미와 사용 맥락에 대한 한국어 해설"
}`,

    reading: jsonOnlyHeader + `
JLPT N1 독해 문제를 생성하세요:

📌 목적: 고급 독해력, 추론 능력, 비판적 사고력 평가

🧠 주제 선정: Claude가 현대적이고 지적인 주제를 자유롭게 선택
- 주제 예시: 기술과 사회, 교육론, 문화 비평, 철학적 성찰, 심리학적 관찰, 환경과 인간, 예술과 사회 등
- 스타일: 논설문, 수필, 칼럼, 사례 분석, 비판적 에세이 등

📋 지문 조건:
- 길이: 150~300자 (적절한 분량으로 조절)
- 복문과 고급 어휘 활용
- 논리적 구조와 흐름 포함
- 추상적 개념이나 심화된 사고를 요구하는 내용

📝 질문 조건:
- 단순 정보 확인이 아닌 고차원적 사고 요구
- 질문 유형: 주제 파악, 필자의 의도, 논리적 인과관계, 글의 구조, 전제 조건, 비판적 추론 등
- 4개 선택지 모두 문법적으로 자연스럽되 정답은 명확히 하나

출력 형식:
{
  "passage": "150~300자 일본어 지문",
  "question": "논리적 독해력을 평가하는 질문",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct": 0~3,
  "explanation": "정답의 근거와 오답이 틀린 이유에 대한 한국어 해설"
}`
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
      max_tokens: 1200,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Claude API 호출 실패 (${res.status}): ${errorData}`);
  }

  const data = await res.json();
  const responseText = data.content?.[0]?.text;
  
  if (!responseText) {
    throw new Error("Claude API에서 응답을 받지 못했습니다.");
  }

  return responseText;
}

// JSON 파싱 및 검증
function parseClaudeResponse(text) {
  // JSON 시작점 찾기
  const jsonStart = text.indexOf("{");
  if (jsonStart === -1) {
    throw new Error("응답에서 JSON 형식을 찾을 수 없습니다.");
  }

  // JSON 추출 및 정제
  let jsonStr = text.slice(jsonStart);
  const jsonEnd = jsonStr.lastIndexOf("}") + 1;
  if (jsonEnd > 0) {
    jsonStr = jsonStr.slice(0, jsonEnd);
  }
  
  // 마크다운 코드블록 제거
  jsonStr = jsonStr.replace(/```json\n?|```/g, "").trim();

  try {
    const parsed = JSON.parse(jsonStr);
    
    // 필수 필드 검증
    const requiredFields = ['question', 'choices', 'correct', 'explanation'];
    for (const field of requiredFields) {
      if (parsed[field] === undefined) {
        throw new Error(`필수 필드 누락: ${field}`);
      }
    }

    // choices 배열 검증
    if (!Array.isArray(parsed.choices) || parsed.choices.length !== 4) {
      throw new Error("choices는 4개 항목의 배열이어야 합니다.");
    }

    // correct 값 검증
    if (typeof parsed.correct !== 'number' || parsed.correct < 0 || parsed.correct > 3) {
      throw new Error("correct는 0~3 범위의 숫자여야 합니다.");
    }

    return parsed;
  } catch (err) {
    console.error("JSON 파싱 실패:", err.message);
    console.error("파싱 대상:", jsonStr.substring(0, 200) + "...");
    throw new Error(`JSON 파싱 실패: ${err.message}`);
  }
}

async function getUniqueReadingProblem(apiKey, prompt) {
  const maxAttempts = 3;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await callClaudeAPI(apiKey, prompt);
      const parsed = parseClaudeResponse(response);

      // 독해 문제 전용 필드 검증
      if (!parsed.passage) {
        throw new Error("독해 문제에 passage 필드가 필요합니다.");
      }

      // 중복 확인 및 저장
      if (!usedPassages.has(parsed.passage)) {
        usedPassages.add(parsed.passage);
        return {
          ...parsed,
          type: 'reading',
          source: 'Claude API',
          generatedAt: new Date().toISOString()
        };
      }
      
      console.log(`독해 문제 생성 시도 ${attempt}: 중복 지문으로 재시도`);
    } catch (error) {
      console.error(`독해 문제 생성 시도 ${attempt} 실패:`, error.message);
      if (attempt === maxAttempts) throw error;
    }
  }

  throw new Error(`${maxAttempts}번 시도 후에도 고유한 독해 문제를 생성하지 못했습니다.`);
}

function getBackupProblem(type) {
  const backup = {
    kanji: {
      question: "この研究は**洞察**に富んだ内容である。",
      underlined: "洞察",
      choices: ["どうさつ", "とうさつ", "どうさく", "とうさく"],
      correct: 0,
      explanation: "洞察（どうさつ） = 통찰, 사물의 본질을 꿰뚫어 보는 것"
    },
    grammar: {
      question: "台風の接近（　）、全便が欠航となった。",
      choices: ["に伴い", "に対し", "について", "における"],
      correct: 0,
      explanation: "に伴い = ~에 따라, ~와 동시에 일어나는 상황을 나타냄"
    },
    vocabulary: {
      question: "新技術の（　）により、業界全体が変화した。",
      choices: ["革新", "改新", "更新", "刷新"],
      correct: 0,
      explanation: "革新（かくしん） = 혁신, 기존 방식을 근본적으로 바꾸는 것"
    },
    reading: {
      passage: "現代社会では効率性が重視されるが、効率だけを追求すると創造性が失われる危険がある。真の進歩は、効率と創造のバランスから生まれる。重要なのは、短期的な成果に惑わされず、長期的な視点を持つことである。",
      question: "この文章で筆者が最も強調したいことは何か。",
      choices: ["効率性の重要性", "創造性の価値", "バランスの必要性", "長期的視点の重要性"],
      correct: 2,
      explanation: "필자는 효율과 창조의 균형에서 진정한 진보가 나온다고 하며, 밸런스의 필요성을 가장 강조하고 있음"
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
