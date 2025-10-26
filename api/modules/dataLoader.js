// api/modules/dataLoader.js
// JSON 파일 로딩 전담 모듈

import fs from "fs";
import path from "path";

/**
 * public/data 폴더에서 JSON 파일 로드
 * @param {string} filename - 파일명 (예: "topics.json")
 * @returns {Object} 파싱된 JSON 객체
 */
function loadJSONFromPublicData(filename) {
  const filePath = path.join(process.cwd(), "public", "data", filename);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    console.log(`📁 [dataLoader] ${filename} 로드 성공 (${(content.length / 1024).toFixed(2)}KB)`);
    return data;
  } catch (error) {
    console.error(`❌ [dataLoader] ${filename} 로드 실패:`, error.message);
    throw new Error(`데이터 파일 로드 실패: ${filename}`);
  }
}

/**
 * 필요한 모든 데이터 파일을 한번에 로드
 * @returns {Object} 로드된 모든 데이터
 */
export function loadAllData() {
  console.log("\n========================================");
  console.log("📚 JSON 데이터 로드 시작");
  console.log("========================================");

  const topicsData = loadJSONFromPublicData("topics.json");
  const genreData = loadJSONFromPublicData("genre.json");
  const lengthsData = loadJSONFromPublicData("length-definitions.json");
  const speakersData = loadJSONFromPublicData("speakers.json");
  const trapData = loadJSONFromPublicData("trap.json");

  console.log("✅ 모든 JSON 데이터 로드 완료\n");

  return {
    topicsData,
    genreData,
    lengthsData,
    speakersData,
    trapData,
  };
}

/**
 * 개별 파일 로드 함수들 (필요시)
 */
export const loadTopics = () => loadJSONFromPublicData("topics.json");
export const loadGenres = () => loadJSONFromPublicData("genre.json");
export const loadLengths = () =>
  loadJSONFromPublicData("length-definitions.json");
export const loadSpeakers = () => loadJSONFromPublicData("speakers.json");
export const loadTraps = () => loadJSONFromPublicData("trap.json");
