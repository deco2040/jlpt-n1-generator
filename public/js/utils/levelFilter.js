/* public/js/utils/levelFilter.js */
/* 역할: UI → API 요청만 구성. 통계가 필요하면 API로 조회 */
export function buildGeneratePayload({ lengthKey, levels, preferredCategory }) {
  return {
    lengthKey: lengthKey || "medium",
    levels: Array.isArray(levels) && levels.length ? levels : ["N1"],
    preferredCategory: preferredCategory || null,
  };
}

// (선택) 서버 통계/프리뷰용 라우트가 있다면 거기 호출
export async function requestGenerate(payload) {
  const res = await fetch("/api/generate-reading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "生成失敗");
  return data;
}
