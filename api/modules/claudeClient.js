// api/modules/claudeClient.js
// Claude API 호출 전담 모듈

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Claude API 호출 설정
 */
const API_CONFIG = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 4000,
  temperature: 0.8,
  system: `あなたはJLPT N1レベルの日本語読解問題を生成する専門家です。
- 実際のJLPT試験と同じ難易度と形式で問題を作成します
- 文章は自然で論理的な構成を持ち、高度な語彙と文法を使用します
- 問題は本文の深い理解を要求する内容にします
- 回答は必ず指定されたJSON形式のみで返します`,
};

/**
 * Claude API 호출
 * @param {string} prompt - 생성할 프롬프트
 * @param {boolean} shouldLog - 프롬프트 로그 출력 여부
 * @returns {Promise<string>} Claude의 응답 텍스트
 * @throws {Error} API 호출 실패 시
 */
export async function callClaudeAPI(prompt, shouldLog = false) {
  if (shouldLog) {
    console.log("=".repeat(80));
    console.log("📝 프롬프트 전송:");
    console.log("=".repeat(80));
    console.log(prompt);
    console.log("=".repeat(80));
  }

  try {
    const message = await anthropic.messages.create({
      model: API_CONFIG.model,
      max_tokens: API_CONFIG.max_tokens,
      temperature: API_CONFIG.temperature,
      system: API_CONFIG.system,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    if (!message?.content?.[0]?.text) {
      throw new Error("Claude API 응답이 비어있습니다");
    }

    const responseText = message.content[0].text;

    if (shouldLog) {
      console.log("=".repeat(80));
      console.log("✅ Claude 응답:");
      console.log("=".repeat(80));
      console.log(responseText);
      console.log("=".repeat(80));
    }

    return responseText;
  } catch (error) {
    console.error("❌ Claude API 호출 실패:", error);

    if (error.status === 429) {
      throw new Error("API 호출 한도 초과. 잠시 후 다시 시도해주세요.");
    }

    if (error.status === 401) {
      throw new Error("API 키가 유효하지 않습니다.");
    }

    throw new Error(`Claude API 오류: ${error.message}`);
  }
}

/**
 * 프롬프트 로그 출력 여부 판단
 * @returns {boolean}
 */
export function shouldLogPrompt() {
  if (process.env.LOG_FULL_PROMPT === "true") return true;
  return process.env.NODE_ENV !== "production";
}
