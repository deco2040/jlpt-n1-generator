// api/generate-reading.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { lengthKey = "medium" } = req.body || {};

    // ===== Vercel 환경에서 JSON 파일 로드 =====
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["host"];
    const baseUrl = `${protocol}://${host}`;

    console.log("🔍 Base URL:", baseUrl); // 디버깅용

    let topicsData, speakersData, lengthsData, genreData;

    try {
      const [topicsRes, speakersRes, lengthsRes, genreRes] = await Promise.all([
        fetch(`${baseUrl}/data/topics.json`),
        fetch(`${baseUrl}/data/speakers.json`),
        fetch(`${baseUrl}/data/length-definitions.json`),
        fetch(`${baseUrl}/data/genre.json`),
      ]);

      console.log("📊 Response status:", {
        topics: topicsRes.status,
        speakers: speakersRes.status,
        lengths: lengthsRes.status,
        genre: genreRes.status,
      });

      if (!topicsRes.ok) {
        throw new Error(`topics.json 로드 실패 (${topicsRes.status})`);
      }
      if (!speakersRes.ok) {
        throw new Error(`speakers.json 로드 실패 (${speakersRes.status})`);
      }
      if (!lengthsRes.ok) {
        throw new Error(
          `length-definitions.json 로드 실패 (${lengthsRes.status})`
        );
      }
      if (!genreRes.ok) {
        throw new Error(`genre.json 로드 실패 (${genreRes.status})`);
      }

      topicsData = await topicsRes.json();
      speakersData = await speakersRes.json();
      lengthsData = await lengthsRes.json();
      genreData = await genreRes.json();

      console.log("✅ 모든 JSON 파일 로드 성공");
    } catch (fileError) {
      console.error("❌ 파일 로드 실패:", fileError);
      return res.status(500).json({
        success: false,
        error: `설정 파일 로드 실패: ${fileError.message}`,
        debug: {
          baseUrl,
          attempted: [
            `${baseUrl}/data/topics.json`,
            `${baseUrl}/data/speakers.json`,
            `${baseUrl}/data/length-definitions.json`,
            `${baseUrl}/data/genre.json`,
          ],
        },
      });
    }

    // ===== 2. 헬퍼 함수 =====
    const pick = (arr) => arr?.[Math.floor(Math.random() * arr.length)] || null;

    const pickWeighted = (entries, weights) => {
      if (!entries?.length) return ["", null];
      const total = entries.reduce(
        (sum, [key]) => sum + (weights[key] ?? 1),
        0
      );
      let r = Math.random() * total;
      for (const [key, value] of entries) {
        r -= weights[key] ?? 1;
        if (r < 0) return [key, value];
      }
      return entries[0];
    };

    // ===== 3. 주제 선택 =====
    let selectedTopic = "";
    let pickedCategory = "";

    if (topicsData.topics) {
      const cats = Object.keys(topicsData.topics);
      pickedCategory = pick(cats);
      const categoryData = topicsData.topics[pickedCategory];
      selectedTopic = pick(categoryData.items || []);
    } else {
      throw new Error("topics.json 스키마를 찾을 수 없습니다.");
    }

    // ===== 4. 길이/서브타입 선택 =====
    const lenCats = lengthsData.length_categories || {};
    const lk = lenCats[lengthKey] ? lengthKey : "medium";
    const lenCat = lenCats[lk] || {};
    const baseInfo = lenCat.base_info || {};
    const subEntries = Object.entries(lenCat.subtypes || {});
    const weights = (lengthsData.random_selection_weights || {})[lk] || {};

    const [subtypeKey, subtypeInfo] = subEntries.length
      ? pickWeighted(subEntries, weights)
      : ["", null];
    const charRange =
      subtypeInfo?.character_range || baseInfo?.character_range || "150-200자";

    // ===== 5. 장르 선택 및 특성 추출 =====
    const genreList = Array.isArray(genreData) ? genreData : [];
    const trapsObj = genreList.find((g) => g.type === "n1_trap_elements");
    const availableGenres = genreList.filter(
      (g) => g.type !== "n1_trap_elements" && g.length_adaptations?.[lk]
    );
    const selectedGenre =
      availableGenres.length > 0 ? pick(availableGenres) : null;
    const genreAdaptation = selectedGenre?.length_adaptations?.[lk];

    const shouldIncludeTraps = Math.random() < 0.2;
    const shouldIncludeSpeaker = Math.random() < 0.4;

    // ===== 6. 화자 선택 =====
    let speakerInfo = null;

    if (shouldIncludeSpeaker) {
      try {
        const spCats = Object.keys(speakersData.speaker_categories || {});
        if (spCats.length > 0) {
          const spCatKey = pick(spCats);
          const spCat = speakersData.speaker_categories[spCatKey] || {};
          const types = Object.keys(spCat);

          if (types.length > 0) {
            const typeKey = pick(types);
            const sp = spCat[typeKey];

            speakerInfo = {
              category: spCatKey,
              type: typeKey,
              label: sp?.label || "",
              ageRange: pick(sp?.age_ranges || ["30대"]),
              writingStyle: pick(sp?.writing_styles || ["논리적, 체계적"]),
              vocabularyLevel: pick(sp?.vocabulary_levels || ["N1 학술 용어"]),
              toneCharacteristic: pick(
                sp?.tone_characteristics || ["객관적, 분석적"]
              ),
            };
          }
        }
      } catch (e) {
        console.warn("화자 선택 실패:", e);
        speakerInfo = null;
      }
    }

    if (!speakerInfo) {
      speakerInfo = {
        category: "objective",
        type: "neutral_narrator",
        label: "객관적 서술",
        ageRange: "-",
        writingStyle: "중립적, 사실 중심",
        vocabularyLevel: "N1 표준 어휘",
        toneCharacteristic: "객관적, 정보 전달 중심",
      };
    }

    // ===== 7. 문제 수 결정 =====
    const questionConfig = lengthsData.question_count_config?.ranges?.[lk];
    const possibleCounts = questionConfig?.possible_counts || [1];
    const countWeights = questionConfig?.weights || possibleCounts.map(() => 1);

    let questionCount = possibleCounts[0];
    const totalWeight = countWeights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;

    for (let i = 0; i < possibleCounts.length; i++) {
      r -= countWeights[i];
      if (r < 0) {
        questionCount = possibleCounts[i];
        break;
      }
    }

    // ===== 8. 프롬프트 생성 =====
    const prompt = buildPrompt(
      {
        topic: selectedTopic,
        category: pickedCategory,
        charRange,
        lengthKey: lk,
        subtypeInfo,
        genreInfo: selectedGenre,
        genreAdaptation,
        trapsObj: shouldIncludeTraps ? trapsObj : null,
        speakerInfo,
        questionCount,
      },
      pick
    );

    // ===== 9. Claude API 호출 =====
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    const llmRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!llmRes.ok) {
      const txt = await llmRes.text().catch(() => "");
      throw new Error(
        `Claude API ${llmRes.status}: ${txt || "request failed"}`
      );
    }

    const llmJson = await llmRes.json();
    const rawText = (llmJson.content?.[0]?.text || "")
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // ===== 10. JSON 파싱 및 검증 =====
    let problem;
    try {
      problem = JSON.parse(rawText);
      validateProblem(problem, questionCount, lk);
    } catch (e) {
      console.error("JSON 파싱 실패:", e);
      console.error("Raw response:", rawText);
      throw new Error(`문제 생성 실패: ${e.message}`);
    }

    // ===== 11. 응답 반환 =====
    return res.status(200).json({
      success: true,
      problem,
      metadata: {
        topic: selectedTopic,
        category: pickedCategory,
        genre: selectedGenre?.label || "",
        genreType: selectedGenre?.type || "",
        lengthKey: lk,
        lengthLabel: baseInfo.label,
        subtypeKey,
        subtype: subtypeInfo?.label,
        characterRange: charRange,
        questionCount,
        estimatedTimeMinutes: baseInfo.estimated_time_minutes || 5,
        speaker: speakerInfo,
        trapsIncluded: shouldIncludeTraps,
        speakerApplied: shouldIncludeSpeaker,
        prompt: prompt,
      },
    });
  } catch (e) {
    console.error("API 에러:", e);
    return res.status(500).json({
      success: false,
      error: String(e.message || e),
    });
  }
}

