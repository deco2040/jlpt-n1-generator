// api/generate-reading-enhanced.js
// JLPT N1 독해 문제 생성 (화자 정보 랜덤 선택 포함)

async function generateReadingProblem() {
  try {
    // topics.json에서 주제 로드
    const topicsResponse = await fetch("data/topics.json");
    const topicsData = await topicsResponse.json();

    // 랜덤 카테고리 선택
    const categories = Object.keys(topicsData.categories);
    const randomCategory =
      categories[Math.floor(Math.random() * categories.length)];
    const categoryTopics = topicsData.categories[randomCategory];

    // 해당 카테고리에서 랜덤 주제 선택
    const randomTopic =
      categoryTopics[Math.floor(Math.random() * categoryTopics.length)];
    const selectedTopic = randomTopic.topic;

    console.log(
      "선택된 주제:",
      selectedTopic,
      "(카테고리:",
      randomCategory,
      ")"
    );

    // speakers.json에서 랜덤 화자 선택
    let speakerInfo = null;
    try {
      const speakersResponse = await fetch("data/speakers.json");
      const speakersData = await speakersResponse.json();

      // speaker_categories에서 랜덤 카테고리 선택
      const speakerCategories = Object.keys(speakersData.speaker_categories);
      const randomSpeakerCategory =
        speakerCategories[Math.floor(Math.random() * speakerCategories.length)];
      const speakerCategory =
        speakersData.speaker_categories[randomSpeakerCategory];

      // 카테고리 내에서 랜덤 화자 타입 선택
      const speakerTypes = Object.keys(speakerCategory);
      const randomType =
        speakerTypes[Math.floor(Math.random() * speakerTypes.length)];
      const speaker = speakerCategory[randomType];

      // 각 속성에서 랜덤 선택
      speakerInfo = {
        category: randomSpeakerCategory,
        type: randomType,
        label: speaker.label,
        ageRange:
          speaker.age_ranges[
            Math.floor(Math.random() * speaker.age_ranges.length)
          ],
        writingStyle:
          speaker.writing_styles[
            Math.floor(Math.random() * speaker.writing_styles.length)
          ],
        vocabularyLevel:
          speaker.vocabulary_levels[
            Math.floor(Math.random() * speaker.vocabulary_levels.length)
          ],
        toneCharacteristic:
          speaker.tone_characteristics[
            Math.floor(Math.random() * speaker.tone_characteristics.length)
          ],
      };

      console.log("선택된 화자:", speakerInfo);
    } catch (error) {
      console.warn("화자 정보 로드 실패, 기본값 사용:", error);
    }

    // 화자 정보를 프롬프트에 포함
    const speakerPrompt = speakerInfo
      ? `
7. 화자 설정:
   - 화자 유형: ${speakerInfo.label}
   - 연령대: ${speakerInfo.ageRange}
   - 문체 스타일: ${speakerInfo.writingStyle}
   - 어휘 수준: ${speakerInfo.vocabularyLevel}
   - 어조 특징: ${speakerInfo.toneCharacteristic}
   
   이 화자의 특성을 자연스럽게 반영하여 독해 지문을 작성해주세요.
   화자의 전문성과 관점이 드러나도록 하되, JLPT N1 수준을 유지해주세요.
   화자의 연령대와 직업적 배경에 맞는 어휘와 표현을 사용하세요.`
      : "";

    // 독해 문제 생성 요청
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
            content: `당신은 JLPT N1 수준의 일본어 독해 문제를 출제하는 전문가입니다.

다음 조건을 만족하는 독해 문제를 생성해주세요:

1. 주제: "${selectedTopic}"
2. 지문 길이: 150-200자
3. 난이도: JLPT N1 수준
4. 포함 요소:
   - N1 수준의 고급 문법 (예: ～にとどまらず、～をもってしても、～ならでは 등)
   - 신문이나 논문에서 사용되는 격식있는 어휘
   - 논리적 전개를 나타내는 접속사 (したがって、ゆえに、なお 등)
   - 추상적이고 전문적인 내용

5. 문제 요구사항:
   - 지문의 주제나 주장을 정확히 이해했는지 평가
   - 4개의 선택지 중 1개만 정답
   - 오답 선택지는 일부만 맞거나 미묘하게 다른 내용으로 구성
   - 선택지는 각각 15-25자 정도

6. 화자의 관점:
   - 지문은 특정 화자의 의견이나 주장을 담고 있어야 합니다
   - 화자의 전문성과 경험이 반영된 내용이어야 합니다
${speakerPrompt}

반드시 다음 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요:

{
  "passage": "독해 지문 (150-200자)",
  "question": "이 글의 주장으로 가장 적절한 것은?",
  "options": [
    "선택지1",
    "선택지2",
    "선택지3",
    "선택지4"
  ],
  "correctAnswer": 0,
  "explanation": "정답 해설 (왜 해당 선택지가 정답인지, 다른 선택지는 왜 오답인지)",
  "grammarPoints": ["문법포인트1", "문법포인트2"],
  "vocabularyLevel": "N1",
  "speaker": {
    "label": "${speakerInfo?.label || ""}",
    "ageRange": "${speakerInfo?.ageRange || ""}",
    "writingStyle": "${speakerInfo?.writingStyle || ""}",
    "toneCharacteristic": "${speakerInfo?.toneCharacteristic || ""}",
    "perspective": "화자의 관점이 어떻게 반영되었는지 설명"
  }
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();

    if (data.content && data.content[0] && data.content[0].text) {
      let responseText = data.content[0].text.trim();
      responseText = responseText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "");

      const problemData = JSON.parse(responseText);

      // 화자 정보 저장
      if (speakerInfo) {
        problemData.speaker = speakerInfo;
      }

      return problemData;
    } else {
      throw new Error("API 응답 형식이 올바르지 않습니다");
    }
  } catch (error) {
    console.error("독해 문제 생성 중 오류:", error);

    // 에러 발생 시 백업 문제 반환
    return {
      passage:
        "現代社会において、技術革新は目覚ましい発展を遂げている。しかしながら、技術の進歩が必ずしも人間の幸福に直結するとは限らない。むしろ、技術に依存しすぎることで、人間本来の能力や感性が衰退する危険性も指摘されている。したがって、技術と人間性のバランスを保つことが、今後の課題として挙げられる。",
      question: "この文章の主張として最も適切なものは？",
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
      speaker: {
        label: "백업 문제",
        ageRange: "N/A",
        writingStyle: "기본",
        toneCharacteristic: "중립",
        perspective: "기본 백업 문제",
      },
      error: error.message,
    };
  }
}

// 브라우저 환경에서 전역으로 사용 가능하도록 설정
if (typeof window !== "undefined") {
  window.generateReadingProblem = generateReadingProblem;
}

// Node.js 환경을 위한 export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateReadingProblem };
}
