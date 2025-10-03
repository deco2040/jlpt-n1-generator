/**
 * utils/storage.js
 * localStorage 래퍼 유틸리티
 */

/**
 * localStorage에서 데이터 가져오기
 * @param {string} key - 저장 키
 * @returns {any|null} 파싱된 데이터 또는 null
 */
export function getFromStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`localStorage 읽기 실패 [${key}]:`, error);
    return null;
  }
}

/**
 * localStorage에 데이터 저장
 * @param {string} key - 저장 키
 * @param {any} value - 저장할 데이터
 * @returns {boolean} 성공 여부
 */
export function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`localStorage 저장 실패 [${key}]:`, error);
    return false;
  }
}

/**
 * localStorage에서 데이터 삭제
 * @param {string} key - 삭제할 키
 * @returns {boolean} 성공 여부
 */
export function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`localStorage 삭제 실패 [${key}]:`, error);
    return false;
  }
}

/**
 * localStorage 전체 초기화
 * @returns {boolean} 성공 여부
 */
export function clearStorage() {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error("localStorage 초기화 실패:", error);
    return false;
  }
}