// buildPrompt 함수 (기존과 동일)
function buildPrompt(
  {
    topic,
    category,
    charRange,
    lengthKey,
    subtypeInfo,
    genreInfo,
    genreAdaptation,
    trapsObj,
    speakerInfo,
    questionCount,
  },
  pickFn
) {
  const isComparative = lengthKey === "comparative";
  const isPractical = lengthKey === "practical";

  let passageInstruction = "";
  let passageJsonStructure = "";

  if (isComparative) {
    passageInstruction = `
【비교형 특별 지침】
- 지문 A와 지문 B 두 개를 생성하세요
- 각 지문은 ${charRange}의 범위 내에서 작성
- 두 지문은 동일한 주제에 대해 서로 다른 관점이나 입장을 제시
- 두 지문을 비교·대조하여 답할 수 있는 문제 출제
- 실제 시험과 동일하게 제목은 제공하지 않음`;

    passageJsonStructure = `"passages": {
    "A": "${charRange} 범위의 일본어 본문",
    "B": "${charRange} 범위의 일본어 본문"
  }`;
  } else if (isPractical) {
    passageInstruction = `
【실용문 특별 지침】
- 3~4개의 관련된 실용 문서를 생성하세요
- 각 문서는 서로 유기적으로 연결
- 예: 안내문+신청서+주의사항, 광고+이용규정+요금표
- 여러 문서의 정보를 종합하여 답하는 문제 출제
- 전체 합계가 ${charRange} 범위 내
- 실제 시험과 동일하게 제목은 제공하지 않음`;

    passageJsonStructure = `"passages": [
    "문서1 일본어 본문",
    "문서2 일본어 본문",
    "문서3 일본어 본문"
  ]`;
  } else {
    passageJsonStructure = `"passage": "${charRange}의 일본어 본문"`;
  }

  const trapExamples = trapsObj
    ? [
        pickFn(trapsObj.opening_traps || []) || "",
        pickFn(trapsObj.middle_complexity || []) || "",
        pickFn(trapsObj.conclusion_subtlety || []) || "",
        pickFn(trapsObj.linguistic_devices || []) || "",
      ]
        .filter(Boolean)
        .join("\n   - ")
    : "";

  return `당신은 JLPT N1 독해 문제 출제 전문가입니다. 실제 시험과 동일한 수준의 문제를 생성하세요.

【필수 조건】
주제: "${topic}"
길이: ${charRange} (엄수)
문제 수: ${questionCount}문
${genreInfo ? `장르: ${genreInfo.label}` : ""}
${passageInstruction}

${
  speakerInfo.category !== "objective"
    ? `【화자 설정】
${speakerInfo.label} / ${speakerInfo.ageRange} / ${speakerInfo.writingStyle} / ${speakerInfo.toneCharacteristic}

**이 화자의 특성을 자연스럽게 반영하되, 화자의 관점이 드러나되, 의견 전달이 우선입니다.**`
    : `【서술 방식】
객관적이고 중립적인 서술로 작성하세요. 특정 화자의 주관이나 개성이 드러나지 않도록 하고, 사실과 정보 전달에 집중하세요.`
}

${
  trapExamples
    ? `【N1 함정 요소 반영】
다음 함정 요소 중 일부를 자연스럽게 활용:
   - ${trapExamples}`
    : ""
}

【출력 형식】
**반드시 아래 JSON 형식만 출력하세요. 다른 설명이나 텍스트는 절대 포함하지 마세요:**

{
  ${passageJsonStructure},
  "questions": [
    {
      "question": "문제 내용 (일본어)",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correctAnswer": 0,
      "explanation": "해설 (일본어)"
    }${
      questionCount > 1
        ? `,
    {
      "question": "문제2 내용",
      "options": ["1", "2", "3", "4"],
      "correctAnswer": 1,
      "explanation": "해설2"
    }`
        : ""
    }
  ],
  "speaker": {
    "label": "${speakerInfo.label}",
    "ageRange": "${speakerInfo.ageRange}",
    "writingStyle": "${speakerInfo.writingStyle}",
    "perspective": "화자의 관점이 본문에 어떻게 반영되었는지 설명"
  }
}

【중요 규칙】
1. N1 수준의 어휘와 문법 사용 필수
2. 선택지는 각 15-25자, 모두 그럴듯하게 작성
3. 자연스러운 일본어 사용
${isComparative ? "4. 두 지문은 명확히 대조되는 관점 제시" : ""}
${isPractical ? "4. 여러 문서를 종합해야 답할 수 있는 문제 포함" : ""}
5. **JSON만 출력, 다른 텍스트 절대 금지**`;
}

