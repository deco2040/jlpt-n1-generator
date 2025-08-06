// api/test.js
export default async function handler(req, res) {
  console.log('테스트 API 호출됨');
  
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  return res.status(200).json({
    success: true,
    message: 'API가 정상적으로 작동합니다!',
    timestamp: new Date().toISOString(),
    method: req.method,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY
  });
}
