// api/generate-problem.js
export default async function handler(req, res) {
  // CORS 헤더 설정 (모든 도메인 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
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
    
    if (!problemType) {
      return res.status(400).json({
        success: false,
        error: 'Missing problemType',
        message: 'problemType이 필요합니다.'
      });
    }

    console.log(`[${new Date().toISOString()}] 문제 생성 요청: ${problemType}`);

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
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    return res.status(200).json({
      success: false,
      problem: getBackupProblem(problemType),
      message: 'API 키가 설정되지 않아 백업 문제를 사용합니다.'
    });
  }

  try {
    // Claude API 프롬프트 정의
    const prompts = {
      kanji: `JLPT N1 수준의 한자 읽기 문제를 1개 생성해주세요.

요구사항:
- N1 수준의 어려운 한자 사용 (豊穣, 洞察, 根本, 画期, 低迷, 慢性, 潜在, 顕著 등)
- 실제 JLPT에 출제될만한 자연스러운 문장
- 4개의 선택지 (정답 1개, 오답 3개)
- 오답은 실제로 헷갈릴만한 읽기들로 구성
- 한자는 **로 감싸서 표시

다음 JSON 형식으로만 답변해주세요:
{
  "question": "한자가 **로 감싸진 일본어 문장",
  "underlined": "밑줄친 한자",
  "choices": ["읽기1", "읽기2", "읽기3", "읽기4"],
  "correct": 정답번호(0-3),
  "explanation": "한자(읽기) = 한국어 의미"
}

JSON 외에는 아무것도 출력하지 마세요.`,

      grammar: `JLPT N1 수준의 문법 문제를 1개 생성해주세요.

요구사항:
- N1 수준의 고급 문법 패턴 사용 (にもかかわらず, のわりに, に基づいて, を限りに, の点で, に際して 등)
- 실제 JLPT에 출제될만한 자연스러운 문장
- 4개의 선택지로 구성
- 헷갈리기 쉬운 유사 문법들을 오답으로 배치

다음 JSON 형식으로만 답변해주세요:
{
  "question": "（　）가 포함된 일본어 문장",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct": 정답번호(0-3),
  "explanation": "문법 패턴 = 한국어 의미 설명"
}

JSON 외에는 아무것도 출력하지 마세요.`,

      vocabulary: `JLPT N1 수준의 어휘 문제를 1개 생성해주세요.

요구사항:
- N1 수준의 고급 어휘 사용 (浸透, 要因, 検討, 精度, 関심, 促進, 懸念 등)
- 실제 JLPT에 출제될만한 자연스러운 문장
- 4개의 선택지로 구성 (한자 어휘)
- 의미가 유사하거나 헷갈리기 쉬운 어휘들을 오답으로 배치

다음 JSON 형식으로만 답변해주세요:
{
  "question": "（　）가 포함된 일본어 문장",
  "choices": ["어휘1", "어휘2", "어휘3", "어휘4"],
  "correct": 정답번호(0-3),
  "explanation": "정답어휘 = 한국어 의미"
}

JSON 외에는 아무것도 출력하지 마세요.`,

      reading: `JLPT N1 수준의 독해 문제를 1개 생성해주세요.

요구사항:
- 100-150자 정도의 일본어 지문
- N1 수준의 어휘와 문법 사용
- 현대 사회, 기술, 환경, 경제 등의 주제
- 지문 내용에 대한 이해도를 묻는 질문
- 4개의 선택지로 구성

다음 JSON 형식으로만 답변해주세요:
{
  "passage": "일본어 지문",
  "question": "지문에 대한 질문",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct": 정답번호(0-3),
  "explanation": "정답 해설"
}

JSON 외에는 아무것도 출력하지 마세요.`
    };

    console.log('Claude API 호출 시작...');

    // Claude API 호출
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
          { 
            role: "user", 
            content: prompts[problemType] || prompts.kanji
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Claude API 에러 ${response.status}:`, errorData);
      
      // API 호출 실패 시 백업 문제 반환
      return res.status(200).json({
        success: false,
        problem: getBackupProblem(problemType),
        message: `Claude API 호출 실패 (${response.status}). 백업 문제를 사용합니다.`
      });
    }

    const data = await response.json();
    let responseText = data.content?.[0]?.text;

    if (!responseText) {
      throw new Error('Claude API에서 빈 응답을 받았습니다.');
    }
    
    // JSON 마크다운 제거 및 정리
    responseText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    
    console.log('Claude 응답 받음:', responseText.substring(0, 100) + '...');
    
    let generatedProblem;
    try {
      generatedProblem = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON 파싱 실패:', parseError, 'Response:', responseText);
      throw new Error('Claude API 응답을 파싱할 수 없습니다.');
    }
    
    // 생성된 문제에 메타데이터 추가
    const problemWithMeta = {
      ...generatedProblem,
      type: problemType,
      source: "Claude API",
      generatedAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    console.log(`문제 생성 성공: ${problemType}`);
    
    return res.status(200).json({
      success: true,
      problem: problemWithMeta,
      message: "Claude AI가 새로운 문제를 생성했습니다."
    });

  } catch (error) {
    console.error("Claude API 호출 중 에러:", error);
    
    // 모든 실패 시 백업 문제 반환
    return res.status(200).json({
      success: false,
      problem: getBackupProblem(problemType),
      message: `문제 생성 실패: ${error.message}. 백업 문제를 사용합니다.`
    });
  }
}

// 백업 문제 생성 함수
function getBackupProblem(problemType) {
  const backupProblems = {
    kanji: {
      question: "この地域は**豊穣**な土地として知られている。",
      underlined: "豊穣",
      choices: ["ほうじょう", "ほうろう", "ぽうじょう", "ぼうじょう"],
      correct: 0,
      explanation: "豊穣（ほうじょう）= 풍요로운, 비옥한",
      type: problemType,
      source: "백업 문제",
      generatedAt: new Date().toISOString(),
      isBackup: true
    },
    grammar: {
      question: "彼は忙しい（　）、毎日勉強を続けている。",
      choices: ["にもかかわらず", "によって", "において", "に対して"],
      correct: 0,
      explanation: "にもかかわらず = ~에도 불구하고",
      type: problemType,
      source: "백업 문제",
      generatedAt: new Date().toISOString(),
      isBackup: true
    },
    vocabulary: {
      question: "新しいシステムの（　）を図るため、研修を行う。",
      choices: ["浸透", "沈殿", "浸水", "沈没"],
      correct: 0,
      explanation: "浸透（しんとう）= 침투, 보급",
      type: problemType,
      source: "백업 문제",
      generatedAt: new Date().toISOString(),
      isBackup: true
    },
    reading: {
      passage: "現代社会における技術革新の速度は加速度的に増している。特にAI技術の発達により、従来人間が行っていた業務の多くが自動化されつつある。この変化は効率性の向上をもたらす一方で、雇用への影響という새로운 과제を生み出している。",
      question: "この文章の主要なテーマは何か。",
      choices: ["AI技술の歴史について", "技術革命による変化とその影響", "採用問題の 解決策", "効率性向上方法"],
      correct: 1,
      explanation: "기술혁신이 가져오는 변화와 그 영향(효율성 향상과 고용 문제)에 대해 논하고 있음",
      type: problemType,
      source: "백업 문제",
      generatedAt: new Date().toISOString(),
      isBackup: true
    }
  };

  return backupProblems[problemType] || backupProblems.kanji;
}
