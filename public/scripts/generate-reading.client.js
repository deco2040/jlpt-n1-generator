// public/scripts/generate-reading.client.js
const API_ENDPOINT = "/api/generate-reading";

// ===== 학습 관리자 =====
class LearningManager {
  constructor() {
    this.key = "jlpt_n1_data";
    this.data = this.load();
  }

  load() {
    try {
      const s = localStorage.getItem(this.key);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return {
      total: 0,
      correct: 0,
      history: [],
      weak: {},
      streak: 0,
      lastDate: null,
    };
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) {}
  }

  record(cat, correct, total, results) {
    const today = new Date().toISOString().split("T")[0];
    this.data.total += total;
    this.data.correct += correct;

    this.data.history.unshift({
      date: new Date().toISOString(),
      cat,
      correct,
      total,
      acc: Math.round((correct / total) * 100),
    });

    if (this.data.history.length > 50)
      this.data.history = this.data.history.slice(0, 50);

    results.forEach((r) => {
      const a = cat || "other";
      if (!this.data.weak[a]) this.data.weak[a] = { w: 0, t: 0 };
      this.data.weak[a].t++;
      if (!r.ok) this.data.weak[a].w++;
    });

    if (this.data.lastDate === today) {
    } else if (this.isYday(this.data.lastDate)) {
      this.data.streak++;
      this.data.lastDate = today;
    } else {
      this.data.streak = 1;
      this.data.lastDate = today;
    }

    this.save();
  }

  isYday(d) {
    if (!d) return false;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return d === y.toISOString().split("T")[0];
  }

  stats() {
    const acc =
      this.data.total > 0
        ? Math.round((this.data.correct / this.data.total) * 100)
        : 0;
    return {
      total: this.data.total,
      correct: this.data.correct,
      acc,
      streak: this.data.streak,
    };
  }
}

const lm = new LearningManager();

// ===== 유틸리티 함수 =====
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`Failed ${url}`);
  return r.json();
}

// ===== PDF 출력 시스템 =====
async function openPrintWindow(problem, metadata) {
  const today = new Date().toLocaleDateString("ja-JP");

  // 로딩 표시
  const loadingMsg = document.createElement("div");
  loadingMsg.style.cssText =
    "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 10000; text-align: center;";
  loadingMsg.innerHTML =
    '<div style="font-size: 18px; margin-bottom: 10px;">📄 PDF 작성중...</div><div style="font-size: 14px; color: #666;">번역과 분석 진행중입니다. (오래 걸릴 수 있습니다.)</div>';
  document.body.appendChild(loadingMsg);

  try {
    // AI 분석
    const analysis = await analyzeForPDF(problem, metadata);

    const printWindow = window.open("", "_blank", "width=800,height=600");

    if (!printWindow) {
      alert(
        "ポップアップがブロックされました。ポップアップを許可してください。"
      );
      return;
    }

    const html = generatePrintHTML(problem, metadata, analysis, today);

    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } catch (e) {
    console.error("PDF生成エラー:", e);
    alert("PDF生成に失敗しました: " + e.message);
  } finally {
    document.body.removeChild(loadingMsg);
  }
}

