(() => {
  // ====== 설정 (필요시 window.READING_PATHS로 오버라이드 가능) ======
  const PATHS = Object.assign(
    {
      // index.html 이 public/ 에 있고 data/ 가 public/과 같은 상위에 있는 구조를 가정
      topics: "../data/topics.json",
      genre: "../data/genre.json",
      lengths: "../data/length-definitions.json",
    },
    window.READING_PATHS || {}
  );

  // 백엔드 호출 엔드포인트 (백엔드-생성 방식이면 여기로 POST)
  // 예) public/index.html에서 <script>window.READING_API_ENDPOINT="/api/generate"</script> 한 줄로 설정
  const API_ENDPOINT = window.READING_API_ENDPOINT || null;

  // ====== 유틸 ======
  async function loadJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`);
    return r.json();
  }

  function weightedPick(entries, weightsObj = {}) {
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

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ====== 모델/백엔드 호출 (원하는 방식으로 구현해 사용) ======
  async function callBackend(payload) {
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

  // 프런트에서 직접 LLM 호출은 보안상/키 노출상 권장하지 않음. 반드시 서버 프록시 사용 권장.
  async function callModelDirect(_prompt) {
    throw new Error(
      "Direct model call is not configured. Use backend endpoint."
    );
  }

  // ====== 핵심: 문제 생성 ======
  async function generateReadingProblem({ lengthKey = "medium" } = {}) {
    // 1) 데이터 로드
    const [topicsData, genreData, lengthData] = await Promise.all([
      loadJSON(PATHS.topics),
      loadJSON(PATHS.genre),
      loadJSON(PATHS.lengths),
    ]);

    // 주제 선택
    const topicCategories = Object.keys(topicsData.topics || {});
    if (!topicCategories.length) throw new Error("No topics found");
    const randCat =
      topicCategories[Math.floor(Math.random() * topicCategories.length)];
    const topicItems = (topicsData.topics[randCat] || {}).items || [];
    if (!topicItems.length)
      throw new Error(`No topic items in category: ${randCat}`);
    const selectedTopic =
      topicItems[Math.floor(Math.random() * topicItems.length)];

    // 장르/함정 요소
    const traps = genreData.find((g) => g.type === "n1_trap_elements") || {};
    const genres = genreData.filter((g) => g.type !== "n1_trap_elements");
    if (!genres.length) throw new Error("No genres found");
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

    // 길이/서브타입
    const lenCats = lengthData.length_categories || {};
    const lenKey = lenCats[lengthKey] ? lengthKey : "medium";
    const lenCat = lenCats[lenKey];
    const baseInfo = lenCat.base_info || {};
    const subtypeEntries = Object.entries(lenCat.subtypes || {});
    if (!subtypeEntries.length)
      throw new Error(`No subtypes for lengthKey: ${lenKey}`);
    const weights = (lengthData.random_selection_weights || {})[lenKey] || {};
    const [subtypeKey, subtypeInfo] = weightedPick(subtypeEntries, weights);

    // 백엔드/모델용 프롬프트
    const prompt = `당신은 JLPT N1 수준의 일본어 독해 문제 출제 전문가입니다.

# 문제 생성 조건
- 주제: ${selectedTopic}
- 장르: ${selectedGenre.label} (${selectedGenre.description})
- 글 길이: ${subtypeInfo.character_range}
- 서브타입: ${subtypeInfo.label}
- 특징: ${
      Array.isArray(subtypeInfo.characteristics)
        ? subtypeInfo.characteristics.join(", ")
        : ""
    }

# N1 난이도 함정 요소 (반드시 포함)
- 도입부: ${selectedTraps[0]}
- 중간부: ${selectedTraps[1]}
- 결론부: ${selectedTraps[2]}

# 생성 지침
1. 위 주제에 대한 JLPT N1 수준의 독해 지문을 작성하세요.
2. 지정된 글자 수 범위(${subtypeInfo.character_range})를 반드시 지켜주세요.
3. N1 수준의 고급 어휘/문법/한자를 사용하세요.
4. 논리적 구조가 명확해야 합니다.
5. 함정 요소를 자연스럽게 포함하세요.

# 문제 형식
- 질문: "이 글의 주요 내용으로 가장 적절한 것은?" (일본어)
- 선택지: 4개 (정답 1개, 오답 3개)

# 출력 형식 (반드시 이 JSON 형식으로만 응답)
{
  "passage": "지문 내용 (일본어, ${subtypeInfo.character_range})",
  "question": "질문 내용 (일본어)",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct_answer": 0,
  "explanation": "정답 해설 (한국어)"
}`;

    // 2) 생성 호출
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
      // 서버 엔드포인트가 없다면 예외 (보안상 프런트 직호출 지양)
      result = await callModelDirect(prompt);
    }

    // 3) 결과 파싱/반환 (백엔드가 동일 JSON을 반환한다고 가정)
    // 백엔드가 content.text 형태로 줄 경우 JSON 파싱 추가 처리
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

  // ====== UI: 길이 옵션 드롭다운 채우기 & 자동 초기화 ======
  async function initLengthSelect(selectEl) {
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
    // 기본값 medium이 있으면 선택
    if (cats.medium) selectEl.value = "medium";
  }

  function renderProblem(outEl, data) {
    if (!outEl) return;
    const { problem, metadata } = data;
    outEl.innerHTML = `
      <div style="display:grid; gap:12px">
        <div><strong>지문</strong><br>${escapeHTML(problem.passage || "")}</div>
        <div><strong>문제</strong><br>${escapeHTML(
          problem.question || ""
        )}</div>
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
          <div><b>길이 유형</b>: ${escapeHTML(
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

  // ====== 자동 초기화 (index에 인라인 스크립트 불필요) ======
  document.addEventListener("DOMContentLoaded", async () => {
    const $sel = document.querySelector("[data-length-select]");
    const $btn = document.querySelector("[data-generate-btn]");
    const $out = document.querySelector("[data-output]");

    if ($sel) {
      try {
        await initLengthSelect($sel);
      } catch (e) {
        console.warn("길이 옵션 로드 실패:", e);
      }
    }

    if ($btn) {
      $btn.addEventListener("click", async () => {
        $btn.disabled = true;
        const oldLabel = $btn.textContent;
        $btn.textContent = "생성 중...";
        try {
          const lenKey = $sel?.value || "medium";
          const data = await generateReadingProblem({ lengthKey: lenKey });
          renderProblem($out, data);
        } catch (e) {
          if ($out) $out.textContent = `⚠️ 문제 생성 실패: ${e.message}`;
        } finally {
          $btn.disabled = false;
          $btn.textContent = oldLabel || "문제 생성";
        }
      });
    }
  });

  // ====== 전역 노출 (원하면 직접 호출 가능) ======
  window.GenerateReading = {
    initLengthSelect,
    generateReadingProblem,
  };
})();
