// scripts/categorizeByClaude.js

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Anthropic 클라이언트 초기화
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * 주제 목록을 AI로 카테고리 분류
 */
async function categorizeTopics(topics, level) {
  console.log(`\n🤖 ${level} 주제 분류 중... (${topics.length}개)`);

  const prompt = `다음은 JLPT ${level} 레벨의 일본어 독해 주제 목록입니다.
이 주제들을 의미적으로 유사한 그룹으로 분류해주세요.

주제 목록:
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

요구사항:
1. 8-15개의 의미 있는 카테고리로 분류
2. 각 카테고리에 명확한 일본어 이름 부여
3. 카테고리는 ${level} 레벨에 적합한 난이도로 구성
4. 비슷한 주제끼리 그룹화

출력 형식 (JSON만):
{
  "社会構造と不平等": [
    "高齢化社会における世代間扶養の倫理的ジレンマ",
    "経済格差の拡大と社会的移動性"
  ],
  "技術革新と倫理": [
    "人工知能の発展と人間の存在価値の再定義"
  ]
}

주의: JSON 형식만 출력하고 다른 설명은 절대 포함하지 마세요.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].text;

    // JSON 추출
    let jsonText = responseText.trim();

    // 마크다운 코드블록 제거
    jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    // JSON 파싱
    const categories = JSON.parse(jsonText);

    // 검증
    const categorizedCount = Object.values(categories).flat().length;
    console.log(`  ✅ ${Object.keys(categories).length}개 카테고리로 분류`);
    console.log(`  ✅ ${categorizedCount}/${topics.length}개 주제 분류 완료`);

    if (categorizedCount < topics.length) {
      console.warn(
        `  ⚠️ ${topics.length - categorizedCount}개 주제가 누락되었습니다`
      );
    }

    return categories;
  } catch (error) {
    console.error(`  ❌ ${level} 분류 실패:`, error.message);
    throw error;
  }
}

/**
 * 큰 주제 목록을 청크로 나눠서 처리
 */
async function categorizeInChunks(topics, level, chunkSize = 80) {
  if (topics.length <= chunkSize) {
    return await categorizeTopics(topics, level);
  }

  console.log(`  📦 ${topics.length}개 주제를 ${chunkSize}개씩 분할 처리`);

  const chunks = [];
  for (let i = 0; i < topics.length; i += chunkSize) {
    chunks.push(topics.slice(i, i + chunkSize));
  }

  const allCategories = {};

  for (let i = 0; i < chunks.length; i++) {
    console.log(`\n  청크 ${i + 1}/${chunks.length} 처리 중...`);

    const chunkCategories = await categorizeTopics(chunks[i], level);

    // 카테고리 병합
    Object.entries(chunkCategories).forEach(
      ([categoryName, categoryTopics]) => {
        if (!allCategories[categoryName]) {
          allCategories[categoryName] = [];
        }
        allCategories[categoryName].push(...categoryTopics);
      }
    );

    // API 제한 고려 (2초 대기)
    if (i < chunks.length - 1) {
      console.log(`  ⏳ 다음 청크까지 2초 대기...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return allCategories;
}

/**
 * 메인 실행
 */
async function main() {
  console.log("🚀 2단계: AI 카테고리 분류 시작\n");
  console.log("━".repeat(60));

  // API 키 확인
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다");
    console.log("\n설정 방법:");
    console.log("  export ANTHROPIC_API_KEY='your-api-key'");
    process.exit(1);
  }

  // 인덱스 파일 로드
  const indexPath = path.join(__dirname, "../public/data/topics-by-level.json");

  if (!fs.existsSync(indexPath)) {
    console.error("❌ topics-by-level.json을 찾을 수 없습니다");
    console.log("먼저 실행하세요: node scripts/buildTopicIndex.js");
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  console.log("📊 레벨별 주제 수:");
  Object.entries(index).forEach(([level, topics]) => {
    console.log(`  ${level}: ${topics.length}개`);
  });
  console.log("━".repeat(60));

  // 각 레벨 처리
  const result = {};
  const levels = ["N1", "N2", "N3", "N4"];

  for (const level of levels) {
    const topics = index[level] || [];

    if (topics.length === 0) {
      console.log(`\n⚠️ ${level}: 주제 없음, 건너뜀`);
      result[level] = {};
      continue;
    }

    try {
      result[level] = await categorizeInChunks(topics, level, 80);

      console.log(`\n✅ ${level} 완료! 카테고리 목록:`);
      Object.entries(result[level]).forEach(([cat, items]) => {
        console.log(`  - ${cat}: ${items.length}개`);
      });
    } catch (error) {
      console.error(`\n❌ ${level} 처리 실패:`, error.message);
      result[level] = { "분류 실패": topics };
    }

    // 레벨 간 대기 (API 제한 고려)
    if (level !== "N4") {
      console.log(`\n⏳ 다음 레벨까지 3초 대기...\n`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // 최종 결과 저장
  const outputPath = path.join(
    __dirname,
    "../public/data/topics-categorized.json"
  );

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

  console.log("\n━".repeat(60));
  console.log(`✅ 2단계 완료!`);
  console.log(`💾 저장 위치: ${outputPath}`);

  // 전체 통계
  console.log("\n📊 최종 통계:");
  let totalCategories = 0;
  let totalTopics = 0;

  Object.entries(result).forEach(([level, categories]) => {
    const catCount = Object.keys(categories).length;
    const topicCount = Object.values(categories).flat().length;
    totalCategories += catCount;
    totalTopics += topicCount;

    console.log(`  ${level}: ${catCount}개 카테고리, ${topicCount}개 주제`);
  });

  console.log(`\n  총: ${totalCategories}개 카테고리, ${totalTopics}개 주제`);
  console.log("━".repeat(60));

  console.log("\n🎉 모든 작업 완료!");
  console.log("\n다음 단계:");
  console.log("  1. public/data/topics-categorized.json 확인");
  console.log("  2. 이상한 분류가 있으면 수동으로 수정");
  console.log("  3. API 코드에서 새 파일 사용\n");
}

main().catch((error) => {
  console.error("\n❌ 치명적 오류:", error);
  process.exit(1);
});
