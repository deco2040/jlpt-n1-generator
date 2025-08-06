// 📁 utils/getRandomTopic.js
const usedTopics = new Set();

export async function getRandomTopicFromAI() {
  const prompt = `
JLPT N1 독해 문제 생성을 위한 주제를 하나 추천해줘.
조건:
- 너무 흔하지 않고 시사적 또는 추상적인 고급 주제
- 사회, 문화, 기술, 예술, 철학, 환경, 경제 등 다양한 분야 중 랜덤 선택
- 1문장으로 간결하게 주제만 제시

단, 다음과 같은 기존 주제들과 중복되지 않아야 해:
${Array.from(usedTopics).join(", ") || '없음'}
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
    return await getRandomTopicFromAI(); // 중복 시 재귀 호출
  }

  usedTopics.add(topic);
  return topic;
}
