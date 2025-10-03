/* ============================================ */
/* public/js/managers/pdfPrintManager.js */
/* ============================================ */
/**
 * managers/pdfPrintManager.js
 * PDF 출력 관리
 */

import { analyzeProblemForPDF } from "../api/apiClient.js";
import { escapeHtml } from "../utils/dom.js";

class PDFPrintManager {
  async openPrintWindow(problem, metadata) {
    const today = new Date().toLocaleDateString("ja-JP");

    // 로딩 메시지 표시
    const loadingMsg = this.createLoadingMessage();
    document.body.appendChild(loadingMsg);

    try {
      // PDF용 분석 데이터 가져오기 (백엔드 API 호출)
      let analysis = null;
      try {
        analysis = await analyzeProblemForPDF(problem, metadata);
      } catch (error) {
        console.warn("PDF 분석 실패, 기본 정보로 생성:", error);
        // 분석 실패 시 기본 구조로 대체
        analysis = {
          translation: "翻訳データがありません",
          vocabulary: [],
          grammar: [],
        };
      }

      // 새 창 열기
      const printWindow = window.open("", "_blank", "width=800,height=600");

      if (!printWindow) {
        alert(
          "ポップアップがブロックされました。ポップアップを許可してください。"
        );
        return;
      }

      // PDF HTML 생성 및 출력
      const pdfHTML = this.generatePrintHTML(
        problem,
        metadata,
        analysis,
        today
      );
      printWindow.document.write(pdfHTML);
      printWindow.document.close();

      // 약간의 딜레이 후 인쇄 대화상자 열기
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert(`PDF生成エラー: ${error.message}`);
    } finally {
      document.body.removeChild(loadingMsg);
    }
  }

  createLoadingMessage() {
    const div = document.createElement("div");
    div.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 10000;
      text-align: center;
    `;
    div.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 10px;">📄 PDF作成中...</div>
      <div style="font-size: 14px; color: #666;">翻訳と分析を進行中です。</div>
    `;
    return div;
  }

  generatePrintHTML(problem, metadata, analysis, today) {
    const passageHTML = this.generatePassageHTML(problem);
    const questionsHTML = this.generateQuestionsHTML(problem.questions);
    const translationHTML = this.generateTranslationHTML(analysis);
    const answersHTML = this.generateAnswersHTML(problem.questions, analysis);
    const vocabularyHTML = this.generateVocabularyHTML(
      analysis.vocabulary || []
    );
    const grammarHTML = this.generateGrammarHTML(analysis.grammar || []);

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>JLPT 読解問題 - ${today}</title>
  <style>
    ${this.getPrintStyles()}
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>📖 JLPT 読解問題</h1>
      <div class="date">${today}</div>
    </div>
    ${passageHTML}
    ${questionsHTML}
  </div>
  
  <div class="page-break"></div>
  
  <div class="page">
    <div class="header">
      <h1>✅ 正答および解説</h1>
    </div>
    ${translationHTML}
    ${answersHTML}
    ${vocabularyHTML}
    ${grammarHTML}
  </div>
</body>
</html>`;
  }

  getPrintStyles() {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @media print {
        @page { size: A4; margin: 15mm; }
        .page-break { page-break-after: always; }
      }
      body {
        font-family: "Malgun Gothic", "맑은 고딕", "Yu Gothic", "游ゴシック", sans-serif;
        line-height: 1.7;
        color: #333;
        font-size: 11pt;
      }
      .page { padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { 
        border-bottom: 3px solid #667eea; 
        padding-bottom: 15px; 
        margin-bottom: 25px; 
      }
      .header h1 { 
        font-size: 24pt; 
        color: #667eea; 
        margin-bottom: 8px; 
      }
      .date { 
        font-size: 12pt; 
        color: #666; 
      }
      .passage-box { 
        background: #f8f9fa; 
        border-left: 4px solid #667eea; 
        padding: 15px; 
        margin-bottom: 25px; 
      }
      .passage-title { 
        font-weight: bold; 
        font-size: 12pt; 
        margin-bottom: 10px; 
        color: #667eea; 
      }
      .passage-text { 
        line-height: 2; 
        font-size: 11pt; 
      }
      .question-box { 
        margin-bottom: 20px; 
        padding: 15px; 
        background: #f8f9fa; 
        border-radius: 4px; 
      }
      .question-title { 
        font-weight: bold; 
        margin-bottom: 10px; 
        font-size: 11pt; 
      }
      .option { 
        margin: 5px 0; 
        padding: 8px; 
        border: 1px solid #e2e8f0; 
        border-radius: 4px; 
      }
      .answer-box { 
        background: #d1fae5; 
        padding: 15px; 
        margin-bottom: 15px; 
        border-left: 4px solid #10b981; 
        border-radius: 4px; 
      }
      .answer-title { 
        font-weight: bold; 
        color: #065f46; 
        margin-bottom: 5px; 
      }
      .translation-box { 
        background: #fffbeb; 
        padding: 15px; 
        margin-bottom: 25px; 
        border-left: 4px solid #f59e0b; 
        border-radius: 4px; 
      }
      .section-title { 
        font-weight: bold; 
        font-size: 13pt; 
        margin: 20px 0 10px; 
        color: #667eea; 
      }
      .vocab-item, .grammar-item { 
        padding: 10px; 
        margin-bottom: 10px; 
        background: #f8f9fa; 
        border-radius: 4px; 
      }
      .vocab-word { 
        font-weight: bold; 
        color: #667eea; 
      }
    `;
  }

