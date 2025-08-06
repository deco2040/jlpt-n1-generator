// 📁 utils/getRandomTopic.js
import { readingTopics } from '../topics.js';

const usedTopics = new Set();

export function getRandomTopic() {
  const availableTopics = readingTopics.filter((topic) => !usedTopics.has(topic));

  console.log(`[getRandomTopic] 사용되지 않은 주제 수: ${availableTopics.length}`);

  if (availableTopics.length === 0) {
    console.log('[getRandomTopic] 모든 주제가 사용됨. usedTopics 초기화.');
    usedTopics.clear();
    availableTopics.push(...readingTopics);
  }

  const index = Math.floor(Math.random() * availableTopics.length);
  const selected = availableTopics[index];
  usedTopics.add(selected);

  console.log(`[getRandomTopic] 선택된 주제: ${selected}`);

  return selected;
}