// validateProblem 함수 (기존과 동일)
function validateProblem(problem, expectedQuestionCount, lengthKey) {
  const isComparative = lengthKey === "comparative";
  const isPractical = lengthKey === "practical";

  if (isComparative) {
    if (!problem.passages || typeof problem.passages !== "object") {
      throw new Error("비교형은 passages 객체가 필요합니다.");
    }
    if (!problem.passages.A || !problem.passages.B) {
      throw new Error("비교형은 passages.A와 passages.B가 필요합니다.");
    }
    if (
      typeof problem.passages.A !== "string" ||
      typeof problem.passages.B !== "string"
    ) {
      throw new Error("각 지문은 문자열이어야 합니다.");
    }
  } else if (isPractical) {
    if (!Array.isArray(problem.passages)) {
      throw new Error("실용문은 passages 배열이 필요합니다.");
    }
    if (problem.passages.length < 3 || problem.passages.length > 4) {
      throw new Error("실용문은 3~4개의 지문이 필요합니다.");
    }
    problem.passages.forEach((p, idx) => {
      if (typeof p !== "string") {
        throw new Error(`지문 ${idx + 1}은 문자열이어야 합니다.`);
      }
    });
  } else {
    if (!problem.passage || typeof problem.passage !== "string") {
      throw new Error("passage 필드가 없거나 문자열이 아닙니다.");
    }
  }

  if (
    !Array.isArray(problem.questions) ||
    problem.questions.length !== expectedQuestionCount
  ) {
    throw new Error(
      `questions는 ${expectedQuestionCount}개의 배열이어야 합니다.`
    );
  }

  problem.questions.forEach((q, idx) => {
    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`문제 ${idx + 1}의 형식이 올바르지 않습니다.`);
    }

    if (
      typeof q.correctAnswer !== "number" ||
      q.correctAnswer < 0 ||
      q.correctAnswer > 3
    ) {
      throw new Error(`문제 ${idx + 1}의 정답 인덱스가 올바르지 않습니다.`);
    }

    if (!q.explanation || typeof q.explanation !== "string") {
      throw new Error(`문제 ${idx + 1}에 설명이 없습니다.`);
    }
  });

  return true;
}
