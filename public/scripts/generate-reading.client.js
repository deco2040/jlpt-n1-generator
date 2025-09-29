// public/scripts/generate-reading.client.js
const API_ENDPOINT = "/api/generate-reading";

async function loadJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`);
  return r.json();
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 드롭다운 초기화
export async function initLengthSelect(selectEl) {
  const defs = await loadJSON("/data/length-definitions.json");
  const cats = defs.length_categories || {};
  selectEl.innerHTML = "";
  for (const [key, val] of Object.entries(cats)) {
    const info = val.base_info || {};
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${info.icon || "📄"} ${info.label || key}${
      info.character_range ? ` - ${info.character_range}` : ""
    }`;
    selectEl.appendChild(opt);
  }
  if (cats.medium) selectEl.value = "medium";
}

// 결과 렌더링
export function renderProblem(outEl, data) {
  const { problem, metadata } = data;

  if (!problem) {
    outEl.innerHTML = `<div style="color: red;">文章生成に失敗しました。</div>`;
    return;
  }

  // 지문 렌더링
  let passageHTML = "";

  if (problem.passage) {
    // 일반형: 단일 지문
    passageHTML = `
      <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
        <strong style="font-size: 16px; color: #495057;">📖 本文</strong>
        <div style="margin-top: 8px; line-height: 1.8; white-space: pre-wrap;">${esc(
          problem.passage
        )}</div>
        <div style="margin-top: 8px; font-size: 13px; color: #6c757d;">
          文字数: ${problem.passage.length}字 | 予想時間: ${
      metadata.estimatedTimeMinutes || 5
    }分
        </div>
      </div>`;
  } else if (
    problem.passages &&
    typeof problem.passages === "object" &&
    problem.passages.A &&
    problem.passages.B
  ) {
    // 비교형: passages.A, passages.B (문자열)
    const totalChars =
      (problem.passages.A?.length || 0) + (problem.passages.B?.length || 0);
    passageHTML = `
      <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <strong style="font-size: 16px; color: #495057;">📊 比較本文</strong>
          <div style="font-size: 13px; color: #6c757d; margin-top: 4px;">
            総文字数: ${totalChars}字 | 予想時間: ${
      metadata.estimatedTimeMinutes || 12
    }分
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div style="background: white; padding: 12px; border-radius: 6px; border: 2px solid #667eea;">
            <strong style="color: #667eea; display: block; margin-bottom: 8px;">【本文A】</strong>
            <div style="line-height: 1.8; white-space: pre-wrap;">${esc(
              problem.passages.A || ""
            )}</div>
            <div style="margin-top: 8px; font-size: 12px; color: #6c757d;">
              ${problem.passages.A?.length || 0}字
            </div>
          </div>
          
          <div style="background: white; padding: 12px; border-radius: 6px; border: 2px solid #764ba2;">
            <strong style="color: #764ba2; display: block; margin-bottom: 8px;">【本文B】</strong>
            <div style="line-height: 1.8; white-space: pre-wrap;">${esc(
              problem.passages.B || ""
            )}</div>
            <div style="margin-top: 8px; font-size: 12px; color: #6c757d;">
              ${problem.passages.B?.length || 0}字
            </div>
          </div>
        </div>
      </div>`;
  } else if (Array.isArray(problem.passages)) {
    // 실용문: 복수 문서 (문자열 배열)
    const totalChars = problem.passages.reduce(
      (sum, p) => sum + (p?.length || 0),
      0
    );
    passageHTML = `
      <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 12px;">
          <strong style="font-size: 16px; color: #495057;">📋 実用文書</strong>
          <div style="font-size: 13px; color: #6c757d; margin-top: 4px;">
            ${
              problem.passages.length
            }件の文書 | 総文字数: ${totalChars}字 | 予想時間: ${
      metadata.estimatedTimeMinutes || 10
    }分
          </div>
        </div>
        
        <div style="display: grid; gap: 12px;">
          ${problem.passages
            .map(
              (p, idx) => `
            <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #667eea;">
              <strong style="color: #667eea; display: block; margin-bottom: 8px;">【文書${
                idx + 1
              }】</strong>
              <div style="line-height: 1.8; white-space: pre-wrap;">${esc(
                p || ""
              )}</div>
              <div style="margin-top: 8px; font-size: 12px; color: #6c757d;">
                ${p?.length || 0}字
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>`;
  }

  outEl.innerHTML = `
    <div style="display:grid; gap:16px">
      ${passageHTML}
      
      <!-- 問題 -->
      ${(problem.questions || [])
        .map(
          (q, idx) => `
        <div style="border: 1px solid #dee2e6; padding: 16px; border-radius: 8px;">
          <div style="margin-bottom: 12px;">
            <strong style="font-size: 15px;">❓ 問題 ${idx + 1}</strong>
            <div style="margin-top: 8px; line-height: 1.6; white-space: pre-wrap;">${esc(
              q.question || ""
            )}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <strong style="font-size: 14px; color: #495057;">選択肢</strong>
            <ol style="margin-top: 8px; padding-left: 24px;">
              ${(q.options || [])
                .map(
                  (opt, optIdx) => `
                <li style="margin-bottom: 6px; line-height: 1.6; ${
                  optIdx === q.correctAnswer
                    ? "color: #28a745; font-weight: 600;"
                    : ""
                }">${esc(opt)}</li>
              `
                )
                .join("")}
            </ol>
          </div>
          
          <div style="background: #d4edda; padding: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
            <strong style="color: #155724;">✅ 正解: ${
              Number(q.correctAnswer) + 1
            }番</strong>
          </div>
          
          ${
            q.explanation
              ? `
            <details style="margin-top: 12px;">
              <summary style="cursor: pointer; color: #007bff; font-weight: 500;">💡 解説を見る</summary>
              <div style="margin-top: 8px; padding: 12px; background: #e7f3ff; border-radius: 6px; line-height: 1.6; white-space: pre-wrap;">
                ${esc(q.explanation)}
              </div>
            </details>
          `
              : ""
          }
        </div>
      `
        )
        .join("")}
      
      <!-- メタデータ -->
      <details style="border-top: 2px solid #dee2e6; padding-top: 16px;">
        <summary style="cursor: pointer; font-weight: 500; color: #495057;">📊 メタデータ</summary>
        <div style="margin-top: 12px; display: grid; gap: 6px; font-size: 14px;">
          <div><b>テーマ</b>: ${esc(metadata.topic)}</div>
          <div><b>カテゴリー</b>: ${esc(metadata.category || "")}</div>
          ${
            metadata.genre
              ? `<div><b>ジャンル</b>: ${esc(metadata.genre)}</div>`
              : ""
          }
          <div><b>長さ</b>: ${esc(
            metadata.lengthLabel || metadata.lengthKey
          )}</div>
          ${
            metadata.subtype
              ? `<div><b>サブタイプ</b>: ${esc(metadata.subtype)}</div>`
              : ""
          }
          <div><b>文字範囲</b>: ${esc(metadata.characterRange || "")}</div>
          <div><b>問題数</b>: ${metadata.questionCount || 1}問</div>
          ${
            metadata.speaker
              ? `
            <hr style="margin: 8px 0; border: none; border-top: 1px solid #dee2e6;">
            <div><b>👤 話者情報</b></div>
            <div style="margin-left: 12px;">
              <div>• タイプ: ${esc(metadata.speaker.label)}</div>
              <div>• 年齢層: ${esc(metadata.speaker.ageRange)}</div>
              <div>• 文体: ${esc(metadata.speaker.writingStyle)}</div>
              <div>• 語調: ${esc(metadata.speaker.toneCharacteristic)}</div>
            </div>
          `
              : ""
          }
        </div>
      </details>
      
      <!-- プロンプト確認 -->
      <details style="border-top: 1px solid #dee2e6; padding-top: 16px;">
        <summary style="cursor: pointer; font-weight: 500; color: #6c757d;">🔍 使用されたプロンプト確認 (デバッグ用)</summary>
        <pre style="margin-top: 12px; background: #f8f9fa; padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; font-size: 12px; line-height: 1.5; border: 1px solid #dee2e6;">${esc(
          metadata.prompt || "プロンプト情報なし"
        )}</pre>
      </details>
    </div>`;
}

// 버튼 → 백엔드 호출
export async function generateReadingProblem({ lengthKey = "medium" } = {}) {
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lengthKey }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt || "Server error"}`);
  }
  return res.json();
}

