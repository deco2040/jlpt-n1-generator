// api/generate-reading.js (최종 개선본)
// JLPT N1 독해 문제 생성 (모든 JSON 파일 활용 + 메타데이터 출력)

// 환경 변수 체크 (개발/프로덕션 모드)
const isDevelopment =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";
const debugLog = isDevelopment ? console.log : () => {};
const debugWarn = isDevelopment ? console.warn : () => {};

/**
 * JLPT N1 독해 문제 생성 메인 함수
 * @returns {Promise<Object>} 생성된 문제와 메타데이터
 */
async function generateReadingProblem() {
  // 문제 생성 시작 시간 기록
  const startTime = Date.now();

  // 메타데이터 객체 초기화
  const metadata = {
    generatedAt: new Date().toISOString(),
    generationTimeMs: 0,
    parameters: {},
    source: "ai", // 'ai' 또는 'fallback'
    version: "2.0.0",
  };

  try {
    debugLog("=== JLPT N1 독해 문제 생성 시작 ===");

    // ========================================
    // 1. topics.json에서 주제 랜덤 선택
    // ========================================
    debugLog("\n[1단계] 주제 선택 중...");

    const topicsResponse = await fetch("data/topics.json");
    if (!topicsResponse.ok) {
      throw new Error(`topics.json 로드 실패: ${topicsResponse.status}`);
    }
    const topicsData = await topicsResponse.json();

    const topicCategories = Object.keys(topicsData.topics);
    const randomTopicCategory =
      topicCategories[Math.floor(Math.random() * topicCategories.length)];
    const topicItems = topicsData.topics[randomTopicCategory].items;
    const selectedTopic =
      topicItems[Math.floor(Math.random() * topicItems.length)];

    // 메타데이터 저장
    metadata.parameters.topic = {
      category: randomTopicCategory,
      categoryLabel: topicsData.topics[randomTopicCategory].category,
      topic: selectedTopic,
      totalTopicsInCategory: topicItems.length,
    };

    debugLog(`✅ 선택된 주제: "${selectedTopic}"`);
    debugLog(
      `   카테고리: ${randomTopicCategory} (총 ${topicItems.length}개 주제 중)`
    );

    // ========================================
    // 2. genre.json에서 장르 및 N1 함정 요소 선택
    // ========================================
    debugLog("\n[2단계] 장르 및 N1 함정 요소 선택 중...");

    const genreResponse = await fetch("data/genre.json");
    if (!genreResponse.ok) {
      throw new Error(`genre.json 로드 실패: ${genreResponse.status}`);
    }
    const genreData = await genreResponse.json();

    // N1 함정 요소 선택
    const trapElements = genreData.find((g) => g.type === "n1_trap_elements");
    if (!trapElements) {
      throw new Error("N1 함정 요소를 찾을 수 없습니다");
    }

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

    // 메타데이터 저장
    metadata.parameters.n1Traps = {
      opening: randomOpeningTrap,
      middle: randomMiddleComplexity,
      conclusion: randomConclusionSubtlety,
    };

    debugLog(`✅ N1 함정 요소 선택 완료`);
    debugLog(`   도입부: ${randomOpeningTrap.substring(0, 30)}...`);
    debugLog(`   중간부: ${randomMiddleComplexity.substring(0, 30)}...`);
    debugLog(`   결론부: ${randomConclusionSubtlety.substring(0, 30)}...`);

    // 실제 장르 선택 (essay, column 등)
    const genres = genreData.filter((g) => g.type !== "n1_trap_elements");
    const selectedGenre = genres[Math.floor(Math.random() * genres.length)];

    // 메타데이터 저장
    metadata.parameters.genre = {
      type: selectedGenre.type,
      label: selectedGenre.label,
      description: selectedGenre.description,
      characteristics: selectedGenre.characteristics,
      vocabularyFocus: selectedGenre.vocabulary_focus,
      grammarStyle: selectedGenre.grammar_style,
      totalGenres: genres.length,
    };

    debugLog(`✅ 선택된 장르: ${selectedGenre.label}`);
    debugLog(`   특징: ${selectedGenre.characteristics.join(", ")}`);

    // ========================================
    // 3. length-definitions.json에서 길이 및 서브타입 선택
    // ========================================
    debugLog("\n[3단계] 지문 길이 및 서브타입 선택 중...");

    const lengthResponse = await fetch("data/length-definitions.json");
    if (!lengthResponse.ok) {
      throw new Error(
        `length-definitions.json 로드 실패: ${lengthResponse.status}`
      );
    }
    const lengthData = await lengthResponse.json();

    const lengthTypes = Object.keys(lengthData.length_categories);
    const randomLengthType =
      lengthTypes[Math.floor(Math.random() * lengthTypes.length)];
    const selectedLength = lengthData.length_categories[randomLengthType];

    // 해당 길이에서 서브타입 랜덤 선택
    const subtypes = Object.keys(selectedLength.subtypes);
    const randomSubtype = subtypes[Math.floor(Math.random() * subtypes.length)];
    const selectedSubtype = selectedLength.subtypes[randomSubtype];

    // 메타데이터 저장
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

    debugLog(`✅ 선택된 길이: ${selectedLength.base_info.label}`);
    debugLog(
      `   서브타입: ${selectedSubtype.label} (${selectedSubtype.character_range})`
    );
    debugLog(`   문제 초점: ${selectedSubtype.question_emphasis}`);

    // ========================================
    // 4. speakers.json에서 화자 랜덤 선택
    // ========================================
    debugLog("\n[4단계] 화자 선택 중...");

    let speakerInfo = null;
    try {
      const speakersResponse = await fetch("data/speakers.json");
      if (!speakersResponse.ok) {
        throw new Error(`speakers.json 로드 실패: ${speakersResponse.status}`);
      }
      const speakersData = await speakersResponse.json();

      const speakerCategories = Object.keys(speakersData.speaker_categories);
      const randomSpeakerCategory =
        speakerCategories[Math.floor(Math.random() * speakerCategories.length)];
      const speakerCategory =
        speakersData.speaker_categories[randomSpeakerCategory];

      const speakerTypes = Object.keys(speakerCategory);
      const randomType =
        speakerTypes[Math.floor(Math.random() * speakerTypes.length)];
      const speaker = speakerCategory[randomType];

      // 각 배열에서 랜덤 선택
      const selectedAgeRange =
        speaker.age_ranges[
          Math.floor(Math.random() * speaker.age_ranges.length)
        ];
      const selectedWritingStyle =
        speaker.writing_styles[
          Math.floor(Math.random() * speaker.writing_styles.length)
        ];
      const selectedVocabularyLevel =
        speaker.vocabulary_levels[
          Math.floor(Math.random() * speaker.vocabulary_levels.length)
        ];
      const selectedToneCharacteristic =
        speaker.tone_characteristics[
          Math.floor(Math.random() * speaker.tone_characteristics.length)
        ];

      speakerInfo = {
        category: randomSpeakerCategory,
        type: randomType,
        label: speaker.label,
        ageRange: selectedAgeRange,
        writingStyle: selectedWritingStyle,
        vocabularyLevel: selectedVocabularyLevel,
        toneCharacteristic: selectedToneCharacteristic,
      };

      // 메타데이터 저장
      metadata.parameters.speaker = speakerInfo;

      debugLog(
        `✅ 선택된 화자: ${speakerInfo.label} (${speakerInfo.ageRange})`
      );
      debugLog(`   문체: ${speakerInfo.writingStyle}`);
      debugLog(`   어조: ${speakerInfo.toneCharacteristic}`);
    } catch (error) {
      debugWarn("⚠️ 화자 정보 로드 실패, 중립적 화자 사용:", error.message);
      metadata.parameters.speaker = null;
      metadata.warnings = metadata.warnings || [];
      metadata.warnings.push("화자 정보 로드 실패, 중립적 어조 사용");
    }

    // ========================================
    // 5. AI 프롬프트 생성 (모든 요소 통합)
    // ========================================
    debugLog("\n[5단계] AI 프롬프트 생성 중...");

    const prompt = `당신은 JLPT N1 수준의 일본어 독해 문제를 출제하는 전문가입니다.

다음 조건을 만족하는 독해 문제를 생성해주세요:

1. 주제: "${selectedTopic}"
   카테고리: ${metadata.parameters.topic.categoryLabel}

2. 장르: ${selectedGenre.label} (${selectedGenre.description})
   - 특징: ${selectedGenre.characteristics.join(", ")}
   - 어휘 초점: ${selectedGenre.vocabulary_focus}
   - 문법 스타일: ${selectedGenre.grammar_style}
   - 텍스트 구조: ${selectedGenre.text_structure.basic_flow}
   - 작성 지침: ${selectedGenre.instructions}

3. 지문 길이: ${selectedSubtype.character_range}
   - 서브타입: ${selectedSubtype.label}
   - 특징: ${selectedSubtype.characteristics.join(", ")}
   - 문제 초점: ${selectedSubtype.question_emphasis}

4. N1 함정 요소 (반드시 포함):
   - 도입부: ${randomOpeningTrap}
   - 중간부: ${randomMiddleComplexity}
   - 결론부: ${randomConclusionSubtlety}

5. 화자 설정:
${
  speakerInfo
    ? `   - 화자 유형: ${speakerInfo.label}
   - 연령대: ${speakerInfo.ageRange}
   - 문체: ${speakerInfo.writingStyle}
   - 어휘 수준: ${speakerInfo.vocabularyLevel}
   - 어조: ${speakerInfo.toneCharacteristic}
   
   화자의 특성을 자연스럽게 반영하되, JLPT N1 수준을 유지하세요.`
    : "   중립적 어조로 작성하세요."
}

6. 문제 요구사항:
   - 4개 선택지 중 1개만 정답
   - 오답은 일부만 맞거나 미묘하게 다른 내용
   - 선택지는 각 15-25자 정도
   - 문제 수준: JLPT N1 (고급 어휘, 복잡한 문법 구조)

7. 출력 형식:
반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:

{
  "passage": "독해 지문 (일본어, ${selectedSubtype.character_range})",
  "question": "이 글의 주장으로 가장 적절한 것은?",
  "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correctAnswer": 0,
  "explanation": "정답 해설 (한국어)",
  "grammarPoints": ["문법포인트1", "문법포인트2", "문법포인트3"],
  "vocabularyLevel": "N1"
}`;

    // 프롬프트도 메타데이터에 저장 (디버깅용)
    if (isDevelopment) {
      metadata.prompt = prompt;
    }

    // ========================================
    // 6. Claude API 호출
    // ========================================
    debugLog("\n[6단계] Claude API 호출 중...");

    const apiStartTime = Date.now();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

    const apiEndTime = Date.now();
    metadata.apiCallTimeMs = apiEndTime - apiStartTime;

    if (!response.ok) {
      throw new Error(
        `API 요청 실패: ${response.status} ${response.statusText}`
      );
    }

    debugLog(`✅ API 호출 성공 (${metadata.apiCallTimeMs}ms)`);

    const data = await response.json();

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error("API 응답 형식이 올바르지 않습니다");
    }

    // JSON 파싱
    let responseText = data.content[0].text.trim();
    responseText = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const problemData = JSON.parse(responseText);

    debugLog("✅ 문제 생성 완료");

    // ========================================
    // 7. 최종 결과 구성
    // ========================================
    const endTime = Date.now();
    metadata.generationTimeMs = endTime - startTime;
    metadata.source = "ai";

    // 문제 품질 검증 (간단한 체크)
    const validationResults = validateProblem(problemData, metadata);
    metadata.validation = validationResults;

    if (!validationResults.isValid) {
      debugWarn("⚠️ 문제 품질 검증 경고:", validationResults.warnings);
    }

    debugLog(`\n=== 생성 완료 (총 ${metadata.generationTimeMs}ms) ===\n`);

    // 최종 반환 객체
    return {
      ...problemData,
      metadata: metadata,
    };
  } catch (error) {
    console.error("독해 문제 생성 중 오류:", error);

    // ========================================
    // 에러 발생 시 백업 문제 반환
    // ========================================
    const endTime = Date.now();
    metadata.generationTimeMs = endTime - startTime;
    metadata.source = "fallback";
    metadata.error = {
      message: error.message,
      stack: isDevelopment ? error.stack : undefined,
    };

    // 백업 문제도 메타데이터 포함
    const fallbackMetadata = {
      ...metadata,
      parameters: {
        topic: {
          category: "technology_society",
          categoryLabel: "기술과 사회",
          topic: "기술 발전과 인간성의 균형",
        },
        genre: {
          type: "editorial",
          label: "논설문",
          description: "주장과 근거를 통해 독자를 설득하는 목적의 논리적 글",
        },
        length: {
          type: "medium",
          label: "중문",
          characterRange: "600~800자",
        },
        speaker: null,
        n1Traps: {
          opening: "일반적 오해 제시",
          middle: "부분 긍정 후 전체 부정",
          conclusion: "단정적 결론 회피",
        },
      },
    };

    return {
      passage:
        "現代社会において、技術革新は目覚ましい発展を遂げている。しかしながら、技術の進歩が必ずしも人間の幸福に直結するとは限らない。むしろ、技術に依存しすぎることで、人間本来の能力や感性が衰退する危険性も指摘されている。したがって、技術と人間性のバランスを保つことが、今後の課題として挙げられる。",
      question: "この文章の主張として最も適切なものは?",
      options: [
        "技術革新は人間の幸福に必ず貢献する",
        "技術の進歩と人間性のバランスが重要である",
        "技術に依存することは完全に避けるべきだ",
        "現代社会では技術革新が不要である",
      ],
      correctAnswer: 1,
      explanation:
        "文章では「技術と人間性のバランスを保つことが課題」と述べており、選択肢2が最も適切です。",
      grammarPoints: ["〜において", "〜とは限らない", "〜として挙げられる"],
      vocabularyLevel: "N1",
      metadata: fallbackMetadata,
    };
  }
}

