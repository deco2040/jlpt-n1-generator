// public/js/main.js
/**
 * JLPT N1 문제 생성 앱의 메인 초기화 및 이벤트 처리
 */

import { generateReadingProblem } from "./api/apiClient.js";
import { learningManager } from "./managers/learningManager.js";
import { renderProblem } from "./renderers/problemRenderer.js";
import { $, showError } from "./utils/dom.js";
import { validateAndBuild } from "./utils/requestBuilder.js";
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
    // UI에서 선택된 값 가져오기
    const levelSelect = $("#jlptLevel");
    const lengthSelect = $("#length");
    const categorySelect = $("#category"); // 카테고리 선택이 있다면

    // 선택된 레벨 파싱
    const selectedLevels = levelSelect.value.includes(",")
      ? levelSelect.value.split(",")
      : [levelSelect.value];

    const lengthKey = lengthSelect.value;
    const preferredCategory = categorySelect?.value || null;

    // 옵션 객체 구성
    const options = {
      lengthKey,
      levels: selectedLevels,
      preferredCategory,
    };

    console.log("📝 선택된 옵션:", options);

    // 🎯 원스톱 검증 및 페이로드 생성
    const result = validateAndBuild(options);

    if (!result.success) {
      throw new Error(`入力エラー: ${result.errors.join(", ")}`);
    }

    console.log("📤 검증된 페이로드:", result.payload);

    // 문제 생성 API 호출
    const data = await generateReadingProblem(result.payload);

    console.log("✅ API 응답 받음:", data);

    if (data.success && data.problem) {
      // 메타데이터는 백엔드에서 반환된 것 사용
      const metadata = data.metadata || {
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
