// public/js/ui/levelSelector.js
/**
 * 복수 JLPT 레벨 선택 UI 컴포넌트
 * React 데모의 레벨 선택 기능을 바닐라 JS로 구현
 */

export class LevelSelector {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container #${containerId} not found`);
    }

    // 기본 설정
    this.selectedLevels = options.initialLevels || ["N1"];
    this.allowMultiple = options.allowMultiple !== false; // 기본값 true
    this.onChange = options.onChange || null;

    // 레벨 정의
    this.levels = [
      { key: "N1", label: "N1", emoji: "🔴", description: "最上級" },
      { key: "N2", label: "N2", emoji: "🟠", description: "上級" },
      { key: "N3", label: "N3", emoji: "🟡", description: "中級" },
      { key: "N4", label: "N4", emoji: "🟢", description: "初中級" },
    ];

    this.render();
  }

  /**
   * UI 렌더링
   */
  render() {
    const html = `
      <div class="level-selector-wrapper">
        <label class="level-selector-label">
          🎯 JLPTレベル選択
          ${
            this.allowMultiple
              ? '<span class="hint-text">(複数選択可能)</span>'
              : ""
          }
        </label>
        
        <div class="level-buttons">
          ${this.levels.map((level) => this.renderLevelButton(level)).join("")}
        </div>

        <div class="level-selected-display">
          選択中: <span class="selected-levels-text">${this.getSelectedText()}</span>
        </div>

        <div class="level-hint">
          レベルに応じて適切な語彙・文法・文章が選択されます
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  /**
   * 레벨 버튼 렌더링
   */
  renderLevelButton(level) {
    const isSelected = this.selectedLevels.includes(level.key);
    const selectedClass = isSelected ? "selected" : "";
    const showX = isSelected && this.selectedLevels.length > 1;

    return `
      <button 
        class="level-btn ${selectedClass}" 
        data-level="${level.key}"
        type="button"
      >
        <span class="level-emoji">${level.emoji}</span>
        <span class="level-text">${level.label}</span>
        ${showX ? '<span class="level-remove">×</span>' : ""}
      </button>
    `;
  }

  /**
   * 이벤트 리스너 등록
   */
  attachEventListeners() {
    const buttons = this.container.querySelectorAll(".level-btn");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = btn.dataset.level;
        this.toggleLevel(level);
      });
    });
  }

  /**
   * 레벨 선택/해제 토글
   */
  toggleLevel(level) {
    const index = this.selectedLevels.indexOf(level);

    if (index > -1) {
      // 이미 선택된 경우: 제거 (단, 최소 1개는 유지)
      if (this.selectedLevels.length > 1) {
        this.selectedLevels.splice(index, 1);
      } else {
        // 마지막 하나는 제거 불가
        console.log("최소 1개의 레벨을 선택해야 합니다");
        return;
      }
    } else {
      // 선택되지 않은 경우: 추가
      if (this.allowMultiple) {
        this.selectedLevels.push(level);
      } else {
        // 단일 선택 모드
        this.selectedLevels = [level];
      }
    }

    // UI 업데이트
    this.render();

    // 콜백 호출
    if (this.onChange) {
      this.onChange(this.selectedLevels);
    }

    console.log("✅ 선택된 레벨:", this.selectedLevels);
  }

  /**
   * 선택된 레벨 텍스트
   */
  getSelectedText() {
    if (this.selectedLevels.length === 0) {
      return "未選択";
    }

    return this.selectedLevels
      .map((level) => {
        const levelData = this.levels.find((l) => l.key === level);
        return `${levelData?.emoji || ""} ${level}`;
      })
      .join(" + ");
  }

  /**
   * 현재 선택된 레벨 배열 반환
   */
  getSelected() {
    return [...this.selectedLevels];
  }

  /**
   * 프로그래밍 방식으로 레벨 설정
   */
  setLevels(levels) {
    if (!Array.isArray(levels) || levels.length === 0) {
      console.error("유효하지 않은 레벨 배열:", levels);
      return;
    }

    this.selectedLevels = levels.filter((level) =>
      this.levels.some((l) => l.key === level)
    );

    if (this.selectedLevels.length === 0) {
      this.selectedLevels = ["N1"]; // 폴백
    }

    this.render();
  }

  /**
   * 단일/복수 선택 모드 변경
   */
  setAllowMultiple(allow) {
    this.allowMultiple = allow;

    // 단일 모드로 전환 시, 첫 번째 레벨만 유지
    if (!allow && this.selectedLevels.length > 1) {
      this.selectedLevels = [this.selectedLevels[0]];
    }

    this.render();
  }

  /**
   * 컴포넌트 파괴
   */
  destroy() {
    this.container.innerHTML = "";
  }
}