/**
 * 생성된 문제의 품질을 검증하는 함수
 * @param {Object} problem - 생성된 문제 객체
 * @param {Object} metadata - 메타데이터 객체
 * @returns {Object} 검증 결과
 */
function validateProblem(problem, metadata) {
  const warnings = [];
  let isValid = true;

  // 1. 필수 필드 체크
  if (!problem.passage || problem.passage.length < 100) {
    warnings.push("지문이 너무 짧습니다");
    isValid = false;
  }

  if (!problem.question || problem.question.length < 10) {
    warnings.push("질문이 너무 짧습니다");
    isValid = false;
  }

  if (!problem.options || problem.options.length !== 4) {
    warnings.push("선택지가 4개가 아닙니다");
    isValid = false;
  }

  if (
    typeof problem.correctAnswer !== "number" ||
    problem.correctAnswer < 0 ||
    problem.correctAnswer > 3
  ) {
    warnings.push("정답 인덱스가 올바르지 않습니다");
    isValid = false;
  }

  // 2. 지문 길이 검증
  const targetRange = metadata.parameters?.length?.characterRange;
  if (targetRange) {
    const match = targetRange.match(/(\d+)~(\d+)/);
    if (match) {
      const [, min, max] = match.map(Number);
      const actualLength = problem.passage.length;

      if (actualLength < min * 0.8 || actualLength > max * 1.2) {
        warnings.push(
          `지문 길이가 목표 범위를 벗어났습니다 (목표: ${targetRange}, 실제: ${actualLength}자)`
        );
      }
    }
  }

  // 3. 선택지 품질 검증
  if (problem.options) {
    const optionLengths = problem.options.map((opt) => opt.length);
    const avgLength =
      optionLengths.reduce((a, b) => a + b, 0) / optionLengths.length;

    if (avgLength < 10) {
      warnings.push("선택지가 너무 짧습니다");
    }

    // 선택지가 너무 비슷한지 체크 (간단한 휴리스틱)
    const uniqueStarts = new Set(
      problem.options.map((opt) => opt.substring(0, 5))
    );
    if (uniqueStarts.size < 3) {
      warnings.push("선택지가 너무 유사할 수 있습니다");
    }
  }

  return {
    isValid,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * 메타데이터를 읽기 쉬운 형식으로 출력하는 함수
 * @param {Object} metadata - 메타데이터 객체
 */
function printMetadata(metadata) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 문제 생성 메타데이터");
  console.log("=".repeat(80));

  console.log("\n🕐 생성 정보:");
  console.log(
    `  - 생성 시각: ${new Date(metadata.generatedAt).toLocaleString("ko-KR")}`
  );
  console.log(`  - 총 소요 시간: ${metadata.generationTimeMs}ms`);
  console.log(`  - API 호출 시간: ${metadata.apiCallTimeMs || "N/A"}ms`);
  console.log(
    `  - 문제 출처: ${metadata.source === "ai" ? "AI 생성" : "백업 문제"}`
  );
  console.log(`  - 버전: ${metadata.version}`);

  if (metadata.parameters) {
    const p = metadata.parameters;

    console.log("\n📝 주제:");
    if (p.topic) {
      console.log(`  - 카테고리: ${p.topic.categoryLabel}`);
      console.log(`  - 선택된 주제: ${p.topic.topic}`);
      console.log(
        `  - 카테고리 내 총 주제 수: ${p.topic.totalTopicsInCategory}개`
      );
    }

    console.log("\n📚 장르:");
    if (p.genre) {
      console.log(`  - 장르명: ${p.genre.label} (${p.genre.type})`);
      console.log(`  - 설명: ${p.genre.description}`);
      console.log(`  - 특징: ${p.genre.characteristics.join(", ")}`);
      console.log(`  - 어휘 초점: ${p.genre.vocabularyFocus}`);
      console.log(`  - 문법 스타일: ${p.genre.grammarStyle}`);
    }

    console.log("\n📏 길이:");
    if (p.length) {
      console.log(`  - 길이 타입: ${p.length.label} (${p.length.type})`);
      console.log(`  - 서브타입: ${p.length.subtypeLabel}`);
      console.log(`  - 문자 범위: ${p.length.characterRange}`);
      console.log(`  - 예상 소요 시간: ${p.length.estimatedTime}분`);
      console.log(`  - 특징: ${p.length.characteristics.join(", ")}`);
      console.log(`  - 문제 초점: ${p.length.questionEmphasis}`);
    }

    console.log("\n🎭 화자:");
    if (p.speaker) {
      console.log(`  - 화자: ${p.speaker.label} (${p.speaker.type})`);
      console.log(`  - 연령대: ${p.speaker.ageRange}`);
      console.log(`  - 문체: ${p.speaker.writingStyle}`);
      console.log(`  - 어휘 수준: ${p.speaker.vocabularyLevel}`);
      console.log(`  - 어조: ${p.speaker.toneCharacteristic}`);
    } else {
      console.log("  - 중립적 화자 (화자 정보 없음)");
    }

    console.log("\n🎯 N1 함정 요소:");
    if (p.n1Traps) {
      console.log(`  - 도입부: ${p.n1Traps.opening}`);
      console.log(`  - 중간부: ${p.n1Traps.middle}`);
      console.log(`  - 결론부: ${p.n1Traps.conclusion}`);
    }
  }

  if (metadata.validation) {
    console.log("\n✅ 품질 검증:");
    console.log(
      `  - 검증 결과: ${metadata.validation.isValid ? "통과" : "경고 있음"}`
    );
    if (metadata.validation.warnings.length > 0) {
      console.log(`  - 경고사항:`);
      metadata.validation.warnings.forEach((warning) => {
        console.log(`    ⚠️ ${warning}`);
      });
    }
  }

  if (metadata.warnings) {
    console.log("\n⚠️ 기타 경고:");
    metadata.warnings.forEach((warning) => {
      console.log(`  - ${warning}`);
    });
  }

  if (metadata.error) {
    console.log("\n❌ 오류 정보:");
    console.log(`  - 메시지: ${metadata.error.message}`);
    if (metadata.error.stack) {
      console.log(`  - 스택 트레이스: ${metadata.error.stack}`);
    }
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

// ========================================
// Export 및 전역 사용 설정 (수정된 버전)
// ========================================

// 브라우저 환경에서 즉시 window 객체에 연결
if (typeof window !== "undefined") {
  window.generateReadingProblem = generateReadingProblem;
  window.printMetadata = printMetadata;
  window.validateProblem = validateProblem;

  console.log("✅ generate-reading.js 로드 완료");
  console.log("사용 가능한 함수:", {
    generateReadingProblem: typeof window.generateReadingProblem,
    printMetadata: typeof window.printMetadata,
    validateProblem: typeof window.validateProblem,
  });
}

// Node.js 환경을 위한 export (옵션)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateReadingProblem,
    printMetadata,
    validateProblem,
  };
}

// ========================================
// 사용 예시 (개발 모드에서만)
// ========================================
if (isDevelopment && typeof window !== "undefined") {
  console.log("🔧 개발 모드: 테스트 함수 사용 가능");
  console.log("  - generateReadingProblem() : 문제 생성");
  console.log("  - printMetadata(result.metadata) : 메타데이터 출력");
}