  generatePassageHTML(problem) {
    return `
      <div class="passage-box">
        <div class="passage-title">📖 本文</div>
        <div class="passage-text">${escapeHtml(problem.passage).replace(
          /\n/g,
          "<br>"
        )}</div>
      </div>
    `;
  }

  generateQuestionsHTML(questions) {
    return questions
      .map(
        (q, idx) => `
      <div class="question-box">
        <div class="question-title">問${idx + 1}. ${escapeHtml(
          q.question
        )}</div>
        ${q.options
          .map(
            (opt, optIdx) => `
          <div class="option">${optIdx + 1}. ${escapeHtml(opt)}</div>
        `
          )
          .join("")}
      </div>
    `
      )
      .join("");
  }

  generateTranslationHTML(analysis) {
    if (!analysis || !analysis.translation) {
      return "";
    }

    return `
      <div class="translation-box">
        <div class="section-title">📝 翻訳</div>
        <div>${escapeHtml(analysis.translation).replace(/\n/g, "<br>")}</div>
      </div>
    `;
  }

  generateAnswersHTML(questions, analysis) {
    return questions
      .map(
        (q, idx) => `
      <div class="answer-box">
        <div class="answer-title">問${idx + 1}の正答</div>
        <div><strong>正解:</strong> ${q.correct + 1}. ${escapeHtml(
          q.options[q.correct]
        )}</div>
        ${
          q.explanation
            ? `<div style="margin-top: 10px;"><strong>解説:</strong> ${escapeHtml(
                q.explanation
              )}</div>`
            : ""
        }
      </div>
    `
      )
      .join("");
  }

  generateVocabularyHTML(vocabulary) {
    if (!vocabulary || vocabulary.length === 0) {
      return "";
    }

    return `
      <div class="section-title">📚 重要語彙</div>
      ${vocabulary
        .map(
          (item) => `
        <div class="vocab-item">
          <span class="vocab-word">${escapeHtml(item.word || "")}</span>
          ${item.reading ? `<span> (${escapeHtml(item.reading)})</span>` : ""}
          ${item.meaning ? `<div>${escapeHtml(item.meaning)}</div>` : ""}
        </div>
      `
        )
        .join("")}
    `;
  }

  generateGrammarHTML(grammar) {
    if (!grammar || grammar.length === 0) {
      return "";
    }

    return `
      <div class="section-title">📐 重要文法</div>
      ${grammar
        .map(
          (item) => `
        <div class="grammar-item">
          <div><strong>${escapeHtml(item.pattern || "")}</strong></div>
          ${
            item.explanation ? `<div>${escapeHtml(item.explanation)}</div>` : ""
          }
        </div>
      `
        )
        .join("")}
    `;
  }
}

export const pdfPrintManager = new PDFPrintManager();
