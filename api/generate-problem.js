// api/generate-problem.js
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { problemType } = req.body;


  try {
    // Claude API 프롬프트 정의
    const prompts = {
      kanji: `JLPT N1 수준의 한자 읽기 문제를 1개 생성해주세요.

요구사항:
- N1 수준의 어려운 한자 사용
- 실제 JLPT에 출제될만한 자연스러운 문장
- 4개의 선택지 (정답 1개, 오답 3개)
- 오답은 실제로 헷갈릴만한 읽기들로 구성

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
- N1 수준의 고급 문법 패턴 사용
- 실제 JLPT에 출제될만한 자연스러운 문장
- 4개의 선택지로 구성
- 헷갈리기 쉬운 유사 문법들을 오답으로 배치

다음 JSON 형식으로만 답변해주세요:
{
  "question": "（　）가 포함된 일본어 문장",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct": 정답번호(0-3),
  "explanation": "문법 설명 및 의미"
}

JSON 외에는 아무것도 출력하지 마세요.`,

      vocabulary: `JLPT N1 수준의 어휘 문제를 1개 생성해주세요.

요구사항:
- N1 수준의 고급 어휘 사용
- 실제 JLPT에 출제될만한 자연스러운 문장
- 4개의 선택지로 구성 (한자 어휘)
- 의미가 유사하거나 헷갈리기 쉬운 어휘들을 오답으로 배치

다음 JSON 형식으로만 답변해주세요:
{
  "question": "（　）가 포함된 일본어 문장",
  "choices": ["어휘1", "어휘2", "어휘3", "어휘4"],
  "correct": 정답번호(0-3),
  "explanation": "어휘(읽기) = 한국어 의미"
}

JSON 외에는 아무것도 출력하지 마세요.`,

      reading: `JLPT N1 수준의 독해 문제를 1개 생성해주세요.

요구사항:
- 100-150자 정도의 일본어 지문
- N1 수준의 어휘와 문법 사용
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



    // Claude API 호출
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY, // 환경변수에서 API 키 가져오기

      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229", // 또는 최신 모델
        max_tokens: 1000,
        messages: [
          { role: "user", content: prompts[problemType] }
        ]
      })
    });

    if (!response.ok) {


      throw new Error(`Claude API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    let responseText = data.content[0].text;

    // JSON 마크다운 제거
    responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();



    const generatedProblem = JSON.parse(responseText);

    // 메타데이터 추가
    const problemWithMeta = {
      ...generatedProblem,
      type: problemType,
      source: "Claude API",
      generatedAt: new Date().toISOString()
    };



    return res.status(200).json({
      success: true,
      problem: problemWithMeta
    });

  } catch (error) {
    console.error("문제 생성 실패:", error);

    // 백업 문제 반환
    const backupProblems = {
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
        passage: "現代社会における技術革新の速度は加速度的に増している。",
        question: "この文章の主要なテーマは何か。",
        choices: ["AI技術の歴史", "技術革新の변화", "고용 문제", "효율성 향상"],
        correct: 1,
        explanation: "기술혁신의 변화에 대해 논하고 있음"
      }
    };

    return res.status(200).json({
      success: false,
      problem: {
        ...backupProblems[problemType],
        type: problemType,
        source: "백업 (API 실패)",
        error: "API 호출 실패로 백업 문제 사용"
      }
    });
  }
}
