export interface Idea {
  title: string;
  description: string;
  vibe: string;
  isFallback?: boolean;
}

export async function suggestIdeas(task: string, apiKey?: string): Promise<Idea[]> {
  const response = await fetch('/api/suggest-ideas', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {})
    },
    body: JSON.stringify({ task }),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch ideas');
  }
  return response.json();
}

export async function generateSteps(task: string, idea: Idea, apiKey?: string): Promise<string[]> {
  const response = await fetch('/api/generate-steps', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {})
    },
    body: JSON.stringify({ task, idea }),
  });
  if (!response.ok) {
    throw new Error('Failed to generate steps');
  }
  return response.json();
}
