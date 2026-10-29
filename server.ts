import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsers with increased limits for Base64 image payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared Server-Side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const BODY_POINTS_FRONT = [
  'top_head', 'neck', 'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
  'left_hip', 'right_hip', 'left_knee', 'right_knee',
  'left_ankle', 'right_ankle', 'waist_left', 'waist_right',
  'chest_left', 'chest_right',
];

const BODY_POINTS_SIDE = [
  'side_head', 'side_neck', 'side_shoulder', 'side_chest',
  'side_waist', 'side_belly', 'side_hip', 'side_knee', 'side_ankle',
];

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Download release zip archive for GitHub upload
app.get('/api/download-zip', (req, res) => {
  const zipPath = path.resolve(__dirname, 'fittly-v1.2.0.zip');
  res.download(zipPath, 'fittly-v1.2.0.zip', (err) => {
    if (err) {
      console.error('Error sending zip:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download zip file' });
      }
    }
  });
});

// 1. Detect Keypoints & Extract Initial Measurements
app.post('/api/gemini/detect-keypoints', async (req, res) => {
  try {
    const { frontImage, sideImage } = req.body;
    if (!frontImage && !sideImage) {
      return res.status(400).json({ error: 'At least one photo (front or side) is required.' });
    }

    const ai = getGeminiClient();
    const parts: any[] = [];

    if (frontImage) {
      const base64Data = frontImage.includes(',') ? frontImage.split(',')[1] : frontImage;
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      });
    }

    if (sideImage) {
      const base64Data = sideImage.includes(',') ? sideImage.split(',')[1] : sideImage;
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      });
    }

    parts.push({
      text: `Analyze the human body in the provided image(s) (Front and/or Side view). 
1. Detect keypoints for each view. 
2. Calculate highly accurate body measurements in centimeters.

Front keypoints: ${BODY_POINTS_FRONT.join(', ')}
Side keypoints: ${BODY_POINTS_SIDE.join(', ')}

Measurements to calculate: neck, armLength, shoulderWidth, legLength, chest, waist, belly, hips, thigh, inseam, sleeveLength, wrist.

Return ONLY a JSON object:
{
  "keypoints": [{"id": "string", "name": "string", "x": number, "y": number, "pose": "front" | "side"}],
  "measurements": { "neck": 0, "armLength": 0, "shoulderWidth": 0, "legLength": 0, "chest": 0, "waist": 0, "belly": 0, "hips": 0, "thigh": 0, "inseam": 0, "sleeveLength": 0, "wrist": 0 }
}

IMPORTANT: x and y coordinates MUST be percentages from 0 to 100 relative to the image dimensions.`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in detect-keypoints:', error);
    return res.status(500).json({
      error: error.message || 'Failed to detect keypoints',
    });
  }
});

// 2. Recalculate Body Measurements based on updated keypoints
app.post('/api/gemini/recalculate-measurements', async (req, res) => {
  try {
    const { frontImage, sideImage, updatedKeypoints } = req.body;
    if (!updatedKeypoints) {
      return res.status(400).json({ error: 'updatedKeypoints are required.' });
    }

    const ai = getGeminiClient();
    const parts: any[] = [];

    if (frontImage) {
      const base64Data = frontImage.includes(',') ? frontImage.split(',')[1] : frontImage;
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      });
    }

    if (sideImage) {
      const base64Data = sideImage.includes(',') ? sideImage.split(',')[1] : sideImage;
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      });
    }

    parts.push({
      text: `Based on these updated keypoint coordinates (percentages): ${JSON.stringify(updatedKeypoints)}, recalculate the body measurements in centimeters. 
Return ONLY a JSON object with the measurements: { "neck": 0, "armLength": 0, "shoulderWidth": 0, "legLength": 0, "chest": 0, "waist": 0, "belly": 0, "hips": 0, "thigh": 0, "inseam": 0, "sleeveLength": 0, "wrist": 0 }`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in recalculate-measurements:', error);
    return res.status(500).json({
      error: error.message || 'Failed to recalculate measurements',
    });
  }
});

// 3. Calculate Custom Garment Dimensions
app.post('/api/gemini/calculate-garment-dimensions', async (req, res) => {
  try {
    const { measurements, points } = req.body;
    if (!measurements || !points) {
      return res.status(400).json({ error: 'measurements and points are required.' });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Based on these body measurements: ${JSON.stringify(measurements)} and these custom garment points (percentages on image): ${JSON.stringify(points)}, calculate the custom garment dimensions in centimeters.
Return ONLY a JSON object: { "shirtLength": 0, "sleeveLength": 0, "shoulder": 0, "collarSize": 0, "trouserLength": 0, "trouserWaist": 0, "waistMeasure": 0 }`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in calculate-garment-dimensions:', error);
    return res.status(500).json({
      error: error.message || 'Failed to calculate garment dimensions',
    });
  }
});

// 4. Smart Shopping Fit Matching with URL Context Grounding
app.post('/api/gemini/match-size', async (req, res) => {
  try {
    const { measurements, color, url } = req.body;
    if (!measurements || !url) {
      return res.status(400).json({ error: 'measurements and url are required.' });
    }

    const ai = getGeminiClient();
    const prompt = `Based on these measurements (in cm): ${JSON.stringify(measurements)} and the user's preferred color "${color || 'any'}", analyze the apparel size chart from the website URL: ${url}.
Recommend a specific BRAND ARTICLE (cloth item) and optimal size that best suits the user.

Return ONLY a JSON object:
{
  "brand": "string",
  "article": "string",
  "size": "string",
  "confidence": number,
  "reasoning": "string",
  "link": "string",
  "colorMatch": "string"
}`;

    let response;
    try {
      // First attempt with urlContext tool
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ urlContext: {} }],
          responseMimeType: 'application/json',
        },
      });
    } catch (urlToolError) {
      console.warn('URL context tool fallback attempt without tool constraint:', urlToolError);
      // Fallback in case urlContext fails on domain access policy
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt + `\n(If direct web retrieval is unavailable, use standard retail brand sizing specifications matching the brand in the URL).`,
        config: {
          responseMimeType: 'application/json',
        },
      });
    }

    const parsed = JSON.parse(response.text || '{}');
    if (!parsed.link) {
      parsed.link = url;
    }
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in match-size:', error);
    return res.status(500).json({
      error: error.message || 'Failed to match size',
    });
  }
});

// Setup Vite middleware in dev or serve static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FITTLY server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer();
