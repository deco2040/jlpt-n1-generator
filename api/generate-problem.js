// 📁 /api/generate-problem.js

const usedPassages = new Set();

export default async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] API 호출됨 - Method: ${req.method}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed', message: 'POST 요청만 허용됩니다.' });
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

// 프롬프트 정의
function getPrompt(type) {
  const prompts = {
    kanji: `...`, // 기존 kanji 프롬프트 그대로 유지
    grammar: `...`, // 기존 grammar 프롬프트 그대로 유지
    vocabulary: `...`, // 기존 vocab 프롬프트 그대로 유지
    reading: `以下の条件を満たすJLPT N1レベルの読解問題を1つ生成してください。

条件:
- 実際の日本メディアや専門誌に近い文体（NHKニュース解説風、朝日新聞のコラム風、専門誌風、コミュニティ実用情報風）から1つをランダムに採用
- 本文：100～150文字、N1語彙・文法・複文構造・専門用語を含む
- 内容：社会・技術・科学・環境・芸術・教育・外交など多様な現代テーマ 중 1가지 선택
- 質問：筆者の意図、事実の理解、情報の抽出、論理的推論に関する1問
- 選択肢：納得しやすいが1つだけが正解な選択肢を4つ作成

以下のJSON形式でのみ返答してください:
{
  "passage": "本文",
  "question": "質問文",
  "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
  "correct": 正解番号（0～3）,
  "explanation": "正解の根拠や選択肢との違いの説明"
}

※ JSON形式以外の出力は一切不要です。`
  };

  return prompts[type] || prompts.kanji;
}

// Claude API 호출
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

// JSON 파싱
function parseClaudeResponse(text) {
  const clean = text.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(clean);
}

// reading 문제 중복 방지 처리
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

// 백업 문제
function getBackupProblem(type) {
  const backup = {
    kanji: {
      question: "この地域は**豊穣**な土地として知られている。",
      underlined: "豊穣",
      choices: ["ほうじょう", "ほうろう", "ぽうじょう", "ぼうじょう"],
      correct: 0,
      explanation: "豊穣（ほうじょう）= 풍요로운, 비옥한"
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
      explanation: "浸透（しんとう）= 침투, 보급"
    },
    reading: {
      passage: "現代社会における技術革新の速度は加速度的に増している。AIの進展により、従来人間が行っていた業務が自動化され、効率性は向上する一方で、雇用への影響という課題も生じている。",
      question: "この文章の主要なテーマは何か。",
      choices: ["AIの歴史", "技術革新による変化とその影響", "雇用問題の解決策", "効率化の方法"],
      correct: 1,
      explanation: "기술혁신이 가져오는 변화와 그 영향에 대해 논하고 있음"
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
