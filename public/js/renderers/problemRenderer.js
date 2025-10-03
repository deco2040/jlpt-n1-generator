/**
 * renderers/problemRenderer.js
 * 문제 렌더링 및 상호작용 (generate-reading.client.js 기능 통합)
 */
import { learningManager } from "../managers/learningManager.js";
import { pdfPrintManager } from "../managers/pdfPrintManager.js";
import { escapeHtml } from "../utils/dom.js";

/**
 * 문제 렌더링 메인 함수
 * @param {HTMLElement} container - 출력할 컨테이너
 * @param {Object} data - { problem, metadata }
 */
export function renderProblem(container, data) {
  const { problem, metadata } = data;

  if (!problem) {
    container.innerHTML = `<div style="color: red;">生成失敗</div>`;
    return;
  }

  const { passage, passages, questions } = problem;
  const { level, selectedLevel, lengthKey, subtypeKey } = metadata || {};

  const displayLevel = selectedLevel || level || "N1";

  // 본문 렌더링
  const passageHTML = renderPassage(passage, passages);

  // 문제 렌더링
  const questionsHTML = renderQuestions(questions);

  const html = `
    <div class="problem-container">
      <!-- 본문 -->
      ${passageHTML}

      <!-- 문제들 -->
      <div class="questions-container">
        ${questionsHTML}
      </div>

      <!-- 채점 버튼 -->
      <div style="margin-top: 24px; text-align: center;">
        <button 
          class="submit-btn" 
          data-submit-btn
          style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.3s;"
        >
          ✓ 채점 하기
        </button>
      </div>

      <!-- PDF 출력 버튼 (채점 버튼 밑) -->
      <div style="margin-top: 16px; text-align: center;">
        <button 
          class="pdf-btn" 
          data-pdf-btn
          style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.3s;"
        >
          📄 PDF 출력
        </button>
      </div>

      <!-- 결과 표시 영역 -->
      <div class="result-area" data-result-area style="margin-top: 20px;"></div>
    </div>
  `;

  container.innerHTML = html;

  // 이벤트 리스너 등록
  attachEventListeners(container, problem, questions, metadata);
}

/**
 * 본문 렌더링
 */
function renderPassage(passage, passages) {
  // comparative 타입: passages.A, passages.B 형태
  if (passages && typeof passages === "object" && passages.A) {
    return `
      <div class="passage">
        <div style="display: flex; flex-direction: column; gap: 0;">
          <div>
            <div class="passage-title">📖 本文A</div>
            <div class="passage-text">${escapeHtml(passages.A)}</div>
          </div>
          <div>
            <div class="passage-title">📖 本文B</div>
            <div class="passage-text">${escapeHtml(passages.B)}</div>
          </div>
        </div>
      </div>
    `;
  }

  // practical 타입: passages 배열 형태
  if (passages && Array.isArray(passages) && passages.length > 0) {
    return `
      <div class="passage">
        ${passages
          .map(
            (p, i) => `
          <div>
            <div class="passage-title">📄 文書${i + 1}</div>
            <div class="passage-text">${escapeHtml(p)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  // 일반 타입: 단일 passage
  if (passage) {
    return `
      <div class="passage">
        <div class="passage-title">📖 本文</div>
        <div class="passage-text">${escapeHtml(passage)}</div>
      </div>
    `;
  }

  return "";
}

/**
 * 문제 렌더링
 */
function renderQuestions(questions) {
  if (!questions || questions.length === 0) {
    return `<div style="color: #999;">問題データがありません</div>`;
  }

  return questions
    .map(
      (q, i) => `
    <div class="question" data-question="${i}">
      <div class="question-text">
        <strong>問 ${i + 1}</strong> ${escapeHtml(q.question)}
      </div>
      <div class="options">
        ${q.options
          .map(
            (opt, oi) => `
          <label class="option-label">
            <input 
              type="radio" 
              name="q${i}" 
              value="${oi + 1}"
              data-question-index="${i}"
              data-option-index="${oi}"
            />
            <span>${oi + 1}. ${escapeHtml(opt)}</span>
          </label>
        `
          )
          .join("")}
      </div>
    </div>
  `
    )
    .join("");
}

/**
 * 이벤트 리스너 부착
 */
function attachEventListeners(container, problem, questions, metadata) {
  const submitBtn = container.querySelector("[data-submit-btn]");
  const pdfBtn = container.querySelector("[data-pdf-btn]");

  // PDF 버튼 중복 클릭 방지 플래그
  let pdfClicked = false;

  // 채점 버튼
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      handleSubmit(container, problem, questions, metadata);
    });
  }

  // PDF 출력 버튼 (한 번만 클릭 유효)
  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      if (pdfClicked) {
        alert("PDFは既に出力されています");
        return;
      }
      pdfClicked = true;
      pdfBtn.disabled = true;
      pdfBtn.style.opacity = "0.5";
      pdfBtn.style.cursor = "not-allowed";
      pdfPrintManager.openPrintWindow(problem, metadata);
    });
  }
}

/**
 * 채점 처리
 */