async function analyzeForPDF(problem, metadata) {
  try {
    // 백엔드 API 호출
    const response = await fetch("/api/analyze-for-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ problem, metadata }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.analysis) {
      return data.analysis;
    } else {
      throw new Error("Analysis failed");
    }
  } catch (e) {
    console.error("AI分析エラー:", e);

    // 폴백: 에러 시 기본 데이터 반환
    return {
      translation: `【한국어 번역】\n\n※ AI 번역 서비스에 일시적인 문제가 발생했습니다.\n본문을 학습하시고, 나중에 다시 시도해주세요.\n\n일본어 원문을 읽으면서 학습하실 수 있습니다.`,
      questionExplanations: problem.questions.map((q, i) => ({
        questionNumber: i + 1,
        correctAnswer: q.correctAnswer + 1,
        explanation: q.explanation || "해설을 생성할 수 없습니다.",
        whyWrong: {},
        keyPoint: "이 문제의 핵심을 파악하세요.",
      })),
      vocabulary: [
        {
          word: "重要",
          reading: "じゅうよう",
          meaning: "중요한",
          level: "N1",
          example: "重要な問題について話し合う",
        },
        {
          word: "顕著",
          reading: "けんちょ",
          meaning: "현저한, 뚜렷한",
          level: "N1",
          example: "顕著な効果が見られる",
        },
        {
          word: "懸念",
          reading: "けねん",
          meaning: "우려, 염려",
          level: "N1",
          example: "環境問題への懸念が高まる",
        },
        {
          word: "相違",
          reading: "そうい",
          meaning: "차이, 상위",
          level: "N1",
          example: "認識の相違がある",
        },
        {
          word: "齟齬",
          reading: "そご",
          meaning: "어긋남, 모순",
          level: "N1",
          example: "説明に齟齬がある",
        },
      ],
      grammar: [
        {
          pattern: "～にもかかわらず",
          meaning: "~에도 불구하고",
          example: "雨にもかかわらず、試合は続けられた。",
          usage: "역접을 나타내는 표현입니다. '～のに'보다 딱딱한 표현입니다.",
        },
        {
          pattern: "～ざるを得ない",
          meaning: "~하지 않을 수 없다",
          example: "この状況では認めざるを得ない。",
          usage: "어쩔 수 없이 무언가를 해야 할 필요가 있을 때 사용합니다.",
        },
        {
          pattern: "～に際して",
          meaning: "~에 즈음하여, ~할 때",
          example: "卒業に際して、感謝の言葉を述べた。",
          usage: "특별한 장면이나 중요한 때에 사용합니다.",
        },
      ],
      keyExpressions: [
        {
          expression: "～と相まって",
          meaning: "~와 맞물려, ~와 더불어",
          context: "여러 요인이 결합하여 결과를 만들 때 사용합니다.",
        },
        {
          expression: "～を余儀なくされる",
          meaning: "~할 수밖에 없게 되다",
          context:
            "외적 요인으로 인해 어쩔 수 없이 무언가를 해야 하는 상황을 나타냅니다.",
        },
      ],
      readingTips: [
        "접속사(しかし、だが、一方)에 주목하여 문장의 논리 전개를 따라가세요.",
        "필자의 주장과 구체적인 예시·데이터를 구별하여 읽으세요.",
        "단락마다 요점을 메모하면서 읽으면 이해하기 쉽습니다.",
      ],
    };
  }
}

