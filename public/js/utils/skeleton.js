/* ============================================ */
/* public/js/utils/skeleton.js */
/* ============================================ */
/**
 * utils/skeleton.js
 * 스켈레톤 UI 표시 유틸리티
 */

/**
 * 스켈레톤 UI 표시
 * @param {HTMLElement} container - 스켈레톤을 표시할 컨테이너
 */
export function showSkeleton(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="skeleton-container">
      <div class="skeleton skeleton-header"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-question"></div>
      <div class="skeleton skeleton-option"></div>
      <div class="skeleton skeleton-option"></div>
      <div class="skeleton skeleton-option"></div>
      <div class="skeleton skeleton-option"></div>
    </div>
  `;
}
