// 📁 api/generate-problem.js
import { readingTopics } from '../utils/topics.js';
import { getRandomMixedTopic, generateReadingProblemFromAI } from '../utils/readingAI.js';

const usedPassages = new Set();
const usedQuestions = {
  kanji: new Set(),
  grammar: new Set(),
  vocabulary: new Set()
};

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] API 호출 - Method: ${req.method}`);

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

    const allowedTypes = ['kanji', 'grammar', 'vocabulary', 'reading'];
    if (!allowedTypes.includes(problemType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid problemType',
        message: `허용된 문제 유형: ${allowedTypes.join(', ')}`
      });
    }
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid JSON', message: '요청 데이터 형식이 잘못되었습니다.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      success: true,
      problem: getBackupProblem(problemType),
      message: 'API 키 없음 - 백업 문제 사용',
      isBackup: true
    });
  }

  try {
    if (problemType === 'reading') {
      const readingProblem = await generateReadingProblemFromAI();
      if (!readingProblem || usedPassages.has(readingProblem.passage)) {
        throw new Error('중복 지문 감지 또는 생성 실패');
      }
      usedPassages.add(readingProblem.passage);
      return res.status(200).json({ success: true, problem: {
        ...readingProblem,
        type: 'reading',
        source: 'Claude API',
        generatedAt: new Date().toISOString(),
        isBackup: false
      }});
    }

    const problem = await generateUniqueProblem(problemType, apiKey);
    return res.status(200).json({ success: true, problem });

  } catch (error) {
    return res.status(200).json({
      success: true,
      problem: getBackupProblem(problemType),
      message: '문제 생성 실패로 백업 문제 사용',
      isBackup: true,
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function generateUniqueProblem(type, apiKey) {
  const prompt = getPrompt(type);
  for (let i = 0; i < 3; i++) {
    const response = await callClaudeAPI(apiKey, prompt);
    const parsed = parseClaudeResponse(response);

    const key = type === 'kanji' ? parsed.question + parsed.underlined : parsed.question;
    if (!usedQuestions[type].has(key)) {
      usedQuestions[type].add(key);
      return {
        ...parsed,
        type,
        source: 'Claude API',
        generatedAt: new Date().toISOString(),
        isBackup: false
      };
    }
  }
  throw new Error(`${type} 문제 중복으로 인해 3회 생성 실패`);
}

function getPrompt(problemType) {
  const jsonOnlyHeader = `⚠️ JSON ONLY. No explanations or greetings.\n`;
  const prompts = {
    kanji: jsonOnlyHeader + `JLPT N1 한자 읽기 문제 생성...`,
    grammar: jsonOnlyHeader + `JLPT N1 문법 문제 생성...`,
    vocabulary: jsonOnlyHeader + `JLPT N1 어휘 문제 생성...`,
    reading: jsonOnlyHeader + `JLPT N1 독해 문제 생성... (주제는 Claude가 선택)`
  };
  return prompts[problemType];
}

async function callClaudeAPI(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1200,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  const responseText = data.content?.[0]?.text;
  return responseText;
}

function parseClaudeResponse(text) {
  try {
    const jsonStr = text.trim().replace(/```json|```/g, '');
    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (err) {
    throw new Error(`JSON 파싱 실패: ${err.message}`);
  }
}

function getBackupProblem(type) {
  const backup = {
    kanji: {
      question: "この研究は**洞察**に富んだ内容である。",
      underlined: "洞察",
      choices: ["どうさつ", "とうさつ", "どうさく", "とうさく"],
      correct: 0,
      explanation: "洞察（どうさつ） = 통찰"
    },
    grammar: {
      question: "台風の接近（　）、全便が欠航となった。",
      choices: ["に伴い", "に対し", "について", "における"],
      correct: 0,
      explanation: "に伴い = ~에 따라"
    },
    vocabulary: {
      question: "新技術の（　）により、業界全体が変化した。",
      choices: ["革新", "改新", "更新", "刷新"],
      correct: 0,
      explanation: "革新（かくしん） = 혁신"
    },
    reading: {
      passage: "現代社会では効率性が重視されるが、...",
      question: "この文章で筆者が最も強調したいことは何か。",
      choices: ["効率性の重要性", "創造性の価値", "バランスの必要性", "長期的視点の重要性"],
      correct: 2,
      explanation: "균형을 가장 강조하고 있음"
    }
  };

  return {
    ...backup[type],
    type,
    source: '백업 문제',
    generatedAt: new Date().toISOString(),
    isBackup: true
  };
}
