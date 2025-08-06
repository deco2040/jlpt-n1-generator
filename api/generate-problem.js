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
      return res.status(400).json({ success: false, error: 'Missing problemType' });
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: 'Invalid JSON' });
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

// 🚨 극단적 JSON 강제 프롬프트
function getPrompt(problemType) {
  const jsonHeader = `OUTPUT ONLY JSON. NO EXPLANATIONS. NO GREETINGS. NO "I WILL" OR "I AIM TO". 
START IMMEDIATELY WITH "{" AND END WITH "}".

`;

  const prompts = {
    kanji: jsonHeader + `Generate JLPT N1 kanji reading problem:

{
  "question": "文中の**한자어**読み方",
  "underlined": "한자어",
  "choices": ["読み1", "読み2", "読み3", "読み4"],
  "correct": 0,
  "explanation": "解説"
}

Requirements:
- Advanced kanji (潜在, 洞察, 顕著, 拝見, 慎重, 綿密)
- **marked kanji** in sentence
- 4 choices with confusing wrong answers`,

    grammar: jsonHeader + `Generate JLPT N1 grammar problem:

{
  "question": "文章（　）含む",
  "choices": ["文法1", "文法2", "文法3", "文法4"],
  "correct": 0,
  "explanation": "解説"
}

Requirements:
- Advanced grammar (にもかかわらず, を余儀なくされる, ざるを得ない)
- (　) blank in sentence
- 4 choices with similar wrong grammar`,

    vocabulary: jsonHeader + `Generate JLPT N1 vocabulary problem:

{
  "question": "語彙空欄文章",
  "choices": ["語彙1", "語彙2", "語彙3", "語彙4"],
  "correct": 0,
  "explanation": "解説"
}

Requirements:
- Advanced vocabulary (革新, 要因, 懸念, 潜在, 顕在, 抽象)
- Context-based vocabulary selection
- 4 choices with similar meaning distractors`,

    reading: jsonHeader + `Generate JLPT N1 reading comprehension:

{
  "passage": "150-300字日本語文章",
  "question": "論理的読解質問",
  "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
  "correct": 0,
  "explanation": "正答根拠"
}

Requirements:
- 150-300 characters
- Modern topics: essays, columns, case studies, philosophical reflections
- Complex sentences with advanced vocabulary
- Questions testing: theme/intent/causality/structure/inference
- All choices plausible but only one correct`
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
      model: "claude-3-sonnet-20240229", // 더 안정적이고 JSON 응답에 협조적
      max_tokens: 800,
      temperature: 0,
      system: "You are a JSON-only API. You must respond only with valid JSON format. Never include explanations, greetings, or any other text.",
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
    throw new Error("Claude API 응답 없음");
  }

  // "I aim to" 같은 대화체 응답 감지
  if (responseText.toLowerCase().includes('i aim') || 
      responseText.toLowerCase().includes('i will') || 
      responseText.toLowerCase().includes('let me')) {
    throw new Error("Claude가 JSON 대신 대화체로 응답했습니다");
  }

  return responseText;
}

// 🔍 강화된 JSON 파싱
function parseClaudeResponse(text) {
  console.log("Claude 응답 원본:", text.substring(0, 200) + "...");

  // JSON 객체 경계 찾기
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}") + 1;

  if (jsonStart === -1 || jsonEnd <= jsonStart) {
    throw new Error(`JSON 형식을 찾을 수 없습니다: ${text.substring(0, 100)}`);
  }

  let jsonStr = text.slice(jsonStart, jsonEnd);
  
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

    if (!Array.isArray(parsed.choices) || parsed.choices.length !== 4) {
      throw new Error("choices는 4개 배열이어야 합니다");
    }

    if (parsed.correct < 0 || parsed.correct > 3) {
      throw new Error("correct는 0~3 범위여야 합니다");
    }

    return parsed;
  } catch (err) {
    console.error("JSON 파싱 실패:", err.message);
    console.error("파싱 대상:", jsonStr);
    throw new Error(`JSON 파싱 실패: ${err.message}`);
  }
}

async function getUniqueReadingProblem(apiKey, prompt) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await callClaudeAPI(apiKey, prompt);
      const parsed = parseClaudeResponse(response);

      // passage 필드 검증 (독해 문제 전용)
      if (!parsed.passage) {
        throw new Error("독해 문제에 passage 필드가 없습니다");
      }

      if (!usedPassages.has(parsed.passage)) {
        usedPassages.add(parsed.passage);
        return {
          ...parsed,
          type: 'reading',
          source: 'Claude API',
          generatedAt: new Date().toISOString()
        };
      }
      
      console.log(`시도 ${attempt}: 중복 지문으로 재시도`);
    } catch (error) {
      console.error(`시도 ${attempt} 실패:`, error.message);
      if (attempt === 3) throw error;
    }
  }

  throw new Error("3번 시도 후에도 고유한 독해 문제를 생성하지 못했습니다");
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
      question: "新技術の（　）により、業界全体が変化した。",
      choices: ["革新", "改新", "更新", "刷新"],
      correct: 0,
      explanation: "革新（かくしん） = 혁신, 기존 방식을 근본적으로 바꾸는 것"
    },
    reading: {
      passage: "現代社会では効率性が重視されるが、効率だけを追求すると創造性が失われる危険がある。真の進歩は、効率と創造のバランスから生まれる。重要なのは、短期的な成果に惑わされず、長期的な視点を持つことである。",
      question: "この文章で筆者が最も強調したいことは何か。",
      choices: ["効率性の重要性", "創造性の価値", "バランスの必要性", "長期的視点の重要性"],
      correct: 2,
      explanation: "효율과 창조의 균형에서 진정한 진보가 나온다고 했으므로 '밸런스의 필요성'이 핵심"
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
