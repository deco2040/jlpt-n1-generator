import { useEffect, useState } from "react";

const TopicGenreGenerator = () => {
  const [topics, setTopics] = useState(null);
  const [genres, setGenres] = useState(null);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState([]);

  // JSON 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // topics.json 데이터 읽기
        const topicsResponse = await fetch("/topics.json");
        const parsedTopics = await topicsResponse.json();

        setTopics(parsedTopics);

        // genre.json 데이터 읽기
        const genresResponse = await fetch("/genre.json");
        const parsedGenres = await genresResponse.json();

        setGenres(parsedGenres);
      } catch (error) {
        console.error("JSON 파일 로드 실패:", error);
        // 백업 데이터 사용
        setTopics(getBackupTopics());
        setGenres(getBackupGenres());
      }
    };

    loadData();
  }, []);

  // 백업 데이터 (파일 로드 실패시 사용)
  const getBackupTopics = () => ({
    topics: {
      social_structure_and_inequality: {
        category: "사회 구조와 불평등",
        items: [
          "고령화 사회와 세대 간 부양 문제의 윤리적 딜레마",
          "저출산 현상이 일본 사회 구조에 미치는 장기적 영향",
          "경제 불평등 심화와 사회 계층 이동 가능성",
        ],
      },
      work_and_economic_transformation: {
        category: "노동과 경제 변화",
        items: [
          "노동 환경 개선과 개인의 삶의 질 향상 방안",
          "일자리 자동화와 인간 노동의 새로운 가치",
          "원격 근무와 생산성: 새로운 업무 패러다임",
        ],
      },
    },
  });

  const getBackupGenres = () => [
    {
      type: "essay",
      label: "エッセイ（수필）",
      description: "개인적 경험이나 감정을 바탕으로 한 자율적이고 감성적인 글",
      features: ["1인칭 시점", "자아 성찰", "감정 표현", "비유적 언어"],
      instructions:
        "Write in a reflective and expressive tone, using personal experience and emotional language.",
    },
    {
      type: "editorial",
      label: "論説文（논설문）",
      description: "주장과 근거를 통해 독자를 설득하는 목적의 논리적 글",
      features: ["명확한 입장", "논리적 전개", "객관적 근거", "결론 제시"],
      instructions:
        "State a clear thesis, support it with logical arguments and evidence.",
    },
  ];

  // 랜덤 주제 선택
  const getRandomTopic = () => {
    if (!topics || !topics.topics) return null;

    const categoryKeys = Object.keys(topics.topics);
    const randomCategoryKey =
      categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const category = topics.topics[randomCategoryKey];
    const randomItem =
      category.items[Math.floor(Math.random() * category.items.length)];

    return {
      categoryKey: randomCategoryKey,
      category: category.category,
      topic: randomItem,
    };
  };

  // 랜덤 장르 선택
  const getRandomGenre = () => {
    if (!genres || genres.length === 0) return null;
    return genres[Math.floor(Math.random() * genres.length)];
  };

  // 프롬프트 생성
  const generatePrompt = () => {
    setIsGenerating(true);

    setTimeout(() => {
      const selectedTopic = getRandomTopic();
      const selectedGenre = getRandomGenre();

      if (!selectedTopic || !selectedGenre) {
        setIsGenerating(false);
        return;
      }

      const prompt = {
        id: Date.now(),
        topic: selectedTopic,
        genre: selectedGenre,
        generatedAt: new Date().toLocaleString("ko-KR"),
        fullPrompt: createFullPrompt(selectedTopic, selectedGenre),
      };

      setCurrentPrompt(prompt);
      setHistory((prev) => [prompt, ...prev.slice(0, 9)]); // 최근 10개만 유지
      setIsGenerating(false);
    }, 1000);
  };

  // 완전한 프롬프트 문자열 생성
  const createFullPrompt = (topic, genre) => {
    return `JLPT N1 수준의 ${genre.label} 작성 과제

**주제**: ${topic.topic}
**카테고리**: ${topic.category}
**장르**: ${genre.label}

**장르 특징**:
${genre.features.map((f) => `• ${f}`).join("\n")}

**작성 지침**:
${genre.description}

${genre.instructions}

**요구사항**:
• 800-1000자 분량
• N1 수준의 고급 어휘와 문법 사용
• 논리적이고 일관성 있는 구성
• 주제에 대한 깊이 있는 사고와 분석
• 일본어 원어민 수준의 자연스러운 표현

위 주제와 장르에 맞춰 일본어 소논문을 작성해주세요.`;
  };

  // 프롬프트 복사
  const copyPrompt = (prompt) => {
    navigator.clipboard
      .writeText(prompt.fullPrompt)
      .then(() => alert("프롬프트가 클립보드에 복사되었습니다!"))
      .catch(() => alert("복사 실패"));
  };

  if (!topics || !genres) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">JSON 데이터를 로드하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📝 JLPT N1 주제/장르 랜덤 프롬프트 생성기
        </h1>
        <p className="text-gray-600">
          {topics?.metadata
            ? `${topics.metadata.total_categories}개 카테고리, ${Object.keys(
                topics.topics
              ).reduce(
                (sum, key) => sum + topics.topics[key].items.length,
                0
              )}개 주제`
            : "다양한 주제"}{" "}
          × {genres?.length || 0}개 장르 조합
        </p>
      </div>

      {/* 통계 정보 */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-800">
            {topics?.metadata?.total_categories ||
              Object.keys(topics?.topics || {}).length}
          </div>
          <div className="text-blue-600">주제 카테고리</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-800">
            {genres?.length || 0}
          </div>
          <div className="text-green-600">글 장르</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-800">
            {history.length}
          </div>
          <div className="text-purple-600">생성 이력</div>
        </div>
      </div>

      {/* 프롬프트 생성 버튼 */}
      <div className="text-center mb-8">
        <button
          onClick={generatePrompt}
          disabled={isGenerating}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors flex items-center gap-2 mx-auto"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              프롬프트 생성 중...
            </>
          ) : (
            <>🎲 랜덤 프롬프트 생성</>
          )}
        </button>
      </div>

      {/* 현재 프롬프트 */}
      {currentPrompt && (
        <div className="bg-gray-50 p-6 rounded-lg mb-8">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold">생성된 프롬프트</h3>
            <button
              onClick={() => copyPrompt(currentPrompt)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm"
            >
              📋 복사
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-100 p-4 rounded">
              <h4 className="font-semibold text-blue-800 mb-2">
                📚 선택된 주제
              </h4>
              <p className="text-sm text-blue-600 mb-1">
                카테고리: {currentPrompt.topic.category}
              </p>
              <p className="font-medium">{currentPrompt.topic.topic}</p>
            </div>
            <div className="bg-green-100 p-4 rounded">
              <h4 className="font-semibold text-green-800 mb-2">
                ✍️ 선택된 장르
              </h4>
              <p className="text-sm text-green-600 mb-1">
                {currentPrompt.genre.label}
              </p>
              <p className="text-sm">{currentPrompt.genre.description}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded border">
            <h4 className="font-semibold mb-2">완성된 프롬프트:</h4>
            <pre className="text-sm whitespace-pre-wrap text-gray-700 bg-gray-50 p-3 rounded overflow-auto max-h-96">
              {currentPrompt.fullPrompt}
            </pre>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            생성 시간: {currentPrompt.generatedAt}
          </div>
        </div>
      )}

      {/* 생성 이력 */}
      {history.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">최근 생성 이력</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {history.slice(0, 6).map((item) => (
              <div key={item.id} className="bg-gray-100 p-3 rounded text-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-gray-800">
                    {item.genre.label}
                  </div>
                  <button
                    onClick={() => copyPrompt(item)}
                    className="text-blue-500 hover:text-blue-600 text-xs"
                  >
                    복사
                  </button>
                </div>
                <p className="text-gray-600 text-xs mb-1">
                  {item.topic.category}
                </p>
                <p className="text-gray-700 truncate">
                  {item.topic.topic.substring(0, 50)}...
                </p>
                <div className="text-xs text-gray-500 mt-1">
                  {item.generatedAt}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 사용 가능한 주제 카테고리 미리보기 */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">
            📚 주제 카테고리 ({Object.keys(topics?.topics || {}).length}개)
          </h3>
          <div className="bg-gray-50 p-4 rounded max-h-64 overflow-y-auto">
            {Object.entries(topics?.topics || {}).map(([key, category]) => (
              <div key={key} className="mb-2">
                <div className="font-medium text-gray-800">
                  {category.category}
                </div>
                <div className="text-xs text-gray-600">
                  {category.items?.length || 0}개 주제
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">
            ✍️ 글 장르 ({genres?.length || 0}개)
          </h3>
          <div className="bg-gray-50 p-4 rounded max-h-64 overflow-y-auto">
            {genres?.map((genre) => (
              <div key={genre.type} className="mb-2">
                <div className="font-medium text-gray-800">{genre.label}</div>
                <div className="text-xs text-gray-600">
                  {genre.description.substring(0, 50)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div className="mt-12 text-center text-gray-500 text-sm">
        <p>JLPT N1 소논문 작성 연습을 위한 프롬프트 생성기</p>
        <p>매번 새로운 조합으로 다양한 주제와 장르를 경험해보세요.</p>
      </div>
    </div>
  );
};

export default TopicGenreGenerator;
