import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // API Routes
  app.post('/api/suggest-ideas', async (req, res) => {
    const { task } = req.body;
    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I have this task: "${task}". 
        Give me 3 different ways to complete it. 
        One should be the most efficient "Best" way. 
        The other two should be creative, fun, or "least boring" ways to do it. 
        Make them sound exciting and adventurous.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Short catchy title for the idea' },
                description: { type: Type.STRING, description: 'Detailed description of the approach' },
                vibe: { type: Type.STRING, description: 'A one-word mood for this approach (e.g. Zen, Epic, Speedrun)' },
              },
              required: ['title', 'description', 'vibe'],
            },
          },
        },
      });

      const ideas = JSON.parse(response.text || '[]');
      res.json(ideas);
    } catch (error: any) {
      console.error('Gemini error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/generate-steps', async (req, res) => {
    const { task, idea } = req.body;
    if (!task || !idea) {
      return res.status(400).json({ error: 'Task and Idea are required' });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Task: "${task}"
        Chosen Approach: "${idea.title} - ${idea.description}"
        Generate 3-5 simple, easy-to-follow steps to complete this task using this specific approach. 
        Keep the steps brief but encouraging.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      });

      const steps = JSON.parse(response.text || '[]');
      res.json(steps);
    } catch (error: any) {
      console.error('Gemini error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
