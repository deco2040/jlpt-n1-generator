/**
 * renderers/problemQuestionRenderer.js
 * 문제 선택지 렌더링 모듈
 */
import { escapeHtml } from "../utils/dom.js";

/**
 * 모든 문제 렌더링
 */
export function renderQuestions(questions) {
  return questions.map((q, idx) => renderSingleQuestion(q, idx)).join("");
}

/**
 * 개별 문제 렌더링
 */
function renderSingleQuestion(question, index) {
  return `
    <div class="question" data-question-index="${index}">
      <div class="question-text">
        <strong>❓ 問題 ${index + 1}</strong>
        <div style="margin-top: 8px; line-height: 1.6;">${escapeHtml(
          question.question
        )}</div>
      </div>
      <div class="options">
        ${renderOptions(question.options, index)}
      </div>
      <!-- 정답 표시 영역 (채점 후 표시) -->
      <div class="answer-feedback" data-answer-feedback="${index}" style="display: none;"></div>
    </div>
  `;
}

/**
 * 선택지 렌더링
 */
function renderOptions(options, questionIndex) {
  return options
    .map(
      (option, optIdx) => `
    <label class="option-label" data-opt="${optIdx}">
      <input 
        type="radio" 
        name="q_${questionIndex}" 
        value="${optIdx}" 
        data-question="${questionIndex}" 
        data-option="${optIdx}"
      >
      <span class="option-text">${optIdx + 1}. ${escapeHtml(option)}</span>
    </label>
  `
    )
    .join("");
}

/**
 * 문제 선택 핸들러 등록
 */
export function attachQuestionHandlers(container, questions) {
  const optionLabels = container.querySelectorAll(".option-label");

  optionLabels.forEach((label) => {
    label.addEventListener("click", (e) => {
      // 라디오 버튼이 자동으로 처리하므로 추가 로직 불필요
      // 필요시 선택 효과 추가 가능
      const radio = label.querySelector("input[type=radio]");
      if (radio) {
        // 시각적 피드백 (선택 시 하이라이트)
        highlightSelection(container, radio);
      }
    });
  });
}

/**
 * 선택 하이라이트
 */
function highlightSelection(container, selectedRadio) {
  const questionIndex = selectedRadio.dataset.question;
  const allLabels = container.querySelectorAll(`label[data-opt]`);

  allLabels.forEach((label) => {
    const radio = label.querySelector("input[type=radio]");
    if (radio && radio.name === selectedRadio.name) {
      if (radio === selectedRadio) {
        label.style.borderColor = "#667eea";
        label.style.backgroundColor = "#f0f4ff";
      } else {
        label.style.borderColor = "#e9ecef";
        label.style.backgroundColor = "white";
      }
    }
  });
}
