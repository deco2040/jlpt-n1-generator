// api/generate-reading.js - Vercel API 엔드포인트
import fs from "fs";
import path from "path";

// Vercel API 핸들러
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // OPTIONS 요청 처리
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // POST만 허용
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const startTime = Date.now();
  const metadata = {
    generatedAt: new Date().toISOString(),
    generationTimeMs: 0,
    parameters: {},
    source: "ai",
    version: "2.0.0",
  };

  try {
    console.log("=== JLPT N1 독해 문제 생성 시작 ===");

    // ========================================
    // 1. JSON 파일 로드 (서버사이드)
    // ========================================

    // topics.json 로드
    const topicsPath = path.join(process.cwd(), "data/topics.json");
    const topicsData = JSON.parse(fs.readFileSync(topicsPath, "utf8"));

    const topicCategories = Object.keys(topicsData.topics);
    const randomTopicCategory =
      topicCategories[Math.floor(Math.random() * topicCategories.length)];
    const topicItems = topicsData.topics[randomTopicCategory].items;
    const selectedTopic =
      topicItems[Math.floor(Math.random() * topicItems.length)];

    metadata.parameters.topic = {
      category: randomTopicCategory,
      categoryLabel: topicsData.topics[randomTopicCategory].category,
      topic: selectedTopic,
      totalTopicsInCategory: topicItems.length,
    };

    console.log(`✅ 선택된 주제: "${selectedTopic}"`);

    // genre.json 로드
    const genrePath = path.join(process.cwd(), "data/genre.json");
    const genreData = JSON.parse(fs.readFileSync(genrePath, "utf8"));

    // N1 함정 요소 선택
    const trapElements = genreData.find((g) => g.type === "n1_trap_elements");
    const randomOpeningTrap =
      trapElements.opening_traps[
        Math.floor(Math.random() * trapElements.opening_traps.length)
      ];
    const randomMiddleComplexity =
      trapElements.middle_complexity[
        Math.floor(Math.random() * trapElements.middle_complexity.length)
      ];
    const randomConclusionSubtlety =
      trapElements.conclusion_subtlety[
        Math.floor(Math.random() * trapElements.conclusion_subtlety.length)
      ];

    metadata.parameters.n1Traps = {
      opening: randomOpeningTrap,
      middle: randomMiddleComplexity,
      conclusion: randomConclusionSubtlety,
    };

    // 장르 선택
    const genres = genreData.filter((g) => g.type !== "n1_trap_elements");
    const selectedGenre = genres[Math.floor(Math.random() * genres.length)];

    metadata.parameters.genre = {
      type: selectedGenre.type,
      label: selectedGenre.label,
      description: selectedGenre.description,
      characteristics: selectedGenre.characteristics,
      vocabularyFocus: selectedGenre.vocabulary_focus,
      grammarStyle: selectedGenre.grammar_style,
      totalGenres: genres.length,
    };

    console.log(`✅ 선택된 장르: ${selectedGenre.label}`);

    // length-definitions.json 로드
    const lengthPath = path.join(process.cwd(), "data/length-definitions.json");
    const lengthData = JSON.parse(fs.readFileSync(lengthPath, "utf8"));

    const lengthTypes = Object.keys(lengthData.lengths);
    const randomLengthType =
      lengthTypes[Math.floor(Math.random() * lengthTypes.length)];
    const selectedLength = lengthData.lengths[randomLengthType];

    const subtypes = Object.keys(selectedLength.subtypes);
    const randomSubtype = subtypes[Math.floor(Math.random() * subtypes.length)];
    const selectedSubtype = selectedLength.subtypes[randomSubtype];

    metadata.parameters.length = {
      type: randomLengthType,
      label: selectedLength.base_info.label,
      characterRange: selectedSubtype.character_range,
      subtypeKey: randomSubtype,
      subtypeLabel: selectedSubtype.label,
      characteristics: selectedSubtype.characteristics,
      questionEmphasis: selectedSubtype.question_emphasis,
      estimatedTime: selectedLength.base_info.estimated_time_minutes,
      totalSubtypes: subtypes.length,
    };

    console.log(
      `✅ 길이: ${selectedLength.base_info.label}, 서브타입: ${selectedSubtype.label}`
    );

    // ========================================
    // 2. Claude API 프롬프트 생성
    // ========================================

    const prompt = `당신은 JLPT N1 수준의 일본어 독해 문제를 출제하는 전문가입니다.

다음 조건을 만족하는 독해 문제를 생성해주세요:

1. 주제: "${selectedTopic}"
   카테고리: ${metadata.parameters.topic.categoryLabel}

2. 장르: ${selectedGenre.label} (${selectedGenre.description})
   - 특징: ${selectedGenre.characteristics.join(", ")}
   - 어휘 초점: ${selectedGenre.vocabulary_focus}
   - 문법 스타일: ${selectedGenre.grammar_style}

3. 지문 길이: ${selectedSubtype.character_range}
   - 서브타입: ${selectedSubtype.label}
   - 특징: ${selectedSubtype.characteristics.join(", ")}
   - 문제 초점: ${selectedSubtype.question_emphasis}

4. N1 함정 요소 (반드시 포함):
   - 도입부: ${randomOpeningTrap}
   - 중간부: ${randomMiddleComplexity}
   - 결론부: ${randomConclusionSubtlety}

5. 문제 요구사항:
   - 4개 선택지 중 1개만 정답
   - 오답은 일부만 맞거나 미묘하게 다른 내용
   - 선택지는 각 15-25자 정도
   - 문제 수준: JLPT N1 (고급 어휘, 복잡한 문법 구조)

6. 출력 형식:
반드시 다음 JSON 형식으로만 응답하세요:

{
  "passage": "독해 지문 (일본어, ${selectedSubtype.character_range})",
  "question": "이 글의 주장으로 가장 적절한 것은?",
  "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correctAnswer": 0,
  "explanation": "정답 해설 (한국어)",
  "grammarPoints": ["문법포인트1", "문법포인트2"],
  "vocabularyLevel": "N1"
}`;

    // ========================================
    // 3. Claude API 호출
    // ========================================

    console.log("🤖 Claude API 호출 중...");
    const apiStartTime = Date.now();

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    metadata.apiCallTimeMs = Date.now() - apiStartTime;

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`Claude API 실패: ${apiResponse.status} - ${errorText}`);
    }

    const apiData = await apiResponse.json();

    // JSON 파싱
    let responseText = apiData.content[0].text.trim();
    responseText = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const problemData = JSON.parse(responseText);

    console.log("✅ 문제 생성 완료!");

    // ========================================
    // 4. 응답 반환
    // ========================================

    metadata.generationTimeMs = Date.now() - startTime;
    metadata.source = "ai";

    return res.status(200).json({
      success: true,
      problem: problemData,
      metadata: metadata,
    });
  } catch (error) {
    console.error("❌ 문제 생성 오류:", error);

    metadata.generationTimeMs = Date.now() - startTime;
    metadata.source = "fallback";
    metadata.error = {
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };

    // 백업 문제 반환
    return res.status(200).json({
      success: true,
      problem: {
        passage:
          "申し訳ございません。現在、問題生成システムに一時的なエラーが発生しています。システムは通常すぐに復旧しますので、しばらく待ってから再度お試しください。",
        question: "この文章の主な内容は何ですか？",
        options: [
          "システムエラーについて",
          "問題生成について",
          "再試行の方法について",
          "謝罪について",
        ],
        correctAnswer: 0,
        explanation:
          "一時的なシステムエラーのため、バックアップ問題が表示されています。",
        grammarPoints: [],
        vocabularyLevel: "N1",
      },
      metadata: metadata,
    });
  }
}
