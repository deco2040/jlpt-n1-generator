/**
 * renderers/problemAnswerRenderer.js
 * 채점 및 결과 렌더링 모듈
 */
import { learningManager } from "../managers/learningManager.js";
import { escapeHtml } from "../utils/dom.js";

/**
 * 채점 UI 렌더링
 */
export function renderAnswerUI(questionCount) {
  return `
    <div style="margin-top: 24px; text-align: center;">
      <button 
        class="submit-btn" 
        data-submit-btn
        style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.3s;"
      >
        ✓ 채점하기
      </button>
    </div>
    <div class="result-area" data-result-area style="margin-top: 20px;"></div>
  `;
}

/**
 * 채점 핸들러 등록
 */
export function attachAnswerHandlers(
  container,
  problem,
  questions,
  metadata,
  updateStatsCallback
) {
  const submitBtn = container.querySelector("[data-submit-btn]");
  const resultArea = container.querySelector("[data-result-area]");

  if (!submitBtn || !resultArea) return;

  submitBtn.addEventListener("click", () => {
    gradeAnswers(
      container,
      problem,
      questions,
      metadata,
      submitBtn,
      resultArea,
      updateStatsCallback
    );
  });
}

/**
 * 채점 실행
 */
function gradeAnswers(
  container,
  problem,
  questions,
  metadata,
  submitBtn,
  resultArea,
  updateStatsCallback
) {
  const userAnswers = collectUserAnswers(container, questions.length);

  // 미답변 체크
  if (userAnswers.includes(null)) {
    alert("모든 문제에 답변했는지 확인해주세요.");
    return;
  }

  // 채점
  const results = questions.map((q, idx) => ({
    ok: userAnswers[idx] === q.correctAnswer,
    user: userAnswers[idx],
    correct: q.correctAnswer,
    explanation: q.explanation || "",
  }));

  const correct = results.filter((r) => r.ok).length;
  const total = questions.length;
  const percentage = Math.round((correct / total) * 100);

  // 각 문제에 정답/오답 표시
  displayAnswerFeedback(container, results, questions);

  // 결과 메시지 표시
  displayResultMessage(resultArea, correct, total, percentage);

  // 학습 기록 저장
  const category = metadata.subtypeKey || "reading";
  learningManager.record(category, correct, total, results);

  // 통계 업데이트
  if (updateStatsCallback) {
    updateStatsCallback(container);
  }

  // 버튼 비활성화
  submitBtn.disabled = true;
  submitBtn.style.opacity = "0.6";
  submitBtn.textContent = "採点完了";

  // 결과로 스크롤
  resultArea.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * 사용자 답변 수집
 */
function collectUserAnswers(container, questionCount) {
  const answers = [];

  for (let i = 0; i < questionCount; i++) {
    const selected = container.querySelector(`input[name="q_${i}"]:checked`);
    answers.push(selected ? parseInt(selected.value) : null);
  }

  return answers;
}

/**
 * 각 문제에 정답/오답 피드백 표시
 */
function displayAnswerFeedback(container, results, questions) {
  results.forEach((result, idx) => {
    const feedbackDiv = container.querySelector(
      `[data-answer-feedback="${idx}"]`
    );
    if (!feedbackDiv) return;

    const question = questions[idx];
    const correctOptionText = question.options[question.correctAnswer];
    const userOptionText =
      result.user !== null ? question.options[result.user] : "";

    if (result.ok) {
      feedbackDiv.innerHTML = `
        <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 12px; margin-top: 12px; border-radius: 4px;">
          <strong style="color: #155724;">✓ 正解！</strong>
          <div style="margin-top: 6px; font-size: 14px; color: #155724;">
            答え: ${result.correct + 1}. ${escapeHtml(correctOptionText)}
          </div>
          ${
            result.explanation
              ? `
            <div style="margin-top: 8px; font-size: 13px; color: #155724; border-top: 1px solid #c3e6cb; padding-top: 8px;">
              <strong>解説:</strong> ${escapeHtml(result.explanation)}
            </div>
          `
              : ""
          }
        </div>
      `;
    } else {
      feedbackDiv.innerHTML = `
        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 12px; margin-top: 12px; border-radius: 4px;">
          <strong style="color: #721c24;">✗ 不正解</strong>
          <div style="margin-top: 6px; font-size: 14px; color: #721c24;">
            あなたの答え: ${result.user + 1}. ${escapeHtml(userOptionText)}
          </div>
          <div style="margin-top: 4px; font-size: 14px; color: #155724; background: #d4edda; padding: 8px; border-radius: 4px; margin-top: 8px;">
            <strong>正解:</strong> ${result.correct + 1}. ${escapeHtml(
        correctOptionText
      )}
          </div>
          ${
            result.explanation
              ? `
            <div style="margin-top: 8px; font-size: 13px; color: #721c24; border-top: 1px solid #f5c6cb; padding-top: 8px;">
              <strong>解説:</strong> ${escapeHtml(result.explanation)}
            </div>
          `
              : ""
          }
        </div>
      `;
    }

    feedbackDiv.style.display = "block";
  });
}

/**
 * 결과 메시지 표시
 */
function displayResultMessage(resultArea, correct, total, percentage) {
  let bgGradient, textColor, emoji, message;

  if (percentage >= 90) {
    bgGradient = "linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)";
    textColor = "#155724";
    emoji = "🎉";
    message = "完璧です！";
  } else if (percentage >= 70) {
    bgGradient = "linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%)";
    textColor = "#0c5460";
    emoji = "👍";
    message = "良いです！";
  } else if (percentage >= 50) {
    bgGradient = "linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%)";
    textColor = "#856404";
    emoji = "💪";
    message = "もう少し！";
  } else {
    bgGradient = "linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)";
    textColor = "#721c24";
    emoji = "📚";
    message = "復習しましょう";
  }

  resultArea.style.background = bgGradient;
  resultArea.style.color = textColor;
  resultArea.style.padding = "24px";
  resultArea.style.borderRadius = "12px";
  resultArea.style.fontSize = "20px";
  resultArea.style.fontWeight = "700";
  resultArea.style.textAlign = "center";
  resultArea.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";

  resultArea.innerHTML = `${emoji} ${message} ${correct}/${total}問 (${percentage}%)`;
}