function handleSubmit(container, problem, questions, metadata) {
  const resultArea = container.querySelector("[data-result-area]");
  const submitBtn = container.querySelector("[data-submit-btn]");

  if (!resultArea) return;

  // 사용자 답안 수집
  const userAnswers = [];
  for (let i = 0; i < questions.length; i++) {
    const selected = container.querySelector(`input[name="q${i}"]:checked`);
    userAnswers.push(selected ? parseInt(selected.value) : null);
  }

  // 미답 체크
  const unanswered = userAnswers.some((a) => a === null);
  if (unanswered) {
    alert("全ての問題に回答してください");
    return;
  }

  // 정답 확인
  let correctCount = 0;
  const results = questions.map((q, i) => {
    const isCorrect = userAnswers[i] === q.correctAnswer;
    if (isCorrect) correctCount++;
    return isCorrect;
  });

  const totalQuestions = questions.length;
  const accuracy = Math.round((correctCount / totalQuestions) * 100);

  // 학습 기록 저장
  learningManager.recordAttempt({
    level: metadata.selectedLevel || metadata.level || "N1",
    lengthKey: metadata.lengthKey || "medium",
    correctCount,
    totalQuestions,
    timestamp: Date.now(),
  });

  // 결과 표시
  displayResults(
    resultArea,
    questions,
    userAnswers,
    results,
    correctCount,
    totalQuestions,
    accuracy
  );

  // 채점 버튼 비활성화
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.5";
    submitBtn.style.cursor = "not-allowed";
  }

  // 문제에 정답/오답 표시
  highlightAnswers(container, questions, results);

  // 통계 업데이트 이벤트 발행
  window.dispatchEvent(new CustomEvent("statsUpdated"));
}

/**
 * 결과 표시
 */
function displayResults(
  resultArea,
  questions,
  userAnswers,
  results,
  correctCount,
  totalQuestions,
  accuracy
) {
  const html = `
    <!-- 해설 섹션 -->
    <div class="explanation-section" style="margin-top: 20px;">
      ${questions
        .map(
          (q, i) => `
        <div class="explanation-item" style="background: white; border: 2px solid ${
          results[i] ? "#28a745" : "#dc3545"
        }; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="font-weight: 600; color: ${
            results[i] ? "#28a745" : "#dc3545"
          }; margin-bottom: 8px;">
            問 ${i + 1}: ${results[i] ? "✓ 正解" : "✗ 不正解"}
          </div>
          <div style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px;">問題:</div>
            <div>${escapeHtml(q.question)}</div>
          </div>
          <div style="margin-bottom: 8px;">
            <span style="color: #666;">あなたの回答:</span> <strong>${
              userAnswers[i]
            }</strong> 
            <span style="margin: 0 8px;">|</span> 
            <span style="color: #666;">正解:</span> <strong style="color: #28a745;">${
              q.correctAnswer
            }</strong>
          </div>
          <div style="margin-top: 12px; padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
            <div style="font-weight: 600; color: #856404; margin-bottom: 8px;">💡 解説:</div>
            <div style="color: #856404; line-height: 1.6;">${escapeHtml(
              q.explanation || "解説なし"
            )}</div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>

    <!-- 다음 문제 생성 버튼 -->
    <div style="margin-top: 24px; text-align: center;">
      <button 
        class="generate-next-btn" 
        data-generate-next-btn
        style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.3s;"
      >
        🔄 다시 문제 생성하기
      </button>
    </div>
  `;

  resultArea.innerHTML = html;

  // 다음 문제 생성 버튼 이벤트 리스너
  const generateNextBtn = resultArea.querySelector("[data-generate-next-btn]");
  if (generateNextBtn) {
    generateNextBtn.addEventListener("click", () => {
      generateNextProblem();
    });
  }
}

/**
 * 다음 문제 생성 (페이지 새로고침 없이)
 */
async function generateNextProblem() {
  const generateBtn = document.querySelector("[data-generate-btn]");
  if (generateBtn) {
    generateBtn.click();
  }
}

/**
 * 정답/오답 하이라이트
 */
function highlightAnswers(container, questions, results) {
  questions.forEach((q, i) => {
    const questionEl = container.querySelector(`[data-question="${i}"]`);
    if (!questionEl) return;

    const labels = questionEl.querySelectorAll(".option-label");
    labels.forEach((label, oi) => {
      const input = label.querySelector("input");
      input.disabled = true;

      // 정답 표시
      if (oi + 1 === q.correctAnswer) {
        label.style.borderColor = "#28a745";
        label.style.backgroundColor = "#d4edda";
      }

      // 오답 표시 (사용자가 선택한 경우)
      if (input.checked && !results[i]) {
        label.style.borderColor = "#dc3545";
        label.style.backgroundColor = "#f8d7da";
      }
    });
  });
}

/**
 * 길이 레이블 변환
 */
function getLengthLabel(lengthKey) {
  const labels = {
    "ultra-short": "超短文 (50字以下)",
    short: "短文 (50-150字)",
    medium: "中文 (150-250字)",
    long: "長文 (250-400字)",
    "ultra-long": "超長文 (400字以上)",
  };
  return labels[lengthKey] || "中文";
}
