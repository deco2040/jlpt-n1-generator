// 📁 utils/readingAI.js
const usedTopics = new Set();

export async function getRandomTopicFromAI() {
  const prompt = `
JLPT N1 독해 문제 생성을 위한 주제를 하나 추천해줘.
조건:
- 너무 흔하지 않고 시사적 또는 추상적인 고급 주제
- 사회, 문화, 기술, 예술, 철학, 환경, 경제 등 다양한 분야 중 랜덤 선택
- 1문장으로 간결하게 주제만 제시
- 중복 불가

지금까지 사용된 주제:
${Array.from(usedTopics).join(', ') || '없음'}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8
    })
  });

  const data = await response.json();
  const topic = data.choices?.[0]?.message?.content?.trim();

  if (!topic || usedTopics.has(topic)) {
    return await getRandomTopicFromAI(); // 중복 방지 재귀
  }

  usedTopics.add(topic);
  return topic;
}

export async function generateReadingProblemFromAI() {
  const topic = await getRandomTopicFromAI();

  const prompt = `
주제: ${topic}

JLPT N1 독해 문제를 아래 조건에 맞게 하나 만들어줘.

[지문 조건]
- 100~150자 분량의 일본어 지문
- 실제 일본 언론 기사 스타일 (객관적 또는 분석적 또는 전문적 또는 실용적)
- NHK 뉴스 해설 / 아사히신문 칼럼 / 전문지 기사 / 커뮤니티 정보글 중 하나 선택
- N1 수준 어휘와 문법 사용 (존경어/겸양어, 고급 어휘 포함)
- 구체적 수치, 전문용어, 실제 사례 포함

[문제 조건]
- 지문을 기반으로 문제 1개, 보기는 4개
- 질문은 다음 중 하나: 주제 / 필자의 의도 / 구체적 정보 / 추론
- 선택지는 모두 그럴듯하지만 하나만 정답

[형식]
{
  "type": "reading",
  "topic": "...",
  "passage": "...",
  "question": "...",
  "choices": ["...", "...", "...", "..."],
  "correct": 1,
  "explanation": "..."
}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('AI 응답 JSON 파싱 실패:', content);
    return null;
  }
}
