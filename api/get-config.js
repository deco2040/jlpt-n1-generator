// api/get-config.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    // 요청된 설정 파일 타입 확인
    const { type } = req.query;

    let filePath;
    switch (type) {
      case "length-definitions":
        filePath = path.join(process.cwd(), "data/length-definitions.json");
        break;
      case "genre":
        filePath = path.join(process.cwd(), "data/genre.json");
        break;
      case "topics":
        filePath = path.join(process.cwd(), "data/topics.json");
        break;
      default:
        return res.status(400).json({
          success: false,
          error: "Invalid config type",
        });
    }

    // 파일 읽기
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(fileContent);

    res.status(200).json({
      success: true,
      data: jsonData,
    });
  } catch (error) {
    console.error("Config 파일 로드 실패:", error);

    res.status(500).json({
      success: false,
      error: "Config file load failed",
      message: error.message,
    });
  }
}
