// ====== 설정 (필요시 READING_PATHS로 오버라이드 가능) ======
const PATHS = Object.assign(
  {
    topics: "../data/topics.json",
    genre: "../data/genre.json",
    lengths: "../data/length-definitions.json",
  },
  globalThis.READING_PATHS || {}
);

// 백엔드 호출 엔드포인트 (백엔드-생성 방식이면 여기로 POST)
export const API_ENDPOINT = globalThis.READING_API_ENDPOINT || null;

// ====== 유틸 ======
export async function loadJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`);
  return r.json();
}

export function weightedPick(entries, weightsObj = {}) {
  const items = entries.map(([k, v]) => ({
    key: k,
    info: v,
    w: typeof weightsObj[k] === "number" ? weightsObj[k] : 1,
  }));
  const total = items.reduce((s, it) => s + it.w, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.w;
    if (r < 0) return [it.key, it.info];
  }
  return [items[0].key, items[0].info];
}

export function escapeHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ====== 백엔드 호출 ======
export async function callBackend(payload) {
  if (!API_ENDPOINT) throw new Error("API_ENDPOINT not set");
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt || "Server error"}`);
  }
  return res.json();
}

export async function callModelDirect(_prompt) {
  throw new Error("Direct model call is not configured. Use backend endpoint.");
}

// ====== 핵심: 문제 생성 ======
export async function generateReadingProblem({ lengthKey = "medium" } = {}) {
  const [topicsData, genreData, lengthData] = await Promise.all([
    loadJSON(PATHS.topics),
    loadJSON(PATHS.genre),
    loadJSON(PATHS.lengths),
  ]);

  // 주제
  const topicCategories = Object.keys(topicsData.topics || {});
  const randCat =
    topicCategories[Math.floor(Math.random() * topicCategories.length)];
  const topicItems = (topicsData.topics[randCat] || {}).items || [];
  const selectedTopic =
    topicItems[Math.floor(Math.random() * topicItems.length)];

  // 장르
  const traps = genreData.find((g) => g.type === "n1_trap_elements") || {};
  const genres = genreData.filter((g) => g.type !== "n1_trap_elements");
  const selectedGenre = genres[Math.floor(Math.random() * genres.length)];
  const trapTypes = [
    "opening_traps",
    "middle_complexity",
    "conclusion_subtlety",
  ];
  const selectedTraps = trapTypes.map((t) => {
    const arr = traps?.[t] || [];
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : "";
  });

  // 길이
  const lenCats = lengthData.length_categories || {};
  const lenKey = lenCats[lengthKey] ? lengthKey : "medium";
  const lenCat = lenCats[lenKey];
  const baseInfo = lenCat.base_info || {};
  const subtypeEntries = Object.entries(lenCat.subtypes || {});
  const weights = (lengthData.random_selection_weights || {})[lenKey] || {};
  const [subtypeKey, subtypeInfo] = weightedPick(subtypeEntries, weights);

  const prompt = `당신은 JLPT N1 수준의 일본어 독해 문제 출제 전문가입니다.
# 문제 조건
- 주제: ${selectedTopic}
- 장르: ${selectedGenre.label}
- 길이: ${subtypeInfo.character_range} (${subtypeInfo.label})
- 함정: ${selectedTraps.join(", ")}
...`;

  let result;
  if (API_ENDPOINT) {
    result = await callBackend({
      topic: selectedTopic,
      genre: selectedGenre.label,
      prompt,
      lengthKey: lenKey,
      subtypeKey,
    });
  } else {
    result = await callModelDirect(prompt);
  }

  const problem =
    result?.problem ||
    (typeof result?.content === "string"
      ? JSON.parse(
          result.content
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim()
        )
      : result);

  return {
    success: true,
    problem,
    metadata: {
      topic: selectedTopic,
      category: randCat,
      genre: selectedGenre.label,
      lengthKey: lenKey,
      lengthLabel: baseInfo.label,
      subtypeKey,
      subtype: subtypeInfo.label,
      characterRange: subtypeInfo.character_range,
    },
  };
}

// ====== 드롭다운 초기화 ======
export async function initLengthSelect(selectEl) {
  const defs = await loadJSON(PATHS.lengths);
  const cats = defs.length_categories || {};
  if (!selectEl) return;
  selectEl.innerHTML = "";
  Object.entries(cats).forEach(([key, val]) => {
    const info = val.base_info || {};
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${info.icon || "📝"} ${info.label || key}${
      info.character_range ? ` - ${info.character_range}` : ""
    }`;
    selectEl.appendChild(opt);
  });
  if (cats.medium) selectEl.value = "medium";
}

// ====== 문제 렌더 ======
export function renderProblem(outEl, data) {
  if (!outEl) return;
  const { problem, metadata } = data;
  outEl.innerHTML = `
    <div style="display:grid; gap:12px">
      <div><strong>지문</strong><br>${escapeHTML(problem.passage || "")}</div>
      <div><strong>문제</strong><br>${escapeHTML(problem.question || "")}</div>
      <div><strong>선택지</strong><br>
        <ol>${(problem.choices || [])
          .map((c) => `<li>${escapeHTML(c)}</li>`)
          .join("")}</ol>
      </div>
      <div><strong>정답</strong>: ${Number(problem.correct_answer) + 1}</div>
      <div><strong>해설</strong><br>${escapeHTML(
        problem.explanation || ""
      )}</div>
      <hr/>
      <details>
        <summary>메타데이터</summary>
        <div><b>주제</b>: ${escapeHTML(metadata.topic)}</div>
        <div><b>장르</b>: ${escapeHTML(metadata.genre)}</div>
        <div><b>길이</b>: ${escapeHTML(
          metadata.lengthLabel || metadata.lengthKey
        )}</div>
        <div><b>서브타입</b>: ${escapeHTML(
          metadata.subtype || metadata.subtypeKey
        )}</div>
        <div><b>글자 범위</b>: ${escapeHTML(
          metadata.characterRange || ""
        )}</div>
      </details>
    </div>
  `;
}
