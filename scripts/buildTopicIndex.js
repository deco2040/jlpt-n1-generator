// scripts/buildTopicIndex.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ES Module에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// topics.json 로드
function loadTopics() {
  const topicsPath = path.join(__dirname, "../public/data/topics.json");

  if (!fs.existsSync(topicsPath)) {
    throw new Error(`topics.json을 찾을 수 없습니다: ${topicsPath}`);
  }

  const content = fs.readFileSync(topicsPath, "utf-8");
  return JSON.parse(content);
}

// 인덱스 생성
function buildTopicIndex(topicsData) {
  console.log("🔨 주제 인덱스 생성 중...");

  const index = {
    N1: [],
    N2: [],
    N3: [],
    N4: [],
  };

  let totalProcessed = 0;
  let noLevelCount = 0;

  Object.entries(topicsData.topics).forEach(([categoryKey, categoryData]) => {
    if (!categoryData.items || !Array.isArray(categoryData.items)) {
      return;
    }

    categoryData.items.forEach((item) => {
      totalProcessed++;

      if (!item.levels || item.levels.length === 0) {
        noLevelCount++;
        return;
      }

      item.levels.forEach((level) => {
        if (index[level]) {
          index[level].push(item.topic);
        }
      });
    });
  });

  // 중복 제거
  Object.keys(index).forEach((level) => {
    index[level] = [...new Set(index[level])];
  });

  console.log("\n✅ 인덱스 생성 완료:");
  console.log("━".repeat(50));
  console.log(`총 처리: ${totalProcessed}개`);
  console.log(`레벨 없음: ${noLevelCount}개`);
  console.log("\n레벨별 주제 수:");
  Object.entries(index).forEach(([level, topics]) => {
    console.log(`  ${level}: ${topics.length}개`);
  });
  console.log("━".repeat(50));

  return index;
}

// 저장
function saveIndex(index) {
  const outputPath = path.join(
    __dirname,
    "../public/data/topics-by-level.json"
  );

  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), "utf-8");

  console.log(`\n💾 인덱스 파일 저장: ${outputPath}`);
}

// 실행
async function main() {
  console.log("🚀 1단계: 주제 인덱싱 시작\n");

  try {
    const topicsData = loadTopics();
    const index = buildTopicIndex(topicsData);
    saveIndex(index);

    console.log("\n✅ 1단계 완료!");
    console.log("다음 단계: node scripts/categorizeByClaude.js\n");
  } catch (error) {
    console.error("\n❌ 오류 발생:", error.message);
    process.exit(1);
  }
}

main();
