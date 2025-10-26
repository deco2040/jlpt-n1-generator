// api/modules/topicIndexer.js

/**
 * 레벨별 주제 인덱스 생성
 * @param {Object} topicsData - topics.json 데이터
 * @returns {Object} 레벨별 주제 배열
 */
export function buildTopicIndex(topicsData) {
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
      console.warn(`⚠️ 카테고리 데이터 없음: ${categoryKey}`);
      return;
    }

    categoryData.items.forEach((item) => {
      totalProcessed++;

      if (!item.levels || item.levels.length === 0) {
        noLevelCount++;
        console.warn(
          `⚠️ 레벨 없는 주제 [${categoryKey}]: ${item.topic?.substring(
            0,
            30
          )}...`
        );
        return;
      }

      // 각 레벨에 주제 추가
      item.levels.forEach((level) => {
        if (index[level]) {
          index[level].push(item.topic);
        } else {
          console.warn(`⚠️ 알 수 없는 레벨: ${level}`);
        }
      });
    });
  });

  // 중복 제거
  Object.keys(index).forEach((level) => {
    const before = index[level].length;
    index[level] = [...new Set(index[level])];
    const after = index[level].length;

    if (before !== after) {
      console.log(`  ${level}: ${before - after}개 중복 제거`);
    }
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
