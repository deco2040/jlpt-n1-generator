/* ============================================ */
/* public/js/main.js (수정됨) */
/* ============================================ */
/**
 * main.js
 * JLPT N1 문제 생성 앱의 메인 초기화 및 이벤트 처리
 * ✅ LevelSelector 통합
 */

import { generateReadingProblem } from "./api/apiClient.js";
import { learningManager } from "./managers/learningManager.js";
import { renderProblem } from "./renderers/problemRenderer.js";
import { LevelSelector } from "./ui/levelSelector.js"; // ✅ 새로 추가
import { $, showError } from "./utils/dom.js";
import { showSkeleton } from "./utils/skeleton.js";

console.log("📦 main.js 로드 완료");

// ✅ 전역 변수: LevelSelector 인스턴스
let levelSelector = null;

// ========================================
// 1. 앱 초기화
// ========================================
async function initApp() {
  console.log("🚀 앱 초기화 시작");

  try {
    // ✅ LevelSelector 초기화
    levelSelector = new LevelSelector("levelSelector", {
      initialLevels: ["N1"],
      allowMultiple: true,
      onChange: (levels) => {
        console.log("📝 레벨 변경됨:", levels);
        // 필요 시 추가 동작 수행 가능
      },
    });
    console.log("✅ LevelSelector 초기화 완료");

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

  // 통계 업데이트 이벤트 리스너
  window.addEventListener("statsUpdated", () => {
    updateStatsDisplay();
  });
}

// ========================================
// 4. 문제 생성 핸들러 (✅ 복수 레벨 지원)
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
    // ✅ LevelSelector에서 복수 레벨 가져오기
    const selectedLevels = levelSelector.getSelected();

    // 길이 선택 (기존 방식 유지)
    const lengthSelect = $("#length");
    const lengthKey = lengthSelect ? lengthSelect.value : "medium";

    console.log("📝 선택된 옵션:", { selectedLevels, lengthKey });

    // ✅ API 호출 시 levels 배열로 전달
    const data = await generateReadingProblem({
      lengthKey: lengthKey,
      levels: selectedLevels, // ✅ 복수 레벨 배열
    });

    console.log("✅ API 응답 받음:", data);

    if (data.success && data.problem) {
      // 메타데이터 구성
      const metadata = {
        level: selectedLevels[0], // 첫 번째 레벨을 대표로
        selectedLevel: selectedLevels[0],
        selectedLevels: selectedLevels, // ✅ 전체 레벨 배열 추가
        lengthKey: lengthKey,
        ...data.metadata, // API에서 받은 추가 메타데이터
      };

      // 문제 렌더링
      renderProblem(output, { problem: data.problem, metadata });
      console.log("✅ 문제 렌더링 완료");

      // 백업 문제 경고 표시 (있는 경우)
      if (data.warning) {
        const warningDiv = document.createElement("div");
        warningDiv.style.cssText = `
          background: #fff3cd;
          color: #856404;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          border-left: 4px solid #ffc107;
        `;
        warningDiv.textContent = data.warning;
        output.insertBefore(warningDiv, output.firstChild);
      }
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
