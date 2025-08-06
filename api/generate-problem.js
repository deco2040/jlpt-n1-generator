// 📁 api/generate-problem.js
import { getRandomTopic } from '../utils/getRandomTopic.js';
import { getAIRecommendedTopic } from '../utils/getAIRecommendedTopic.js';

export default async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const problemType = body.problemType;

  // api/generate-problem.js
export default async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] API 호출됨 - Method: ${req.method}`);
  
  // CORS 헤더 설정 (모든 도메인 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS 요청 처리됨');
    res.status(200).end();
    return;
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    console.log(`Method ${req.method} 허용되지 않음`);
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      message: 'POST 요청만 허용됩니다.' 
    });
  }

  let problemType;
  
  try {
    // 요청 데이터 파싱
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    problemType = body.problemType;
    
    console.log('요청된 problemType:', problemType);
    
    if (!problemType) {
      return res.status(400).json({
        success: false,
        error: 'Missing problemType',
        message: 'problemType이 필요합니다.'
      });
    }

  } catch (error) {
    console.error('요청 데이터 파싱 실패:', error);
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON',
      message: '잘못된 요청 형식입니다.'
    });
  }

  // API 키 확인
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('API 키 존재 여부:', !!apiKey);
  
  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY가 설정되지 않음 - 백업 문제 사용');
    return res.status(200).json({
      success: false,
      problem: getBackupProblem(problemType),
      message: 'API 키가 설정되지 않아 백업 문제를 사용합니다.'
    });
  }


  
  if (!problemType) {
    return res.status(400).json({ success: false, error: 'problemType이 필요합니다.' });
  }

  let prompt = '';
  let topic = null;

  if (problemType === 'reading') {
    try {
      if (Math.random() < 0.8) {
        topic = getRandomTopic();
        console.log('[토픽 선택] 로컬 주제 사용됨');
      } else {
        topic = await getAIRecommendedTopic();
        console.log('[토픽 선택] AI 추천 주제 사용됨');
      }

      if (!topic) {
        console.warn('[토픽 선택] 주제 선택 실패 → 기본 주제 사용');
        topic = '기후 변화와 사회 시스템의 변화';
      }

      prompt = `JLPT N1 수준의 독해 문제를 1개 생성해주세요.

선정된 주제: 「${topic}」

요구사항:
- 100-150자 정도의 일본어 지문 (실제 일본 언론사나 전문 사이트 스타일)
- N1 수준의 어휘와 문법 사용 (고급 어휘, 존경어/겸양어, 복잡한 문법 구조 포함)

- 문체는 다음 중 하나를 선택:
  * NHK 뉴스 해설 스타일 (객관적, 정확한 어조)
  * 아사히신문/요미우리신문 칼럼 스타일 (분석적, 논리적)
  * 일본 전문지 기사 스타일 (전문적, 상세한 설명)
  * 일본 커뮤니티 정보글 스타일 (실용적, 접근하기 쉬운 어조)

- 지문에는 구체적인 데이터, 전문 용어, 실제 상황을 반영한 내용 포함
- 질문은 지문의 주제, 필자의 의도, 구체적 정보, 추론을 묻는 것 중 하나
- 4개의 선택지는 모두 그럴듯하지만 하나만 정확하도록 구성

다음 JSON 형식으로만 답변해주세요:
{
  "passage": "실제 일본 언론사나 전문 사이트 스타일의 일본어 지문",
  "question": "지문에 대한 질문 (일본어)",
  "choices": ["선택지1 (일본어)", "선택지2 (일본어)", "선택지3 (일본어)", "선택지4 (일본어)"],
  "correct": 정답번호(0-3),
  "explanation": "정답 해설 (한국어)",
  "topic": "이번 지문의 주제 분야"
}

JSON 외에는 아무것도 출력하지 마세요.`;
    } catch (err) {
      console.error('Reading 문제 생성 중 예외 발생:', err);
      return res.status(500).json({ success: false, error: 'reading 문제 생성 중 에러 발생' });
    }
  } else if (problemType === 'grammar') {
    prompt = `JLPT N1 수준의 문법 문제를 1개 생성해주세요.

요구사항:
- 고급 문법 표현 사용 (にもかかわらず, のわりに 등)
- 자연스러운 문장과 헷갈릴만한 선택지 4개 포함
- JSON 형식으로만 출력

다음 형식:
{
  "question": "（　）가 포함된 일본어 문장",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct": 정답번호(0-3),
  "explanation": "문법 설명 (한국어)"
}`;
  } else if (problemType === 'vocabulary') {
    prompt = `JLPT N1 수준의 어휘 문제를 1개 생성해주세요.

요구사항:
- 고급 어휘 사용
- 자연스러운 문장과 의미 유사한 선택지 포함
- JSON 형식으로만 출력

다음 형식:
{
  "question": "（　）가 포함된 일본어 문장",
  "choices": ["어휘1", "어휘2", "어휘3", "어휘4"],
  "correct": 정답번호(0-3),
  "explanation": "정답 어휘 설명 (한국어)"
}`;
  } else if (problemType === 'kanji') {
    prompt = `JLPT N1 수준의 한자 읽기 문제를 1개 생성해주세요.

요구사항:
- 어려운 한자 포함 문장 생성
- 읽기 헷갈리는 선택지 4개 포함
- JSON 형식으로만 출력

다음 형식:
{
  "question": "한자가 **로 감싸진 일본어 문장",
  "underlined": "밑줄 친 한자",
  "choices": ["읽기1", "읽기2", "읽기3", "읽기4"],
  "correct": 정답번호(0-3),
  "explanation": "한자 해석 (한국어)"
}`;
  } else {
    return res.status(400).json({ success: false, error: '지원하지 않는 problemType입니다.' });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1500,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API 실패:', errorText);
      return res.status(500).json({ success: false, error: 'Claude API 호출 실패' });
    }

    const data = await response.json();
    let responseText = data.content?.[0]?.text || '';

    responseText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(responseText);
    return res.status(200).json({ success: true, problem: parsed });

  } catch (err) {
    console.error('Claude 호출 에러:', err);
    return res.status(500).json({ success: false, error: 'Claude 호출 중 예외 발생' });
  }
}
