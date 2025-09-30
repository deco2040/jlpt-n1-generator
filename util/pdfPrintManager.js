// utils/pdfPrintManager.js

class PDFPrintManager {
  constructor() {
    this.problem = null;
    this.metadata = null;
  }

  // 문제 데이터 설정
  setProblemData(problem, metadata) {
    this.problem = problem;
    this.metadata = metadata;
  }

  // PDF 인쇄 창 열기
  async openPrintWindow() {
    if (!this.problem) {
      alert("문제 데이터가 없습니다.");
      return;
    }

    // 한국어 번역 생성 (AI 번역)
    const translations = await this.generateTranslations();

    // 새 창 생성
    const printWindow = window.open("", "_blank", "width=800,height=600");

    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업을 허용해주세요.");
      return;
    }

    // HTML 생성
    const html = this.generatePrintHTML(translations);

    printWindow.document.write(html);
    printWindow.document.close();

    // 로드 완료 후 인쇄 다이얼로그
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }

  // 한국어 번역 생성
  async generateTranslations() {
    // 실제로는 Claude API를 호출해서 번역
    // 지금은 시뮬레이션
    return {
      passage: this.problem.passage
        ? "【본문 한국어 번역】\n(실제 서비스에서는 AI가 자동 번역합니다)"
        : null,
      passageA: this.problem.passages?.A
        ? "【본문A 한국어 번역】\n(실제 서비스에서는 AI가 자동 번역합니다)"
        : null,
      passageB: this.problem.passages?.B
        ? "【본문B 한국어 번역】\n(실제 서비스에서는 AI가 자동 번역합니다)"
        : null,
      vocabulary: this.extractVocabulary(),
      grammar: this.extractGrammar(),
    };
  }

  // 어휘 추출 (N1 수준 단어)
  extractVocabulary() {
    // 실제로는 형태소 분석으로 N1 어휘 추출
    return [
      {
        word: "例示単語１",
        reading: "れいじたんご",
        meaning: "예시 단어 1",
        level: "N1",
      },
      {
        word: "例示単語２",
        reading: "れいじたんご",
        meaning: "예시 단어 2",
        level: "N1",
      },
      {
        word: "例示単語３",
        reading: "れいじたんご",
        meaning: "예시 단어 3",
        level: "N1",
      },
    ];
  }

  // 문법 추출 (N1 문법)
  extractGrammar() {
    // 실제로는 패턴 매칭으로 N1 문법 추출
    return [
      {
        pattern: "～にもかかわらず",
        meaning: "~에도 불구하고",
        example: "雨にもかかわらず、試合は続けられた。",
      },
      {
        pattern: "～ざるを得ない",
        meaning: "~하지 않을 수 없다",
        example: "この状況では認めざるを得ない。",
      },
    ];
  }

  // 인쇄용 HTML 생성
  generatePrintHTML(translations) {
    const today = new Date().toLocaleDateString("ja-JP");

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JLPT N1 読解問題 - ${today}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @media print {
      @page { 
        size: A4;
        margin: 15mm;
      }
      .page-break { page-break-after: always; }
      body { font-size: 11pt; }
    }
    
    body {
      font-family: "Yu Gothic", "游ゴシック", "Hiragino Kaku Gothic ProN", "メイリオ", sans-serif;
      line-height: 1.7;
      color: #333;
    }
    
    /* 1페이지: 문제지 */
    .problem-page {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    
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
    
    .header-info {
      display: flex;
      justify-content: space-between;
      font-size: 10pt;
      color: #666;
    }
    
    .site-info {
      font-size: 9pt;
      color: #999;
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
      white-space: pre-wrap;
    }
    
    .question-box {
      margin-bottom: 25px;
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 4px;
    }
    
    .question-number {
      font-size: 14pt;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 10px;
    }
    
    .question-text {
      margin-bottom: 15px;
      line-height: 1.8;
    }
    
    .options {
      margin-left: 20px;
    }
    
    .option {
      margin-bottom: 10px;
      line-height: 1.8;
    }
    
    .answer-space {
      margin-top: 15px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 4px;
    }
    
    /* 2페이지: 해설지 */
    .answer-page {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .answer-header {
      border-bottom: 3px solid #28a745;
      padding-bottom: 15px;
      margin-bottom: 25px;
    }
    
    .answer-header h1 {
      font-size: 24pt;
      color: #28a745;
      margin-bottom: 8px;
    }
    
    .translation-box {
      background: #e7f3ff;
      border-left: 4px solid #007bff;
      padding: 15px;
      margin-bottom: 25px;
    }
    
    .translation-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 10px;
      color: #007bff;
    }
    
    .answer-box {
      margin-bottom: 25px;
      background: #d4edda;
      border-left: 4px solid #28a745;
      padding: 15px;
    }
    
    .correct-answer {
      font-size: 13pt;
      font-weight: bold;
      color: #155724;
      margin-bottom: 10px;
    }
    
    .explanation {
      margin-top: 10px;
      line-height: 1.8;
    }
    
    .vocabulary-section, .grammar-section {
      margin-top: 25px;
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 4px;
    }
    
    .section-title {
      font-size: 13pt;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 15px;
      border-bottom: 2px solid #667eea;
      padding-bottom: 5px;
    }
    
    .vocab-item, .grammar-item {
      margin-bottom: 12px;
      padding-left: 15px;
      border-left: 3px solid #e9ecef;
      padding-top: 5px;
      padding-bottom: 5px;
    }
    
    .vocab-word {
      font-size: 12pt;
      font-weight: bold;
      color: #333;
    }
    
    .vocab-reading {
      font-size: 10pt;
      color: #666;
      margin-left: 5px;
    }
    
    .vocab-meaning {
      font-size: 10pt;
      color: #555;
      margin-top: 3px;
    }
    
    .grammar-pattern {
      font-size: 11pt;
      font-weight: bold;
      color: #333;
    }
    
    .grammar-meaning {
      font-size: 10pt;
      color: #555;
      margin-top: 3px;
    }
    
    .grammar-example {
      font-size: 9pt;
      color: #666;
      margin-top: 5px;
      font-style: italic;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 9pt;
      color: #999;
    }
  </style>
</head>
<body>
  <!-- 1페이지: 문제지 -->
  <div class="problem-page">
    <div class="header">
      <h1>📖 JLPT N1 読解問題</h1>
      <div class="header-info">
        <span>日付: ${today}</span>
        <span>レベル: ${this.metadata.lengthLabel || "N1"}</span>
        <span>問題数: ${this.problem.questions?.length || 0}問</span>
      </div>
      <div class="site-info">
        Generated by JLPT N1 Reading Practice - https://your-site.com
      </div>
    </div>
    
    ${this.generatePassageHTML()}
    ${this.generateQuestionsHTML()}
    
    <div class="answer-space">
      <strong>解答欄:</strong> 
      ${this.problem.questions
        ?.map((_, i) => `問題${i + 1}: (    )`)
        .join("　")}
    </div>
    
    <div class="footer">
      このプリントは学習目的でのみ使用してください。
    </div>
  </div>
  
  <!-- 페이지 구분 -->
  <div class="page-break"></div>
  
  <!-- 2페이지: 해설지 -->
  <div class="answer-page">
    <div class="answer-header">
      <h1>✅ 解答・解説</h1>
      <div class="header-info">
        <span>カテゴリー: ${this.metadata.category || ""}</span>
      </div>
    </div>
    
    ${this.generateTranslationHTML(translations)}
    ${this.generateAnswersHTML()}
    ${this.generateVocabularyHTML(translations.vocabulary)}
    ${this.generateGrammarHTML(translations.grammar)}
    
    <div class="footer">
      頑張ってください！ 🎓
    </div>
  </div>
</body>
</html>`;
  }

  // 지문 HTML 생성
  generatePassageHTML() {
    if (this.problem.passage) {
      return `
        <div class="passage-box">
          <div class="passage-title">📄 本文</div>
          <div class="passage-text">${this.escapeHtml(
            this.problem.passage
          )}</div>
        </div>`;
    }

    if (this.problem.passages?.A) {
      return `
        <div class="passage-box">
          <div class="passage-title">📄 本文A</div>
          <div class="passage-text">${this.escapeHtml(
            this.problem.passages.A
          )}</div>
        </div>
        <div class="passage-box">
          <div class="passage-title">📄 本文B</div>
          <div class="passage-text">${this.escapeHtml(
            this.problem.passages.B
          )}</div>
        </div>`;
    }

    if (Array.isArray(this.problem.passages)) {
      return this.problem.passages
        .map(
          (p, i) => `
        <div class="passage-box">
          <div class="passage-title">📄 文書${i + 1}</div>
          <div class="passage-text">${this.escapeHtml(p)}</div>
        </div>
      `
        )
        .join("");
    }

    return "";
  }

  // 문제 HTML 생성
  generateQuestionsHTML() {
    return (this.problem.questions || [])
      .map(
        (q, i) => `
      <div class="question-box">
        <div class="question-number">❓ 問題 ${i + 1}</div>
        <div class="question-text">${this.escapeHtml(q.question)}</div>
        <div class="options">
          ${(q.options || [])
            .map(
              (opt, j) => `
            <div class="option">${j + 1}. ${this.escapeHtml(opt)}</div>
          `
            )
            .join("")}
        </div>
      </div>
    `
      )
      .join("");
  }

  // 번역 HTML 생성
  generateTranslationHTML(translations) {
    let html = "";

    if (translations.passage) {
      html += `
        <div class="translation-box">
          <div class="translation-title">🇰🇷 本文の韓国語訳</div>
          <div>${this.escapeHtml(translations.passage)}</div>
        </div>`;
    }

    if (translations.passageA) {
      html += `
        <div class="translation-box">
          <div class="translation-title">🇰🇷 本文Aの韓国語訳</div>
          <div>${this.escapeHtml(translations.passageA)}</div>
        </div>`;
    }

    if (translations.passageB) {
      html += `
        <div class="translation-box">
          <div class="translation-title">🇰🇷 本文Bの韓国語訳</div>
          <div>${this.escapeHtml(translations.passageB)}</div>
        </div>`;
    }

    return html;
  }

  // 정답 및 해설 HTML 생성
  generateAnswersHTML() {
    return (this.problem.questions || [])
      .map(
        (q, i) => `
      <div class="answer-box">
        <div class="correct-answer">✅ 問題${i + 1}の正解: ${
          q.correctAnswer + 1
        }番</div>
        ${
          q.explanation
            ? `
          <div class="explanation">
            <strong>💡 解説:</strong><br>
            ${this.escapeHtml(q.explanation)}
          </div>
        `
            : ""
        }
      </div>
    `
      )
      .join("");
  }

  // 어휘 HTML 생성
  generateVocabularyHTML(vocabulary) {
    return `
      <div class="vocabulary-section">
        <div class="section-title">📚 重要語彙 (N1レベル)</div>
        ${vocabulary
          .map(
            (v) => `
          <div class="vocab-item">
            <div>
              <span class="vocab-word">${v.word}</span>
              <span class="vocab-reading">[${v.reading}]</span>
            </div>
            <div class="vocab-meaning">意味: ${v.meaning}</div>
          </div>
        `
          )
          .join("")}
      </div>`;
  }

  // 문법 HTML 생성
  generateGrammarHTML(grammar) {
    return `
      <div class="grammar-section">
        <div class="section-title">📖 重要文法</div>
        ${grammar
          .map(
            (g) => `
          <div class="grammar-item">
            <div class="grammar-pattern">${g.pattern}</div>
            <div class="grammar-meaning">意味: ${g.meaning}</div>
            <div class="grammar-example">例: ${g.example}</div>
          </div>
        `
          )
          .join("")}
      </div>`;
  }

  escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// 싱글톤 인스턴스
const pdfPrintManager = new PDFPrintManager();

export default pdfPrintManager;

// 브라우저 전역으로도 사용 가능
if (typeof window !== "undefined") {
  window.pdfPrintManager = pdfPrintManager;
}
