// public/js/api/apiClient.js (수정 버전)
/**
 * 백엔드 API 호출 전용 클라이언트 + 백업 시스템
 */

/**
 * 문제 생성 API 호출 (백업 시스템 포함)
 * @param {Object} options - { lengthKey, levels, preferredCategory }
 * @returns {Promise<Object>} { success, problem, metadata }
 */
export async function generateReadingProblem(options) {
  try {
    console.log("🔄 API 호출 시도:", options);

    const response = await fetch("/api/generate-reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    const data = await response.json();

    // 응답이 실패한 경우
    if (!response.ok) {
      console.warn("⚠️ API 응답 실패, 백업 시스템 활성화");
      return await useFallbackProblem(options);
    }

    // 백엔드가 success: false를 반환한 경우
    if (!data.success) {
      console.warn("⚠️ 문제 생성 실패, 백업 시스템 활성화");
      return await useFallbackProblem(options);
    }

    console.log("✅ API 호출 성공");
    return data;
  } catch (error) {
    console.error("❌ API 호출 에러, 백업 문제 사용:", error);
    return await useFallbackProblem(options);
  }
}

/**
 * 백업 문제 제공 (API 실패 시)
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function useFallbackProblem(options) {
  const { levels = ["N1"], lengthKey = "medium" } = options;

  // 간단한 백업 문제 (실제로는 backup-problems.json에서 로드)
  const fallbackProblem = {
    passage:
      "技術の進歩により、私たちの生活は大きく変化してきました。特に情報技術の発展は、コミュニケーションの方法や仕事の進め方に革命的な変化をもたらしました。しかし、この急速な変化に適応できない人々も少なくありません。デジタルデバイドと呼ばれるこの問題は、世代間や地域間の格差を生み出す要因となっています。\n\n今後は、すべての人が技術の恩恵を受けられるような社会の実現が求められています。そのためには、教育の充実や、誰もが使いやすい技術の開発が不可欠です。技術は人々の生活を豊かにする道具であり、それを実現するのは私たち自身の努力にかかっているのです。",
    questions: [
      {
        question: "この文章で述べられている主な問題は何か。",
        options: [
          "技術進歩の速度が遅いこと",
          "情報技術が発展していないこと",
          "技術の変化に適応できない人がいること",
          "デジタルデバイスの価格が高いこと",
        ],
        correctAnswer: 2,
        explanation:
          "文章の中盤で「この急速な変化に適応できない人々も少なくありません」と述べられており、デジタルデバイドの問題が指摘されています。",
      },
      {
        question: "筆者が考える解決策として適切なものはどれか。",
        options: [
          "技術の発展を止めること",
          "教育の充実と使いやすい技術の開発",
          "デジタル機器の使用を制限すること",
          "世代間の交流を減らすこと",
        ],
        correctAnswer: 1,
        explanation:
          "「教育の充実や、誰もが使いやすい技術の開発が不可欠です」と明記されています。",
      },
      {
        question: "この文章の結論として最も適切なものはどれか。",
        options: [
          "技術は危険なものである",
          "技術の恩恵を受けるには個人の努力が必要",
          "すべての人が技術を使う必要はない",
          "技術の発展を止めるべきだ",
        ],
        correctAnswer: 1,
        explanation:
          "最後に「それを実現するのは私たち自身の努力にかかっている」と述べられています。",
      },
    ],
  };

  return {
    success: true,
    problem: fallbackProblem,
    metadata: {
      level: levels[0],
      levels,
      lengthKey,
      topic: "技術と社会",
      category: "社会",
      isFallback: true,
      generatedAt: new Date().toISOString(),
    },
    warning: "⚠️ API接続エラーのため、サンプル問題を表示しています",
  };
}

/**
 * PDF용 문제 분석 API 호출
 */
export async function analyzeProblemForPDF(problem, metadata) {
  try {
    const response = await fetch("/api/analyze-for-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem, metadata }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "分析に失敗しました");
    }

    return data.analysis;
  } catch (error) {
    console.error("❌ PDF分析失敗, 基本情報のみ返却:", error);

    // 백업: 간단한 분석 결과 반환
    return {
      translation: "翻訳を取得できませんでした",
      vocabulary: [],
      grammar: [],
      error: true,
    };
  }
}

/**
 * API 상태 체크 (헬스체크)
 */
export async function checkAPIHealth() {
  try {
    const response = await fetch("/api/health", { method: "GET" });
    return response.ok;
  } catch (error) {
    console.error("❌ API ヘルスチェック失敗:", error);
    return false;
  }
}