// 자동 초기화
document.addEventListener("DOMContentLoaded", async () => {
  const $sel = document.querySelector("[data-length-select]");
  const $btn = document.querySelector("[data-generate-btn]");
  const $out = document.querySelector("[data-output]");

  if (!$sel || !$btn || !$out) {
    console.error("必要なDOM要素が見つかりません。");
    return;
  }

  try {
    await initLengthSelect($sel);
  } catch (e) {
    console.warn("長さオプション読み込み失敗:", e);
  }

  $btn.addEventListener("click", async () => {
    $btn.disabled = true;
    const originalText = $btn.textContent;
    $btn.textContent = "生成中...";
    $out.innerHTML = `<div style="text-align: center; padding: 40px; color: #6c757d;">
      <div style="margin-bottom: 12px;">⏳ 問題を生成しています...</div>
      <div style="font-size: 13px;">約7-15秒かかります</div>
    </div>`;

    const startTime = Date.now();

    try {
      const data = await generateReadingProblem({ lengthKey: $sel.value });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`問題生成完了: ${elapsed}秒`);

      if (data.success && data.problem) {
        renderProblem($out, data);
      } else {
        throw new Error("応答データ形式が正しくありません。");
      }
    } catch (e) {
      console.error("問題生成失敗:", e);
      $out.innerHTML = `
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 16px; border-radius: 8px;">
          <strong>⚠️ 問題生成失敗</strong>
          <div style="margin-top: 8px; font-size: 14px;">${esc(e.message)}</div>
          <div style="margin-top: 12px; font-size: 13px; color: #856404;">
            もう一度お試しください。問題が続く場合は、別の長さタイプを選択してください。
          </div>
        </div>`;
    } finally {
      $btn.disabled = false;
      $btn.textContent = originalText || "問題生成";
    }
  });
});
