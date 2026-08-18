// Vercel Serverless Function: Secure Groq Whisper Speech-to-Text Proxy

const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || "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";

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
    const { base64Audio } = req.body || {};

    if (!base64Audio) {
      return res.status(400).json({ error: 'base64Audio is required' });
    }

    // Convert base64 data to buffer
    const base64Data = base64Audio.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: 'audio/webm' });

    const formData = new FormData();
    formData.append('file', blob, 'voicenote.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');

    const gResp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEFAULT_GROQ_KEY}`
      },
      body: formData
    });

    if (!gResp.ok) {
      const errText = await gResp.text();
      return res.status(gResp.status).json({ error: errText });
    }

    const data = await gResp.json();
    return res.status(200).json({
      success: true,
      text: data?.text ? data.text.trim() : ''
    });

  } catch (err) {
    console.error('Groq Whisper backend error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