function generatePrintHTML(problem, metadata, analysis, today) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>JLPT N1 読解問題 - ${today}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @media print {
      @page { size: A4; margin: 15mm; }
      .page-break { page-break-after: always; }
    }
    body {
      font-family: "Malgun Gothic", "맑은 고딕", "Yu Gothic", "游ゴシック", "Hiragino Kaku Gothic ProN", sans-serif;
      line-height: 1.7;
      color: #333;
      font-size: 11pt;
    }
    .page { padding: 20px; max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 3px solid #667eea; padding-bottom: 15px; margin-bottom: 25px; }
    .header h1 { font-size: 24pt; color: #667eea; margin-bottom: 8px; }
    .header-info { display: flex; justify-content: space-between; font-size: 10pt; color: #666; }
    .site-info { font-size: 9pt; color: #999; margin-top: 5px; }
    .passage-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin-bottom: 25px; }
    .passage-title { font-weight: bold; font-size: 12pt; margin-bottom: 10px; color: #667eea; }
    .passage-text { line-height: 2; white-space: pre-wrap; }
    .question-box { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
    .question-number { font-size: 14pt; font-weight: bold; color: #667eea; margin-bottom: 10px; }
    .question-text { margin-bottom: 15px; line-height: 1.8; }
    .options { margin-left: 20px; }
    .option { margin-bottom: 10px; line-height: 1.8; }
    .answer-space { margin-top: 15px; padding: 10px; background: #f0f0f0; border-radius: 4px; }
    .answer-header { border-bottom: 3px solid #28a745; padding-bottom: 15px; margin-bottom: 25px; }
    .answer-header h1 { font-size: 24pt; color: #28a745; margin-bottom: 8px; }
    .translation-box { background: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin-bottom: 25px; }
    .translation-title { font-weight: bold; font-size: 12pt; margin-bottom: 10px; color: #007bff; }
    .translation-text { line-height: 1.9; white-space: pre-wrap; }
    .answer-box { margin-bottom: 25px; background: #d4edda; border-left: 4px solid #28a745; padding: 15px; }
    .correct-answer { font-size: 13pt; font-weight: bold; color: #155724; margin-bottom: 10px; }
    .explanation { margin-top: 10px; line-height: 1.8; }
    .section { margin-top: 25px; border: 1px solid #ddd; padding: 15px; border-radius: 4px; page-break-inside: avoid; }
    .section-title { font-size: 14pt; font-weight: bold; color: #667eea; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
    .item { margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-left: 3px solid #667eea; }
    .vocab-word { font-size: 13pt; font-weight: bold; color: #333; }
    .vocab-reading { font-size: 10pt; color: #666; margin-left: 5px; }
    .vocab-meaning { font-size: 11pt; color: #0066cc; margin-top: 3px; font-weight: 500; }
    .vocab-example { font-size: 10pt; color: #666; margin-top: 5px; font-style: italic; }
    .grammar-pattern { font-size: 12pt; font-weight: bold; color: #333; margin-bottom: 5px; }
    .grammar-meaning { font-size: 11pt; color: #0066cc; font-weight: 500; }
    .grammar-example { font-size: 10pt; color: #666; margin-top: 5px; }
    .grammar-usage { font-size: 10pt; color: #555; margin-top: 3px; }
    .tip-item { padding: 8px; background: #fff3cd; border-left: 3px solid #ffc107; margin-bottom: 8px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #999; }
    .korean-label { font-weight: 600; color: #495057; font-size: 10pt; }
  </style>
</head>
<body>
  <!-- 1페이지: 문제지 -->
  <div class="page">
    <div class="header">
      <h1>📖 JLPT N1 読解問題</h1>
      <div class="header-info">
        <span>日付: ${today}</span>
        <span>レベル: ${metadata.lengthLabel || "N1"}</span>
        <span>問題数: ${problem.questions?.length || 0}問</span>
      </div>
      <div class="site-info">Generated by JLPT N1 Reading Practice</div>
    </div>
    
    ${
      problem.passage
        ? `
      <div class="passage-box">
        <div class="passage-title">📄 本文</div>
        <div class="passage-text">${esc(problem.passage)}</div>
      </div>
    `
        : ""
    }
    
    ${
      problem.passages?.A
        ? `
      <div class="passage-box">
        <div class="passage-title">📄 本文A</div>
        <div class="passage-text">${esc(problem.passages.A)}</div>
      </div>
      <div class="passage-box" style="margin-top: 15px;">
        <div class="passage-title">📄 本文B</div>
        <div class="passage-text">${esc(problem.passages.B)}</div>
      </div>
    `
        : ""
    }
    
    ${(problem.questions || [])
      .map(
        (q, i) => `
      <div class="question-box">
        <div class="question-number">❓ 問題 ${i + 1}</div>
        <div class="question-text">${esc(q.question)}</div>
        <div class="options">
          ${(q.options || [])
            .map(
              (opt, j) => `
            <div class="option">${j + 1}. ${esc(opt)}</div>
          `
            )
            .join("")}
        </div>
      </div>
    `
      )
      .join("")}
    
    <div class="answer-space">
      <strong>解答欄:</strong> 
      ${problem.questions?.map((_, i) => `問題${i + 1}: (    )`).join("　")}
    </div>
    
    <div class="footer">このプリントは学習目的でのみ使用してください。</div>
  </div>
  
  <div class="page-break"></div>
  
  <!-- 2페이지: 해설지 (한국어) -->
  <div class="page">
    <div class="answer-header">
      <h1>✅ 정답 및 해설</h1>
      <div class="header-info">
        <span>카테고리: ${metadata.category || ""}</span>
        <span>테마: ${metadata.topic || ""}</span>
      </div>
    </div>
    
    <!-- 한국어 번역 -->
    <div class="translation-box">
      <div class="translation-title">🇰🇷 본문 한국어 번역</div>
      <div class="translation-text">${esc(analysis.translation)}</div>
    </div>
    
    <!-- 정답 및 해설 -->
    ${(problem.questions || [])
      .map((q, i) => {
        const detailedExplanation = analysis.questionExplanations?.[i];
        return `
      <div class="answer-box">
        <div class="correct-answer">✅ 문제 ${i + 1}번 정답: ${
          q.correctAnswer + 1
        }번</div>
        
        ${
          detailedExplanation
            ? `
          <div class="explanation">
            <strong style="font-size: 12pt; color: #155724;">💡 상세 해설:</strong><br><br>
            <div style="line-height: 1.9; margin-bottom: 12px;">${esc(
              detailedExplanation.explanation
            )}</div>
            
            ${
              detailedExplanation.whyWrong &&
              Object.keys(detailedExplanation.whyWrong).length > 0
                ? `
              <div style="margin-top: 15px; padding: 12px; background: #fff3cd; border-left: 3px solid #ffc107; border-radius: 4px;">
                <strong style="color: #856404;">❌ 오답 분석:</strong><br>
                ${Object.entries(detailedExplanation.whyWrong)
                  .filter(([_, reason]) => reason)
                  .map(
                    ([opt, reason]) => `
                    <div style="margin-top: 8px; margin-left: 10px;">
                      <strong>${opt.replace("option", "")}번:</strong> ${esc(
                      reason
                    )}
                    </div>
                  `
                  )
                  .join("")}
              </div>
            `
                : ""
            }
            
            ${
              detailedExplanation.keyPoint
                ? `
              <div style="margin-top: 12px; padding: 10px; background: #e7f3ff; border-left: 3px solid #007bff; border-radius: 4px;">
                <strong style="color: #004085;">🎯 핵심 포인트:</strong><br>
                <div style="margin-top: 5px;">${esc(
                  detailedExplanation.keyPoint
                )}</div>
              </div>
            `
                : ""
            }
          </div>
        `
            : q.explanation
            ? `
          <div class="explanation">
            <strong>💡 해설:</strong><br>
            ${esc(q.explanation)}
          </div>
        `
            : ""
        }
      </div>
    `;
      })
      .join("")}
    
    <!-- 중요 어휘 -->
    <div class="section">
      <div class="section-title">📚 중요 어휘 (N1 레벨)</div>
      ${analysis.vocabulary
        .map(
          (v) => `
        <div class="item">
          <div>
            <span class="vocab-word">${esc(v.word)}</span>
            <span class="vocab-reading">[${esc(v.reading)}]</span>
          </div>
          <div class="vocab-meaning">💬 의미: ${esc(v.meaning)}</div>
          ${
            v.example
              ? `<div class="vocab-example">예문: ${esc(v.example)}</div>`
              : ""
          }
        </div>
      `
        )
        .join("")}
    </div>
    
    <!-- 중요 문법 -->
    <div class="section">
      <div class="section-title">📖 중요 문법 및 표현</div>
      ${analysis.grammar
        .map(
          (g) => `
        <div class="item">
          <div class="grammar-pattern">${esc(g.pattern)}</div>
          <div class="grammar-meaning">💬 의미: ${esc(g.meaning)}</div>
          ${
            g.example
              ? `<div class="grammar-example">예문: ${esc(g.example)}</div>`
              : ""
          }
          ${
            g.usage
              ? `<div class="grammar-usage">📝 사용법: ${esc(g.usage)}</div>`
              : ""
          }
        </div>
      `
        )
        .join("")}
    </div>
    
    <!-- 핵심 표현 -->
    ${
      analysis.keyExpressions && analysis.keyExpressions.length > 0
        ? `
      <div class="section">
        <div class="section-title">✨ 핵심 표현</div>
        ${analysis.keyExpressions
          .map(
            (e) => `
          <div class="item">
            <div style="font-weight: bold; margin-bottom: 5px; font-size: 11pt;">${esc(
              e.expression
            )}</div>
            <div style="color: #0066cc; font-size: 10pt; font-weight: 500;">💬 의미: ${esc(
              e.meaning
            )}</div>
            ${
              e.context
                ? `<div style="font-size: 10pt; color: #555; margin-top: 5px;">📝 사용 맥락: ${esc(
                    e.context
                  )}</div>`
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
    `
        : ""
    }
    
    <!-- 독해 팁 -->
    ${
      analysis.readingTips && analysis.readingTips.length > 0
        ? `
      <div class="section">
        <div class="section-title">💡 독해 팁</div>
        ${analysis.readingTips
          .map(
            (tip) => `
          <div class="tip-item">✓ ${esc(tip)}</div>
        `
          )
          .join("")}
      </div>
    `
        : ""
    }
    
    <div class="footer">
      열심히 공부하세요! 🎓<br>
      JLPT N1 Reading Practice - AI 기반 학습 플랫폼
    </div>
  </div>
</body>
</html>`;
}

// ===== 드롭다운 초기화 =====
export async function initLengthSelect(sel) {
  const d = await loadJSON("/data/length-definitions.json");
  const c = d.length_categories || {};
  sel.innerHTML = "";
  for (const [k, v] of Object.entries(c)) {
    const info = v.base_info || {};
    const o = document.createElement("option");
    o.value = k;
    o.textContent = `${info.icon || "📄"} ${info.label || k}${
      info.character_range ? ` - ${info.character_range}` : ""
    }`;
    sel.appendChild(o);
  }
  if (c.medium) sel.value = "medium";
}

// ===== 문제 렌더링 =====
export function renderProblem(out, data) {
  const { problem, metadata } = data;
  if (!problem) {
    out.innerHTML = `<div style="color: red;">生成失敗</div>`;
    return;
  }

  let pass = "";

  if (problem.passage) {
    pass = `<div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
      <strong>📖 本文</strong>
      <div style="margin-top: 8px; line-height: 1.8; white-space: pre-wrap;">${esc(
        problem.passage
      )}</div>
    </div>`;
  } else if (problem.passages?.A) {
    pass = `<div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background: white; padding: 12px; border-radius: 6px; border: 2px solid #667eea;">
          <strong style="color: #667eea;">【本文A】</strong>
          <div style="line-height: 1.8; white-space: pre-wrap; margin-top: 8px;">${esc(
            problem.passages.A
          )}</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 6px; border: 2px solid #764ba2;">
          <strong style="color: #764ba2;">【本文B】</strong>
          <div style="line-height: 1.8; white-space: pre-wrap; margin-top: 8px;">${esc(
            problem.passages.B
          )}</div>
        </div>
      </div>
    </div>`;
  } else if (Array.isArray(problem.passages)) {
    pass = `<div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
      ${problem.passages
        .map(
          (p, i) => `
        <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #667eea; margin-bottom: 12px;">
          <strong style="color: #667eea;">【文書${i + 1}】</strong>
          <div style="line-height: 1.8; white-space: pre-wrap; margin-top: 8px;">${esc(
            p
          )}</div>
        </div>
      `
        )
        .join("")}
    </div>`;
  }

  const qs = (problem.questions || [])
    .map(
      (q, i) => `
    <div style="border: 1px solid #dee2e6; padding: 16px; border-radius: 8px;" data-q="${i}">
      <div style="margin-bottom: 12px;">
        <strong>❓ 問題 ${i + 1}</strong>
        <div style="margin-top: 8px; line-height: 1.6;">${esc(q.question)}</div>
      </div>
      <div style="margin-bottom: 12px;">
        <strong style="font-size: 14px;">選択肢</strong>
        <div style="margin-top: 8px;">
          ${(q.options || [])
            .map(
              (o, j) => `
            <label style="display: block; margin-bottom: 8px; padding: 10px; border: 2px solid #e9ecef; border-radius: 6px; cursor: pointer; transition: 0.2s;" data-opt="${j}">
              <input type="radio" name="q_${i}" value="${j}" style="margin-right: 8px;">
              <span>${j + 1}. ${esc(o)}</span>
            </label>
          `
            )
            .join("")}
        </div>
      </div>
      <div style="display: none; margin-top: 12px;" data-res="${i}"></div>
      <div style="display: none; margin-top: 12px;" data-exp="${i}">
        ${
          q.explanation
            ? `
          <div style="padding: 12px; background: #e7f3ff; border-radius: 6px; border-left: 4px solid #007bff; line-height: 1.6;">
            <strong style="color: #004085;">💡 解説</strong>
            <div style="margin-top: 8px;">${esc(q.explanation)}</div>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `
    )
    .join("");

  const st = lm.stats();

  out.innerHTML = `
    <div style="display:grid; gap:16px">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; border-radius: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
        <div>
          <div style="font-size: 24px; font-weight: 700;">${st.total}</div>
          <div style="font-size: 12px; opacity: 0.9;">総問題数</div>
        </div>
        <div>
          <div style="font-size: 24px; font-weight: 700;">${st.acc}%</div>
          <div style="font-size: 12px; opacity: 0.9;">正答率</div>
        </div>
        <div>
          <div style="font-size: 24px; font-weight: 700;">${st.streak}🔥</div>
          <div style="font-size: 12px; opacity: 0.9;">連続日数</div>
        </div>
      </div>
      
      ${pass}
      ${qs}
      
      <button id="check" style="width: 100%; padding: 16px; font-size: 16px; font-weight: 600; color: white; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);">
        結果確認
      </button>
      
      <button id="printPdf" style="width: 100%; padding: 16px; font-size: 16px; font-weight: 600; color: white; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
        🖨️ PDF출력(문제 용지+ 해설 용지), 오래 걸릴 수 있습니다.
      </button>
      
      <div id="result" style="display: none; padding: 20px; border-radius: 8px; text-align: center; font-size: 18px; font-weight: 600;"></div>
    </div>`;

  setTimeout(() => {
    const btn = document.getElementById("check");
    const printBtn = document.getElementById("printPdf");
    const res = document.getElementById("result");
    if (!btn || !res) return;

    // PDF 출력 버튼
    if (printBtn) {
      printBtn.addEventListener("click", () => {
        openPrintWindow(problem, metadata);
      });
    }

    const lbls = out.querySelectorAll("label[data-opt]");
    lbls.forEach((l) => {
      l.addEventListener("mouseenter", () => {
        l.style.borderColor = "#667eea";
        l.style.backgroundColor = "#f8f9fa";
      });
      l.addEventListener("mouseleave", () => {
        if (!l.querySelector("input").checked) {
          l.style.borderColor = "#e9ecef";
          l.style.backgroundColor = "white";
        }
      });
      l.querySelector("input").addEventListener("change", (e) => {
        const qi = e.target.name.split("_")[1];
        const all = out.querySelectorAll(`input[name="q_${qi}"]`);
        all.forEach((inp) => {
          inp.parentElement.style.borderColor = "#e9ecef";
          inp.parentElement.style.backgroundColor = "white";
        });
        l.style.borderColor = "#667eea";
        l.style.backgroundColor = "#e7f3ff";
      });
    });

    btn.addEventListener("click", () => {
      let cor = 0;
      const tot = problem.questions.length;
      const results = [];

      problem.questions.forEach((q, i) => {
        const inp = out.querySelector(`input[name="q_${i}"]:checked`);
        const rd = out.querySelector(`[data-res="${i}"]`);
        const ed = out.querySelector(`[data-exp="${i}"]`);
        const qd = out.querySelector(`[data-q="${i}"]`);

        let ok = false;

        if (!inp) {
          rd.style.display = "block";
          rd.innerHTML = `<div style="background: #fff3cd; padding: 12px; border-radius: 6px; border-left: 4px solid #ffc107;">
            <strong style="color: #856404;">⚠️ 미응답</strong>
            <div style="margin-top: 4px;">正解: ${q.correctAnswer + 1}番</div>
          </div>`;
          qd.style.borderColor = "#ffc107";
        } else {
          const ua = parseInt(inp.value);
          ok = ua === q.correctAnswer;

          if (ok) {
            cor++;
            rd.style.display = "block";
            rd.innerHTML = `<div style="background: #d4edda; padding: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
              <strong style="color: #155724;">✅ 正解!</strong>
            </div>`;
            qd.style.borderColor = "#28a745";
            inp.parentElement.style.borderColor = "#28a745";
            inp.parentElement.style.backgroundColor = "#d4edda";
          } else {
            rd.style.display = "block";
            rd.innerHTML = `<div style="background: #f8d7da; padding: 12px; border-radius: 6px; border-left: 4px solid #dc3545;">
              <strong style="color: #721c24;">❌ 不正解</strong>
              <div style="margin-top: 4px;">あなた: ${ua + 1}番 / 正解: ${
              q.correctAnswer + 1
            }番</div>
            </div>`;
            qd.style.borderColor = "#dc3545";
            inp.parentElement.style.borderColor = "#dc3545";
            inp.parentElement.style.backgroundColor = "#f8d7da";

            const cl = out.querySelector(
              `[data-q="${i}"] [data-opt="${q.correctAnswer}"]`
            );
            if (cl) {
              cl.style.borderColor = "#28a745";
              cl.style.backgroundColor = "#d4edda";
              cl.style.fontWeight = "600";
            }
          }
        }

        results.push({ ok });
        if (ed) ed.style.display = "block";
      });

      lm.record(metadata.category, cor, tot, results);

      const p = Math.round((cor / tot) * 100);
      res.style.display = "block";

      if (p === 100) {
        res.style.background =
          "linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)";
        res.style.color = "#155724";
        res.innerHTML = `🎉 完璧! ${cor}/${tot}問 (${p}%)`;
      } else if (p >= 70) {
        res.style.background =
          "linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%)";
        res.style.color = "#0c5460";
        res.innerHTML = `👍 良い! ${cor}/${tot}問 (${p}%)`;
      } else if (p >= 50) {
        res.style.background =
          "linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%)";
        res.style.color = "#856404";
        res.innerHTML = `💪 もう少し! ${cor}/${tot}問 (${p}%)`;
      }

      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.textContent = "채점 완료";
      res.scrollIntoView({ behavior: "smooth", block: "center" });

      const nst = lm.stats();
      const statBar = out.querySelector('[style*="grid-template-columns"]');
      if (statBar) {
        statBar.innerHTML = `
          <div>
            <div style="font-size: 24px; font-weight: 700;">${nst.total}</div>
            <div style="font-size: 12px; opacity: 0.9;">総問題数</div>
          </div>
          <div>
            <div style="font-size: 24px; font-weight: 700;">${nst.acc}%</div>
            <div style="font-size: 12px; opacity: 0.9;">正答率</div>
          </div>
          <div>
            <div style="font-size: 24px; font-weight: 700;">${nst.streak}🔥</div>
            <div style="font-size: 12px; opacity: 0.9;">連続日数</div>
          </div>
        `;
      }
    });
  }, 100);
}

// ===== 문제 생성 API 호출 =====
export async function generateReadingProblem({ lengthKey = "medium" } = {}) {
  const r = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lengthKey }),
  });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

// ===== 초기화 =====
document.addEventListener("DOMContentLoaded", async () => {
  const sel = document.querySelector("[data-length-select]");
  const btn = document.querySelector("[data-generate-btn]");
  const out = document.querySelector("[data-output]");

  if (!sel || !btn || !out) return;

  try {
    await initLengthSelect(sel);
  } catch (e) {
    console.warn("初期化失敗:", e);
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = "생성중...";
    out.innerHTML = `<div style="text-align: center; padding: 40px; color: #6c757d;">
      <div style="margin-bottom: 12px;">⏳ 생성중...</div>
      <div style="font-size: 13px;">약7-15초</div>
    </div>`;

    try {
      const d = await generateReadingProblem({ lengthKey: sel.value });
      if (d.success && d.problem) {
        renderProblem(out, d);
      } else {
        throw new Error("응답 에러");
      }
    } catch (e) {
      console.error("실패:", e);
      out.innerHTML = `<div style="background: #f8d7da; padding: 16px; border-radius: 8px; color: #721c24;">
        <strong>⚠️ 실패</strong>
        <div style="margin-top: 8px;">${esc(e.message)}</div>
      </div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
});
