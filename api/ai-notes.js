// Vercel Serverless Function: Secure Multi-Tier AI Revision Notes & Subtitles Proxy
// Node.js Serverless Function with CORS support

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || "AIzaSyCJMXtURF6hI4o7jsDE1s8amZ6YWVZnsxs";
const DEFAULT_TRANSCRIPT_KEY = process.env.TRANSCRIPT_API_KEY || "sk_ONWiUzoql4Jelc8U31dB48ixTXU04El3kUsYb0ndCaM";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { videoId, startTimeStr, endTimeStr, startSec, endSec, videoTitle, subject, chapter, topicTitle, tag } = req.body || {};

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    const start = typeof startSec === 'number' ? startSec : (parseFloat(startSec) || 0);
    const end = typeof endSec === 'number' ? endSec : (parseFloat(endSec) || (start + 90));

    let verbatimTranscript = '';
    let fetchedFromTranscriptAPI = false;

    // 1. Fetch exact subtitles from TranscriptAPI.com securely
    try {
      const tUrl = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(videoId)}`;
      const tResp = await fetch(tUrl, {
        headers: { 'Authorization': `Bearer ${DEFAULT_TRANSCRIPT_KEY}` }
      });
      if (tResp.ok) {
        const tData = await tResp.json();
        const list = tData?.transcript || [];
        if (list.length > 0) {
          const filtered = list.filter(item => {
            const itemStart = typeof item.start === 'number' ? item.start : parseFloat(item.start || 0);
            return itemStart >= (start - 1.5) && (end ? itemStart <= (end + 1.5) : true);
          });
          if (filtered.length > 0) {
            verbatimTranscript = filtered.map(item => item.text.replace(/\[.*?\]/g, '').trim()).filter(Boolean).join(' ');
            fetchedFromTranscriptAPI = true;
          }
        }
      }
    } catch (tErr) {
      console.warn('TranscriptAPI backend notice:', tErr.message);
    }

    // 2. Generate Master Academic Professor Notes with Google Gemini 2.5 Flash
    let aiNotes = '';
    try {
      const transcriptContext = verbatimTranscript 
        ? `\n- Spoken Transcript in this timeframe: "${verbatimTranscript}"` 
        : '';

      const prompt = `You are an elite academic professor, Master Teacher, and top exam mentor for Indian competitive exam students (JEE Advanced, NEET-UG, CBSE Class 10/11/12, UPSC, Coding Interviews).
Your student is saving an essential lecture clip:
- Lecture Title: "${videoTitle || 'Educational Lecture'}"
- YouTube URL: https://www.youtube.com/watch?v=${videoId}
- Timeframe: ${startTimeStr || '00:00:00'} to ${endTimeStr || 'End'}
- Subject: ${subject || 'General Science / Math / Coding'}
- Chapter: ${chapter || 'Important Chapter'}
- Topic / Question Title: "${topicTitle || 'Core Exam Concept'}"
- Category: "${tag || 'Key Concept'}"${transcriptContext}

CRITICAL INSTRUCTIONS:
- DO NOT write conversational greetings or filler (e.g. DO NOT say "Alright future toppers!", "Hello students", etc.).
- Start DIRECTLY with the structured notes.
- Write in razor-sharp, exam-focused Hinglish/English.

🎓 1. MASTER TEACHER'S CONCEPTUAL BREAKDOWN:
• (Concise point on core intuition)
• (Key concept explained step-by-step)

⚡ 2. TOPPER'S SECRET SHORTCUT & TRICK:
• (Speed calculation trick / mnemonic)

⚠️ 3. EXAM TRAP ALERT:
• (Common trap / negative marking trap to avoid)

📐 4. MUST-REMEMBER FORMULAS & DEFINITIONS:
• (Exact equations, formulas, or law)`;

      const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${DEFAULT_GEMINI_KEY}`;
      const gResp = await fetch(gUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 700 }
        })
      });

      if (gResp.ok) {
        const gData = await gResp.json();
        aiNotes = gData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      }
    } catch (gErr) {
      console.warn('Gemini backend notice:', gErr.message);
    }

    return res.status(200).json({
      success: true,
      verbatimTranscript,
      aiNotes,
      fetchedFromTranscriptAPI
    });

  } catch (err) {
    console.error('Serverless error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
