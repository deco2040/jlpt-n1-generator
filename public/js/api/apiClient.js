/* ============================================ */
/* public/js/api/apiClient.js */
/* ============================================ */
/**
 * api/apiClient.js
 * 백엔드 API 호출 함수
 */

/**
 * 문제 생성 API 호출
 */
// /public/js/api/apiClient.js
export async function generateReadingProblem(options) {
  const response = await fetch("/api/generate-reading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!response.ok) throw new Error("API error");
  return await response.json();
}

export async function analyzeProblemForPDF(problem, metadata) {
  const response = await fetch("/api/analyze-for-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem, metadata }),
  });

  if (!response.ok) throw new Error("Analysis failed");
  return (await response.json()).analysis;
}
