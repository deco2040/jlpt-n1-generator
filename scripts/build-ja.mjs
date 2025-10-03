#!/usr/bin/env node
/**
 * KO→JA 빌드 스크립트 (용어집 우선 + 초저온도 LLM 번역 + 캐시 + 폴백 + 타임아웃)
 * - Node 18+
 * - npm i @anthropic-ai/sdk
 *
 * 입력:  public/data/{topics.json, genre.json, length-definitions.json}
 * 출력:  public/data_ja/*.json
 *
 * ENV:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   ANTHROPIC_MODEL=claude-3-5-haiku-latest (옵션)
 *   LOG_LEVEL=info|silent
 *
 * CLI:
 *   --dry               파일 미생성(리포트/샘플만)
 *   --no-llm            LLM 미사용(용어집/캐시만, 미스는 원문 유지)
 *   --timeout-ms=15000  LLM 타임아웃(ms)
 *   --fields=topic,label,name,display_name,description  변환 대상 필드
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import process from "process";

// ========= 경로/기본설정 =========
const SRC_DIR = path.join(process.cwd(), "public", "data");
const OUT_DIR = path.join(process.cwd(), "public", "data_ja");
const CACHE_PATH = path.join(process.cwd(), "scripts/.cache_ko_ja.json");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry");
const NO_LLM = args.includes("--no-llm");
const tArg = args.find((a) => a.startsWith("--timeout-ms="));
const LLM_TIMEOUT_MS = tArg ? parseInt(tArg.split("=")[1], 10) : 15000;

const userFieldsArg = args.find((a) => a.startsWith("--fields="));
const DEFAULT_FIELDS = [
  "topic",
  "label",
  "name",
  "display_name",
  "description",
  "category",
];
const FIELDS = userFieldsArg
  ? userFieldsArg.replace("--fields=", "").split(",")
  : DEFAULT_FIELDS;

const LOG = (msg) => {
  if ((process.env.LOG_LEVEL || "info") !== "silent") console.log(msg);
};

// ========= 모델 폴백 후보 =========
const MODEL_CANDIDATES = [
  process.env.ANTHROPIC_MODEL, // .env 우선 지정
  "claude-3-5-haiku-latest",
  "claude-3-5-haiku-20241022",
  "claude-3-5-sonnet-latest",
  "claude-3-5-sonnet-20241022",
].filter(Boolean);

// ========= 용어집(우선 치환) =========
const GLOSSARY = {
  // 카테고리
  사회: "社会",
  과학: "科学",
  교육: "教育",
  문화: "文化",
  경제: "経済",
  환경: "環境",
  "환경과 지속가능성": "環境と持続可能性",
  // 장르
  논설문: "論説文",
  사설: "社説",
  칼럼: "コラム",
  기사문: "記事文",
  설명문: "説明文",
  에세이: "エッセイ",
  // 길이/기타 라벨 예시
  짧음: "短文",
  중간: "中等",
  길음: "長文",
};

// ========= 유틸 =========
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}
function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) return readJSON(CACHE_PATH);
  } catch (_) {}
  return {};
}
function saveCache(cache) {
  ensureDir(path.dirname(CACHE_PATH));
  writeJSON(CACHE_PATH, cache);
}

function glossaryTranslate(str) {
  if (typeof str !== "string") return null;
  return Object.prototype.hasOwnProperty.call(GLOSSARY, str)
    ? GLOSSARY[str]
    : null;
}

// ========= Anthropic 클라이언트 & 호출 래퍼 =========
const anthropic = new Anthropic({
  apiKey:
    "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",
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`LLM timeout ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
}

async function anthropicCallWithFallback(payload) {
  let lastErr;
  for (const model of MODEL_CANDIDATES) {
    try {
      const resp = await withTimeout(
        anthropic.messages.create({ ...payload, model }),
        LLM_TIMEOUT_MS
      );
      return resp;
    } catch (e) {
      const msg = (e?.error?.message || e.message || "").toLowerCase();
      if (msg.includes("not_found") || msg.includes("model")) {
        console.warn(`[Anthropic] model miss '${model}', try next.`);
        lastErr = e;
        continue;
      }
      lastErr = e;
      break;
    }
  }
  throw lastErr || new Error("No Anthropic model available");
}

// ========= 초저온도 LLM 번역 =========
async function llmTranslateKoToJa(str) {
  const system = `あなたは韓日翻訳者です。以下の方針に従って韓国語ラベルを自然な日本語ラベルに翻訳します。
- 固有名詞・技術用語はそのまま
- 冗長な説明は加えない
- 出力は日本語ラベルのみ（装飾・引用符なし）
- 文体は見出し/項目名として簡潔に`;

  const user = `韓国語ラベル: ${str}
上記を自然な日本語に1行で翻訳してください。`;

  const resp = await anthropicCallWithFallback({
    max_tokens: 100,
    temperature: 0.1,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = resp.content?.[0]?.text?.trim() ?? "";
  return text.replace(/^["'`]|["'`]$/g, "");
}

// ========= 번역 파이프(용어집 → 캐시 → LLM) =========
async function translateValue(str, cache) {
  if (typeof str !== "string" || !str.trim()) return str;

  // 1) 용어집
  const hit = glossaryTranslate(str);
  if (hit) return hit;

  // 2) 캐시
  if (cache[str]) return cache[str];

  // 3) LLM
  if (NO_LLM) {
    LOG(`[NO-LLM] '${str}' → 원문 유지`);
    return str;
  }
  LOG(`[LLM] 요청: '${str}'`);
  const ja = await llmTranslateKoToJa(str).catch((e) => {
    console.warn(`[LLM ERROR] ${e.message} → 원문 유지: '${str}'`);
    return str;
  });
  cache[str] = ja;
  return ja;
}

// ========= 지정 필드만 변환 =========
async function traverseAndTranslate(obj, cache) {
  if (Array.isArray(obj)) {
    const out = [];
    for (const v of obj) out.push(await traverseAndTranslate(v, cache));
    return out;
  }
  if (obj && typeof obj === "object") {
    const copy = {};
    for (const [k, v] of Object.entries(obj)) {
      if (FIELDS.includes(k) && typeof v === "string") {
        copy[k] = await translateValue(v, cache);
      } else {
        copy[k] = await traverseAndTranslate(v, cache);
      }
    }
    return copy;
  }
  return obj;
}

// ========= 파일 단위 변환 =========
async function convertFile(filename, cache) {
  const srcPath = path.join(SRC_DIR, filename);
  if (!fs.existsSync(srcPath)) {
    LOG(`[SKIP] ${filename} 없음`);
    return;
  }
  LOG(`→ 시작: ${filename}`);
  const src = readJSON(srcPath);
  const ja = await traverseAndTranslate(src, cache);

  // 스키마 간단 검증
  if (filename === "topics.json") {
    if (!ja.topics || typeof ja.topics !== "object") {
      throw new Error("topics.json 스키마 검증 실패(최상위 'topics' 누락)");
    }
  }

  if (DRY_RUN) {
    LOG(`[DRY] ${filename} 변환 완료(파일 미생성)`);
    // 샘플 앞부분 출력
    console.log(JSON.stringify(ja, null, 2).slice(0, 600) + "...\n---");
  } else {
    ensureDir(OUT_DIR);
    const outPath = path.join(OUT_DIR, filename);
    writeJSON(outPath, ja);
    LOG(`[OK] ${filename} → data_ja/${filename}`);
  }
  LOG(`✓ 완료: ${filename}`);
}

// ========= 메인 실행 =========
async function run() {
  LOG(`변환 대상 필드: ${FIELDS.join(", ")}`);
  LOG(
    `모드: ${DRY_RUN ? "DRY" : "WRITE"} / LLM: ${
      NO_LLM ? "OFF" : "ON"
    } / TIMEOUT: ${LLM_TIMEOUT_MS}ms`
  );
  LOG(`모델 후보: ${MODEL_CANDIDATES.join(", ")}`);

  const cache = loadCache();

  const files = ["topics.json", "genre.json", "length-definitions.json"];
  for (const f of files) {
    await convertFile(f, cache);
  }

  if (!DRY_RUN) saveCache(cache);
  LOG("✅ 변환 완료");
}

run().catch((e) => {
  console.error("❌ 변환 실패:", e);
  process.exit(1);
});
