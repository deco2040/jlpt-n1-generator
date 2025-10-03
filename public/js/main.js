/* ============================================ */
/* public/js/main.js */
/* ============================================ */
/**
 * main.js
 * JLPT N1 문제 생성 앱의 메인 초기화 및 이벤트 처리
 */

import { generateReadingProblem } from "./api/apiClient.js";
import { learningManager } from "./managers/learningManager.js";
import { renderProblem } from "./renderers/problemRenderer.js";
import { $, showError } from "./utils/dom.js";
import { showSkeleton } from "./utils/skeleton.js";

console.log("📦 main.js 로드 완료");

// ========================================
// 1. 앱 초기화
// ========================================
async function initApp() {
  console.log("🚀 앱 초기화 시작");

  try {
    // 통계 업데이트
    updateStatsDisplay();
    console.log("✅ 통계 업데이트 완료");

    // 이벤트 리스너 설정
    setupEventListeners();
    console.log("✅ 이벤트 리스너 설정 완료");

    console.log("🎉 앱 초기화 완료!");
  } catch (error) {
    console.error("❌ 앱 초기화 실패:", error);
  }
}

// ========================================
// 2. 통계 표시 업데이트
// ========================================
function updateStatsDisplay() {
  const stats = learningManager.getStats();

  const totalEl = $("#statTotal");
  const accuracyEl = $("#statAccuracy");
  const streakEl = $("#statStreak");

  if (totalEl) totalEl.textContent = stats.total || 0;
  if (accuracyEl) accuracyEl.textContent = `${stats.accuracy || 0}%`;
  if (streakEl) streakEl.textContent = `${stats.streak || 0}🔥`;
}

// ========================================
// 3. 이벤트 리스너 설정
// ========================================
function setupEventListeners() {
  const generateBtn = $("[data-generate-btn]");

  if (generateBtn) {
    generateBtn.addEventListener("click", handleGenerate);
    console.log("✅ 문제 생성 버튼 이벤트 등록 완료");
  } else {
    console.error("❌ 문제 생성 버튼을 찾을 수 없습니다");
  }
}

// ========================================
// 4. 문제 생성 핸들러
// ========================================
async function handleGenerate() {
  const output = $("[data-output]");
  const btn = $("[data-generate-btn]");

  if (!output || !btn) {
    console.error("❌ 필수 요소를 찾을 수 없습니다");
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "生成中...";

  // 스켈레톤 UI 표시
  showSkeleton(output);

  try {
    // 선택된 값 가져오기
    const levelSelect = $("#jlptLevel");
    const lengthSelect = $("#length");

    const selectedLevels = levelSelect.value.split(",");
    const lengthKey = lengthSelect.value;

    console.log("📝 선택된 옵션:", { selectedLevels, lengthKey });

    // 문제 생성 API 호출
    const data = await generateReadingProblem({
      lengthKey: lengthKey,
      levels: selectedLevels,
    });

    console.log("✅ API 응답 받음:", data);

    if (data.success && data.problem) {
      // 메타데이터 구성
      const metadata = {
        level: selectedLevels[0],
        selectedLevel: selectedLevels[0],
        lengthKey: lengthKey,
      };

      // 문제 렌더링
      renderProblem(output, { problem: data.problem, metadata });
      console.log("✅ 문제 렌더링 완료");
    } else {
      throw new Error(data.error || "文章生成に失敗しました");
    }
  } catch (error) {
    console.error("❌ 문제 생성 실패:", error);
    showError(output, error);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ========================================
// 5. 통계 업데이트 (외부 호출용)
// ========================================
export function refreshStats() {
  updateStatsDisplay();
}

// ========================================
// 6. DOM 로드 완료 시 초기화
// ========================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
