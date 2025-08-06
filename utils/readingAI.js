// 📁 utils/readingAI.js
import { readingTopics } from './topics.js';

const usedTopics = new Set();
const usedPassages = new Set();

// 로컬스토리지 기반 중복 방지 (프론트에서만 적용됨)
function loadUsedLocalStorage(key) {
  if (typeof localStorage === 'undefined') return;
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  return new Set(saved);
}

function saveUsedLocalStorage(key, set) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

// 🧩 토픽 소스 결정 (50% topics.js / 50% AI)
export async function getRandomMixedTopic() {
  const fromTopics = Math.random() < 0.5;

  if (fromTopics) {
    const candidates = readingTopics.filter(t => !usedTopics.has(t));
    if (candidates.length === 0) usedTopics.clear(); // reset if exhausted
    const topic = candidates[Math.floor(Math.random() * candidates.length)];
    usedTopics.add(topic);
    return topic;
  } else {
    const prompt = `
JLPT N1 독해 문제 생성을 위한 주제를 하나 추천해줘.
조건:
- 너무 흔하지 않고 시사적 또는 추상적인 고급 주제
- 사회, 문화, 기술, 예술, 철학, 환경, 경제 등 다양한 분야 중 랜덤 선택
- 1문장으로 간결하게 주제만 제시
- 단, 인공지능/ChatGPT/기술혁신/AI 등 기술 관련 주제는 피해주세요
- 다음과 중복 금지: ${Array.from(usedTopics).join(', ') || '없음'}
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
      return await getRandomMixedTopic(); // 중복 시 재귀
    }

    usedTopics.add(topic);
    return topic;
  }
}

// 🧠 독해 문제 생성
export async function generateReadingProblemFromAI() {
  const topic = await getRandomMixedTopic();

  const prompt = `
주제: ${topic}

JLPT N1 독해 문제를 아래 조건에 맞게 하나 만들어줘.

[지문 조건]
- 150~300자 분량의 일본어 지문
- 추상적이거나 시사적인 고급 주제
- N1 수준 어휘 및 복문, 고급 문장 사용
- NHK 뉴스 해설, 아사히 칼럼, 수필, 에세이, 비판적 논설 스타일 등
- 문체는 분석적, 철학적, 논리적일 것

[문제 조건]
- 지문을 기반으로 문제 1개, 보기는 4개
- 질문은 다음 중 하나: 주제 / 필자의 의도 / 구체적 정보 / 추론
- 선택지는 모두 자연스럽지만 하나만 정답

[형식]
{
  "type": "reading",
  "topic": "${topic}",
  "passage": "...",
  "question": "...",
  "choices": ["...", "...", "...", "..."],
  "correct": 2,
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
    const parsed = JSON.parse(content);
    const key = parsed.passage?.trim();

    if (!key || usedPassages.has(key)) {
      console.warn("중복 지문 감지. 재시도...");
      return await generateReadingProblemFromAI();
    }

    usedPassages.add(key);
    return parsed;

  } catch (e) {
    console.error('JSON 파싱 실패:', content);
    return null;
  }
}
