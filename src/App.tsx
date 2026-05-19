/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Zap, Sparkles, CheckCircle2, RotateCcw, ArrowRight, Loader2 } from 'lucide-react';
import { suggestIdeas, generateSteps, Idea } from './services/geminiService';

interface Task {
  id: string;
  text: string;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [chosenIdea, setChosenIdea] = useState<Idea | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<'list' | 'picking' | 'ideas' | 'steps'>('list');

  const addTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, { id: crypto.randomUUID(), text: newTask.trim() }]);
      setNewTask('');
    }
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const startQuest = async () => {
    if (tasks.length === 0) return;
    
    setPhase('picking');
    // Simulate some "random picking" animation time
    await new Promise(r => setTimeout(r, 1500));
    
    const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
    setSelectedTask(randomTask);
    
    setIsLoading(true);
    try {
      const suggestedIdeas = await suggestIdeas(randomTask.text);
      setIdeas(suggestedIdeas);
      setPhase('ideas');
    } catch (err) {
      console.error(err);
      setPhase('list');
    } finally {
      setIsLoading(false);
    }
  };

  const pickIdea = async (idea: Idea) => {
    setChosenIdea(idea);
    setIsLoading(true);
    try {
      const generatedSteps = await generateSteps(selectedTask!.text, idea);
      setSteps(generatedSteps);
      setPhase('steps');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setSelectedTask(null);
    setIdeas([]);
    setChosenIdea(null);
    setSteps([]);
    setPhase('list');
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="mb-12 text-center w-full max-w-2xl">
        <h1 className="font-display text-5xl md:text-7xl mb-2 tracking-tighter text-primary">
          QUEST LOG
        </h1>
        <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">
          Turn Boring tasks into Epic Adventures
        </p>
      </header>

      <main className="w-full max-w-2xl flex-grow">
        <AnimatePresence mode="wait">
          {phase === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  placeholder="Enter a boring task..."
                  className="flex-grow bg-zinc-900 border-2 border-zinc-700 font-mono text-lg p-3 outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={addTask}
                  className="bg-primary text-black p-4 brutal-border hover:bg-accent transition-colors"
                >
                  <Plus size={24} strokeWidth={3} />
                </button>
              </div>

              <div className="space-y-3">
                {tasks.map((task) => (
                  <motion.div
                    layout
                    key={task.id}
                    className="flex items-center justify-between bg-zinc-900/50 p-4 brutal-border group"
                  >
                    <span className="font-mono text-lg">{task.text}</span>
                    <button
                      onClick={() => removeTask(task.id)}
                      className="text-zinc-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={20} />
                    </button>
                  </motion.div>
                ))}
                {tasks.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-zinc-800 text-zinc-600 rounded-lg">
                    No boring tasks yet. Add some to begin.
                  </div>
                )}
              </div>

              {tasks.length > 0 && (
                <div className="flex justify-center pt-8">
                  <button onClick={startQuest} className="primary-button flex items-center gap-3">
                    <Zap size={24} fill="currentColor" />
                    RANDOM TASK QUEST
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {phase === 'picking' && (
            <motion.div
              key="picking"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="relative mb-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-32 h-32 border-4 border-dashed border-primary rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles size={48} className="text-accent animate-pulse" />
                </div>
              </div>
              <h2 className="font-display text-4xl mb-4 italic text-accent">SELECTING TARGET...</h2>
              <p className="font-mono text-zinc-500">Consulting the Grand Archive of Quests</p>
            </motion.div>
          )}

          {phase === 'ideas' && (
            <motion.div
              key="ideas"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8"
            >
              <div className="bg-zinc-900 border-l-4 border-accent p-6 mb-8">
                <h2 className="text-zinc-500 font-mono text-xs uppercase mb-1">Current Objective</h2>
                <p className="text-2xl font-display uppercase italic">{selectedTask?.text}</p>
              </div>

              <h3 className="font-display text-3xl text-center mb-6">Choose Your Methodology</h3>

              <div className="grid gap-6">
                {ideas.map((idea, idx) => (
                  <button
                    key={idx}
                    onClick={() => pickIdea(idea)}
                    disabled={isLoading}
                    className="text-left bg-zinc-900 p-6 brutal-border border-zinc-700 hover:border-primary transition-all group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-2">
                       <span className="font-mono text-xs text-accent uppercase tracking-tighter">[{idea.vibe}]</span>
                       {isLoading && chosenIdea?.title === idea.title && (
                         <Loader2 className="animate-spin text-primary" size={20} />
                       )}
                    </div>
                    <h4 className="font-display text-2xl mb-2 group-hover:text-primary transition-colors">
                      {idea.title}
                    </h4>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      {idea.description}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'steps' && (
            <motion.div
              key="steps"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="bg-primary text-black p-8 brutal-border">
                <h2 className="font-display text-4xl mb-2 italic">QUEST ACTIVATED</h2>
                <div className="font-mono bg-black/10 p-2 inline-block text-sm uppercase">
                  {selectedTask?.text} x {chosenIdea?.title}
                </div>
              </div>

              <div className="space-y-4">
                {steps.map((step, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={idx}
                    className="flex gap-4 items-start bg-zinc-900 p-6 border-l-4 border-accent"
                  >
                    <div className="font-display text-3xl text-accent/50 leading-none">0{idx + 1}</div>
                    <p className="text-lg font-medium">{step}</p>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col gap-4 pt-10">
                <button
                  className="bg-accent text-black font-display text-xl p-4 flex items-center justify-center gap-2 brutal-border"
                  onClick={reset}
                >
                  <CheckCircle2 size={24} />
                  QUEST COMPLETE
                </button>
                <button
                  className="text-zinc-500 font-mono text-sm uppercase hover:text-white flex items-center justify-center gap-2"
                  onClick={reset}
                >
                  <RotateCcw size={16} />
                  Find another Quest
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-20 py-8 border-t border-zinc-900 w-full max-w-2xl text-center">
        <p className="font-mono text-[10px] text-zinc-700 tracking-widest uppercase">
          Powered by Gemini AI • Forge Your Own Path
        </p>
      </footer>
    </div>
  );
}

