const usedPrompts = new Set();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed",
      message: "Only POST requests are allowed.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing prompt",
        message: "Request must include a valid prompt string.",
      });
    }

    if (usedPrompts.has(prompt.trim())) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        result: "[중복된 프롬프트로 인해 재생성하지 않았습니다.]",
      });
    }

    // 환경변수에서 API 키 가져오기
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "API Key Missing",
        message: "Anthropic API key is not configured.",
      });
    }

    console.log("Anthropic API 호출 시작...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1200,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    console.log("API 응답 상태:", response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API 오류:", errorData);
      return res.status(response.status).json({
        success: false,
        error: `API Error: ${response.status}`,
        message: errorData.error?.message || "API 호출 실패",
        details: errorData,
      });
    }

    const data = await response.json();
    console.log("API 응답 데이터:", JSON.stringify(data, null, 2));

    // ✅ 올바른 Anthropic API 응답 구조 사용
    const content = data.content?.[0]?.text?.trim();

    if (!content) {
      console.error("응답 내용이 없음:", data);
      return res.status(500).json({
        success: false,
        error: "Empty Response",
        message: "API 응답에서 내용을 찾을 수 없습니다.",
        apiResponse: data,
      });
    }

    console.log("추출된 내용:", content);

    // JSON 파싱 시도
    let parsedContent;
    try {
      // Claude의 응답에서 JSON 블록 추출
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
        console.log("JSON 파싱 성공:", parsedContent);
      } else {
        console.log("JSON 형식이 아닌 텍스트 응답");
        parsedContent = content;
      }
    } catch (parseError) {
      console.warn("JSON 파싱 실패, 원본 텍스트 반환:", parseError.message);
      parsedContent = content;
    }

    usedPrompts.add(prompt.trim());

    return res.status(200).json({
      success: true,
      result: parsedContent,
      rawResponse: content, // 디버깅용 원본 응답
    });
  } catch (error) {
    console.error("서버 오류:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
}
