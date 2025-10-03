/* ============================================ */
/* public/js/utils/dom.js */
/* ============================================ */
/**
 * utils/dom.js
 * DOM 조작 유틸리티
 */

// 단일 선택 vs 다중 선택 통합
export function $(selector, parent = document, all = false) {
  return all
    ? parent.querySelectorAll(selector)
    : parent.querySelector(selector);
}

/**
 * HTML 이스케이프 (XSS 방지)
 */
// /public/js/utils/dom.js
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "style" && typeof value === "object") {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  children.forEach((child) => {
    if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });

  return element;
}

/**
 * 에러 표시
 */
export function showError(container, error) {
  if (!container) return;

  const errorMessage = error instanceof Error ? error.message : String(error);

  container.innerHTML = `
    <div class="error-container">
      <p class="error-icon">⚠️</p>
      <p class="error-message">${escapeHtml(errorMessage)}</p>
      <p class="error-hint">もう一度お試しください</p>
    </div>
  `;
}

/**
 * JSON 파일 로드
 */
export async function loadJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`JSON 로드 실패 [${url}]:`, error);
    throw error;
  }
}
