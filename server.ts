import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url || `file://${path.resolve('server.ts')}`);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to get Gemini client
  const getAiClient = (userKey?: string) => {
    return new GoogleGenAI({
      apiKey: userKey || process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  const defaultAi = getAiClient();

  // Simple in-memory cache
  const ideaCache = new Map<string, any>();
  const stepsCache = new Map<string, any>();

  // API Routes
  app.post('/api/suggest-ideas', async (req, res) => {
    const { task } = req.body;
    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    const cacheKey = task.toLowerCase().trim();
    if (ideaCache.has(cacheKey)) {
      console.log('Serving ideas from cache for:', cacheKey);
      return res.json(ideaCache.get(cacheKey));
    }

    const userKey = req.get('X-Gemini-API-Key');
    const ai = getAiClient(userKey);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I have this task: "${task}". 
        Give me 3 different ways to complete it. 
        One should be the most efficient "Best" way. 
        The other two should be creative, fun, or "least boring" ways to do it. 
        CRITICAL: All methods must be simple, easy to understand, and practical. 
        Make them sound exciting and adventurous but keep them grounded in reality.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Short catchy title for the idea' },
                description: { type: Type.STRING, description: 'Detailed, simple, and easy to understand description of the approach' },
                vibe: { type: Type.STRING, description: 'A one-word mood for this approach (e.g. Zen, Epic, Speedrun)' },
              },
              required: ['title', 'description', 'vibe'],
            },
          },
        },
      });

      const ideas = JSON.parse(response.text || '[]');
      if (ideas.length > 0) {
        ideaCache.set(cacheKey, ideas);
      }
      res.json(ideas);
    } catch (error: any) {
      if (error.message?.includes('429')) {
        console.warn('Gemini Quota Exceeded (429). Using fallbacks.');
      } else {
        console.error('Gemini error:', error);
      }
      
      // Fallback ideas if API fails (Quota limit or otherwise)
      const fallbackIdeas = [
        {
          title: "The Speedrun",
          description: `Complete "${task}" as fast as humanly possible. Set a 5-minute timer and race against it!`,
          vibe: "Blitz",
          isFallback: true
        },
        {
          title: "The Deep Focus",
          description: `Put on some lo-fi beats and treat "${task}" with extreme precision and craftsmanship.`,
          vibe: "Zen",
          isFallback: true
        },
        {
          title: "The Hero's Method",
          description: `Narrate your actions as if you are the protagonist in an epic RPG completing a critical quest.`,
          vibe: "Epic",
          isFallback: true
        }
      ];
      res.json(fallbackIdeas);
    }
  });

  app.post('/api/generate-steps', async (req, res) => {
    const { task, idea } = req.body;
    if (!task || !idea) {
      return res.status(400).json({ error: 'Task and Idea are required' });
    }

    const cacheKey = `${task}-${idea.title}`.toLowerCase().trim();
    if (stepsCache.has(cacheKey)) {
      console.log('Serving steps from cache for:', cacheKey);
      return res.json(stepsCache.get(cacheKey));
    }

    const userKey = req.get('X-Gemini-API-Key');
    const ai = getAiClient(userKey);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Task: "${task}"
        Chosen Approach: "${idea.title} - ${idea.description}"
        Generate 3-5 VERY simple, easy-to-follow steps to complete this task using this specific approach. 
        CRITICAL: Keep the steps extremely clear, jargon-free, and easy for anyone to understand.
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
      if (steps.length > 0) {
        stepsCache.set(cacheKey, steps);
      }
      res.json(steps);
    } catch (error: any) {
      if (error.message?.includes('429')) {
        console.warn('Gemini Quota Exceeded (429). Using fallbacks.');
      } else {
        console.error('Gemini error:', error);
      }
      
      // Fallback steps
      const fallbackSteps = [
        "Gather your necessary equipment and tools.",
        "Clear your immediate area of distractions.",
        `Begin the task: "${task}".`,
        "Process each component carefully and efficiently.",
        "Finalize and appreciate your hard work!"
      ];
      res.json(fallbackSteps);
    }
  });

  app.post('/api/determine-rarity', async (req, res) => {
    const { task } = req.body;
    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    const userKey = req.get('X-Gemini-API-Key');
    const ai = getAiClient(userKey);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Task: "${task}"
        Determine the "rarity" of this task. A boring, fast, or common household task is "Common". 
        A slightly annoying or lengthy task is "Uncommon". 
        A major project or chore that takes hours is "Rare". 
        Something very difficult, life-changing, or taking weeks is "Epic". 
        Something nearly impossible, legendary, or massively impactful is "Legendary".
        Return only the rarity level name.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rarity: { 
                type: Type.STRING, 
                enum: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'],
                description: 'The rarity level of the task' 
              }
            },
            required: ['rarity'],
          },
        },
      });

      const data = JSON.parse(response.text || '{"rarity": "Common"}');
      res.json({ rarity: data.rarity });
    } catch (error: any) {
      console.error('Gemini error:', error);
      res.json({ rarity: 'Common' }); // Fallback
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
