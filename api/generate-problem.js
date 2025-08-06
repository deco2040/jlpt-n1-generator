// 📁 api/generate-problem.js
import { getRandomTopic } from '../utils/getRandomTopic.js';
import { getAIRecommendedTopic } from '../utils/getAIRecommendedTopic.js';

export default async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const problemType = body.problemType;

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

      prompt = `JLPT N1 수준의 독해 문제를 JSON 형식으로 하나 만들어주세요.

{
  "passage": "지문",
  "question": "질문",
  "choices": ["1", "2", "3", "4"],
  "correct": 0,
  "explanation": "해설",
  "topic": "주제"
}`;
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
        model: "claude-3-5-sonnet-20241022",
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
