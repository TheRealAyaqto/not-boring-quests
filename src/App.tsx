/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Trash2, Zap, Sparkles, CheckCircle2, RotateCcw, ArrowRight, Loader2, LogIn, User as UserIcon, Trophy, Settings, Sun, Moon, X, Crown, ShieldAlert, CircleHelp, ExternalLink } from 'lucide-react';
import { suggestIdeas, generateSteps, Idea } from './services/geminiService';
import { loginWithGoogle, syncUserXP, addXP, auth, addTaskToDB, removeTaskFromDB, subscribeToTasks, getLeaderboard, updatePrivacySettings } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface Task {
  id: string;
  text: string;
  rarity?: keyof typeof RARITIES;
}

const RARITIES = {
  Common: { name: 'Common', color: '#9E9E9E', weight: 60, xp: 20 },
  Uncommon: { name: 'Uncommon', color: '#4CAF50', weight: 25, xp: 40 },
  Rare: { name: 'Rare', color: '#2196F3', weight: 10, xp: 75 },
  Epic: { name: 'Epic', color: '#9C27B0', weight: 4, xp: 150 },
  Legendary: { name: 'Legendary', color: '#FF9800', weight: 1, xp: 500 }
};

const getRandomRarity = (): keyof typeof RARITIES => {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const [key, value] of Object.entries(RARITIES)) {
    cumulative += value.weight;
    if (roll <= cumulative) return key as keyof typeof RARITIES;
  }
  return 'Common';
};

const TAGLINES = [
  "Productivity at it's finest",
  "Just press the button!",
  "Trust me this is funner (is that a word?)",
  "Add some tasks!",
  "This is cool right?",
  "Make sure you login to save XP!"
];

const LEVEL_TITLES = [
  "Mundane Novice",
  "Chore Specialist",
  "Errand Expert",
  "Task Tactician",
  "Focus Master",
  "Discipline Dean",
  "Productivity Pro",
  "Routine Wizard",
  "Habit Hero",
  "Boring Legend",
  "Persistence Paragon",
  "Order Overlord",
  "Steadfast Sentinel",
  "Consistency King",
  "Execution Emperor",
  "Discipline Deity",
  "The Unborable",
  "Legend of the List",
  "Archon of Action",
  "Apex Order"
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [chosenIdea, setChosenIdea] = useState<Idea | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<'list' | 'picking' | 'ideas' | 'steps'>('list');
  
  const [user, setUser] = useState<User | null>(null);
  const [xp, setXp] = useState(0);
  const [taglineIndex, setTaglineIndex] = useState(0);

  // New features state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
  const [isHiddenFromLeaderboard, setIsHiddenFromLeaderboard] = useState(false);
  const [accentColor, setAccentColor] = useState(localStorage.getItem('custom_accent_color') || '#BDE0FE');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('user_gemini_api_key') || '');
  const [debugXpAmount, setDebugXpAmount] = useState(1500);

  const level = Math.floor(xp / 100) + 1;
  const currentLevelXp = xp % 100;
  const levelTitle = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

  useEffect(() => {
    const taglineTimer = setInterval(() => {
      setTaglineIndex(prev => (prev + 1) % TAGLINES.length);
    }, 10000);
    return () => clearInterval(taglineTimer);
  }, []);

  useEffect(() => {
    let unsubscribeTasks: () => void;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubscribeTasks) unsubscribeTasks();
      
      setUser(u);
      if (u) {
        const userData = await syncUserXP(u.uid, u.email || '', u.displayName, u.photoURL) as any;
        setXp(userData.xp || 0);
        setIsHiddenFromLeaderboard(userData.hiddenFromLeaderboard || false);
        
        // Check if we should show privacy warning
        const firstTime = !localStorage.getItem(`privacy_warning_seen_${u.uid}`);
        if (firstTime) {
          setShowPrivacyWarning(true);
        }

        unsubscribeTasks = subscribeToTasks(u.uid, (dbTasks) => {
          setTasks(dbTasks);
        });
      } else {
        setTasks([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', accentColor);
    // Generate a slightly darker version for accent
    const darken = (hex: string) => {
      let r = parseInt(hex.slice(1, 3), 16);
      let g = parseInt(hex.slice(3, 5), 16);
      let b = parseInt(hex.slice(5, 7), 16);
      r = Math.floor(r * 0.9);
      g = Math.floor(g * 0.9);
      b = Math.floor(b * 0.9);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };
    document.documentElement.style.setProperty('--accent-color', darken(accentColor));
    localStorage.setItem('custom_accent_color', accentColor);
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem('user_gemini_api_key', geminiApiKey);
  }, [geminiApiKey]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await getLeaderboard();
      setLeaderboardData(data);
      setIsLeaderboardOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePrivacy = async () => {
    if (user) {
      const newVal = !isHiddenFromLeaderboard;
      setIsHiddenFromLeaderboard(newVal);
      await updatePrivacySettings(user.uid, newVal);
    }
  };

  const handleLogin = async () => {
    try {
      const u = await loginWithGoogle();
      const userData = await syncUserXP(u.uid, u.email || '', u.displayName, u.photoURL) as any;
      setXp(userData.xp || 0);
      setIsHiddenFromLeaderboard(userData.hiddenFromLeaderboard || false);
    } catch (err) {
      console.error(err);
    }
  };

  const addTask = async () => {
    if (newTask.trim()) {
      const rarity = getRandomRarity();
      if (user) {
        await addTaskToDB(user.uid, newTask.trim(), rarity);
      } else {
        // Fallback for guest (though user implied login is important)
        setTasks([...tasks, { id: crypto.randomUUID(), text: newTask.trim(), rarity }]);
      }
      setNewTask('');
    }
  };

  const removeTask = async (id: string) => {
    if (user) {
      await removeTaskFromDB(user.uid, id);
    } else {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const startQuest = async () => {
    if (tasks.length === 0) return;
    
    setPhase('picking');
    await new Promise(r => setTimeout(r, 1500));
    
    const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
    setSelectedTask(randomTask);
    
    setIsLoading(true);
    try {
      const suggestedIdeas = await suggestIdeas(randomTask.text, geminiApiKey);
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
      const generatedSteps = await generateSteps(selectedTask!.text, idea, geminiApiKey);
      setSteps(generatedSteps);
      setPhase('steps');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const completeQuest = async () => {
    if (selectedTask) {
      const rewardXp = selectedTask.rarity ? RARITIES[selectedTask.rarity].xp : 20;
      if (user) {
        await addXP(user.uid, rewardXp);
        await removeTaskFromDB(user.uid, selectedTask.id);
        setXp(prev => prev + rewardXp);
      } else {
        setXp(prev => prev + rewardXp);
        setTasks(prev => prev.filter(t => t.id !== selectedTask.id));
      }
      reset();
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
    <div className={`min-h-screen p-4 md:p-8 flex flex-col items-center pb-24 transition-colors duration-300`}>
      {/* Settings Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-brutal-bg border-l-4 border-current z-50 p-8 shadow-[-10px_0px_0px_0px_rgba(0,0,0,0.2)] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-12 sticky top-0 bg-brutal-bg z-10 pb-4">
                <h2 className="font-display text-4xl italic uppercase">Settings</h2>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="hover:rotate-90 transition-transform p-2 bg-zinc-900 border-2 border-current"
                >
                  <X />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Privacy Controls</h3>
                  <div className="flex items-center justify-between bg-zinc-900/50 p-4 brutal-border">
                    <span className="font-mono text-sm">Leaderboard Opt-out</span>
                    <button 
                      onClick={togglePrivacy}
                      className={`w-12 h-6 rounded-full transition-colors relative border-2 border-current ${isHiddenFromLeaderboard ? 'bg-primary' : 'bg-zinc-800'}`}
                    >
                      <motion.div 
                        animate={{ x: isHiddenFromLeaderboard ? 24 : 0 }}
                        className="absolute left-1 top-0.5 w-4 h-4 rounded-full bg-current"
                      />
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-zinc-500">
                    If enabled, your profile and XP will be hidden from the Hall of Fame.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Theme</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-2 justify-center p-3 brutal-border ${theme === 'light' ? 'bg-primary text-black' : 'bg-zinc-900'}`}
                    >
                      <Sun size={16} /> Light
                    </button>
                    <button 
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-2 justify-center p-3 brutal-border ${theme === 'dark' ? 'bg-primary text-black' : 'bg-zinc-900'}`}
                    >
                      <Moon size={16} /> Dark
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Accent Color</h3>
                  <div className="flex items-center gap-4 bg-zinc-900/50 p-4 brutal-border">
                    <input 
                      type="color" 
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-12 h-12 bg-transparent border-none cursor-pointer"
                    />
                    <div className="flex-grow">
                      <span className="font-mono text-sm block uppercase tracking-tight">{accentColor}</span>
                      <button 
                        onClick={() => setAccentColor('#BDE0FE')}
                        className="font-mono text-[10px] text-zinc-500 underline hover:text-primary transition-colors"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Gemini API Key</h3>
                    <button 
                      onClick={() => setIsHelpOpen(true)}
                      className="text-zinc-500 hover:text-primary transition-colors"
                      title="How to get an API key"
                    >
                      <CircleHelp size={14} />
                    </button>
                  </div>
                  <div className="bg-zinc-900/50 p-4 brutal-border">
                    <input 
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="Paste Gemini API key here"
                      className="w-full bg-transparent font-mono text-xs outline-none text-primary placeholder:text-zinc-600"
                    />
                  </div>
                  <p className="font-mono text-[9px] text-zinc-500">
                    Your key is stored locally in your browser. If provided, it bypasses the global rate limits.
                  </p>
                </div>

                {user?.email === 'therealayaqto@gmail.com' && (
                  <div className="space-y-4 pt-4 border-t border-zinc-800">
                    <h3 className="font-mono text-xs text-primary uppercase tracking-widest">Debug Mode</h3>
                    
                    <div className="flex items-center justify-center gap-4 bg-zinc-900 border-2 border-primary p-2">
                      <button 
                        onClick={() => setDebugXpAmount(prev => Math.max(0, prev - 100))}
                        className="p-2 hover:bg-primary hover:text-black transition-colors"
                      >
                        <Minus size={20} />
                      </button>
                      
                      <input 
                        type="number"
                        value={debugXpAmount}
                        onChange={(e) => setDebugXpAmount(parseInt(e.target.value) || 0)}
                        className="bg-transparent border-none text-center font-mono text-xl text-primary w-24 focus:outline-none"
                      />
                      
                      <button 
                        onClick={() => setDebugXpAmount(prev => prev + 100)}
                        className="p-2 hover:bg-primary hover:text-black transition-colors"
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={async () => {
                          await addXP(user.uid, debugXpAmount);
                          setXp(prev => prev + debugXpAmount);
                        }}
                        className="p-3 bg-zinc-900 border-2 border-primary text-primary font-mono text-xs uppercase hover:bg-primary hover:text-black transition-colors"
                      >
                        Add Points
                      </button>
                      <button 
                        onClick={async () => {
                          await addXP(user.uid, -debugXpAmount);
                          setXp(prev => Math.max(0, prev - debugXpAmount));
                        }}
                        className="p-3 bg-zinc-900 border-2 border-primary text-primary font-mono text-xs uppercase hover:bg-primary hover:text-black transition-colors"
                      >
                        Subtract Points
                      </button>
                    </div>
                  </div>
                )}

                {user && (
                   <div className="pt-12">
                     <button 
                       onClick={() => auth.signOut()}
                       className="w-full p-4 border-2 border-red-500 text-red-500 font-mono uppercase hover:bg-red-500 hover:text-white transition-colors"
                     >
                       Sign Out
                     </button>
                   </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Gemini API Help Modal */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-brutal-bg brutal-border p-8 z-[61] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8 border-b-2 border-current pb-4 sticky top-0 bg-brutal-bg z-10">
                <div className="flex items-center gap-3">
                  <CircleHelp size={28} className="text-primary" />
                  <h2 className="font-display text-4xl italic uppercase leading-none">Setup Guide</h2>
                </div>
                <button onClick={() => setIsHelpOpen(false)} className="hover:rotate-90 transition-transform">
                  <X />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="font-display text-2xl text-primary/40 shrink-0">01</div>
                  <p className="font-mono text-xs leading-relaxed">
                    Go to <a href="https://aistudio.google.com/app/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1 inline-flex">https://aistudio.google.com/app/api-keys <ExternalLink size={10} /></a>
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="font-display text-2xl text-primary/40 shrink-0">02</div>
                  <p className="font-mono text-xs leading-relaxed">
                    Click <span className="font-bold text-primary">'Create API Key'</span> and then <span className="font-bold text-primary">'Create Key'</span>
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="font-display text-2xl text-primary/40 shrink-0">03</div>
                  <p className="font-mono text-xs leading-relaxed">
                    Click <span className="font-bold text-primary">'Copy Key'</span> and paste into the text box in the settings menu
                  </p>
                </div>

                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="w-full mt-4 p-4 bg-primary text-black font-display text-xl brutal-border shadow-[4px_4px_0px_0px_currentColor]"
                >
                  GOT IT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {isLeaderboardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLeaderboardOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-brutal-bg brutal-border p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8 sticky top-0 bg-brutal-bg z-10 pb-4 border-b-2 border-current">
                <div className="flex items-center gap-3">
                  <Crown size={32} className="text-primary fill-primary" />
                  <h2 className="font-display text-4xl italic uppercase">Hall of Fame</h2>
                </div>
                <button onClick={() => setIsLeaderboardOpen(false)} className="hover:rotate-90 transition-transform">
                  <X />
                </button>
              </div>

              <div className="space-y-4">
                {leaderboardData.map((player, idx) => (
                  <div 
                    key={player.uid}
                    className={`flex items-center justify-between p-4 brutal-border ${player.uid === user?.uid ? 'bg-primary/20 border-primary' : 'bg-zinc-900/50'}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-display text-2xl italic w-8 text-zinc-500">#{idx + 1}</span>
                      <img src={player.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.uid}`} className="w-10 h-10 rounded-full border-2 border-current shadow-[2px_2px_0px_0px_currentColor]" referrerPolicy="no-referrer" />
                      <div className="flex flex-col">
                        {player.email === 'therealayaqto@gmail.com' && (
                          <span className="font-mono text-[8px] font-bold text-[#FFD700] uppercase tracking-[0.2em] mb-1 drop-shadow-[0_0_8px_rgba(255,215,0,0.6)] flex items-center gap-1">
                            <Sparkles size={10} className="fill-[#FFD700] animate-pulse" />
                            Owner
                          </span>
                        )}
                        <span className="font-mono font-bold leading-none">{player.displayName}</span>
                        <span className="font-mono text-[10px] text-zinc-500 uppercase">
                          LVL {Math.floor(player.xp / 100) + 1}
                        </span>
                      </div>
                    </div>
                    <div className="font-mono font-black text-xl">{player.xp} XP</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Warning */}
      <AnimatePresence>
        {showPrivacyWarning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-md bg-zinc-900 brutal-border border-accent p-8 text-center max-h-[90vh] overflow-y-auto"
            >
              <ShieldAlert size={48} className="mx-auto mb-6 text-accent" />
              <h2 className="font-display text-3xl mb-4 italic uppercase">Identity Shared!</h2>
              <p className="font-mono text-sm text-zinc-400 mb-8 leading-relaxed">
                You are now competing on the global Hall of Fame. Your name and profile will be visible to others. 
                You can opt-out at any time in the settings menu.
              </p>
              <button 
                onClick={() => {
                  setShowPrivacyWarning(false);
                  localStorage.setItem(`privacy_warning_seen_${user?.uid}`, 'true');
                }}
                className="w-full p-4 bg-accent text-black font-display text-xl brutal-border shadow-[4px_4px_0px_0px_black]"
              >
                Let's Do This!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="w-full flex justify-between items-start mb-8 lg:px-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="w-48 h-8 bg-zinc-900 brutal-border relative overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${currentLevelXp}%` }}
                className="absolute inset-0 bg-primary"
              />
              <div className="absolute inset-0 flex items-center justify-center mix-blend-difference">
                 <span className="font-mono font-bold text-[10px] text-white">
                   {currentLevelXp}/100 XP
                 </span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-primary px-3 py-1 brutal-border">
               <Trophy size={14} className="text-black" />
               <span className="font-mono font-bold text-xs text-black">LVL {level}</span>
            </div>
            {user && (
              <button 
                onClick={fetchLeaderboard}
                className="flex items-center gap-2 font-mono text-[10px] uppercase text-zinc-400 hover:text-primary transition-colors bg-zinc-900/50 px-3 py-1.5 rounded-full"
              >
                <Crown size={12} className="text-primary" />
                Hall of Fame
              </button>
            )}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 italic">
             "Level {level}: {levelTitle}"
          </p>
        </div>
        
        {user ? (
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-3 font-mono text-xs text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-full">
              <img src={user.photoURL || ''} className="w-5 h-5 rounded-full border border-zinc-700" referrerPolicy="no-referrer" />
              <span className="hidden sm:inline">{user.email}</span>
            </div>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="flex items-center gap-2 font-mono text-xs uppercase text-zinc-400 hover:text-primary transition-colors"
          >
            <LogIn size={14} />
            Login to Sync XP & Tasks
          </button>
        )}
      </div>

      <header className="mb-12 text-center w-full max-w-2xl">
        <h1 className="font-display text-5xl md:text-7xl mb-2 tracking-tighter text-primary">
          (not)BoringQuests
        </h1>
        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={taglineIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-zinc-400 font-mono text-sm uppercase tracking-widest italic"
            >
              {TAGLINES[taglineIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
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
                    <div className="flex flex-col">
                      {task.rarity && (
                        <span 
                          className="font-mono text-[9px] uppercase tracking-widest font-bold mb-1"
                          style={{ color: RARITIES[task.rarity].color }}
                        >
                          {RARITIES[task.rarity].name}
                        </span>
                      )}
                      <span className="font-mono text-lg">{task.text}</span>
                    </div>
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
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={startQuest}
                    className="w-24 h-24 rounded-full bg-primary text-black flex items-center justify-center brutal-border hover:bg-accent transition-colors shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]"
                  >
                    <Zap size={40} fill="currentColor" />
                  </motion.button>
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
              <h2 className="font-display text-4xl mb-4 italic text-accent">CHOOSING TASK...</h2>
              <p className="font-mono text-zinc-500">Consulting Gemini (might take a while)</p>
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
              <div className="bg-zinc-900 border-l-4 p-6 mb-8" style={{ borderLeftColor: selectedTask?.rarity ? RARITIES[selectedTask.rarity].color : '#FFF' }}>
                <div className="flex justify-between items-start">
                  <h2 className="text-zinc-500 font-mono text-xs uppercase mb-1">Current Objective</h2>
                  {selectedTask?.rarity && (
                    <span 
                      className="font-mono text-[10px] uppercase font-bold"
                      style={{ color: RARITIES[selectedTask.rarity].color }}
                    >
                      {RARITIES[selectedTask.rarity].name}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-display uppercase italic">{selectedTask?.text}</p>
              </div>

              <h3 className="font-display text-3xl text-center mb-6">Choose Your Method</h3>

              {ideas.some(i => i.isFallback) && (
                <div className="bg-amber-900/20 border border-amber-900 text-amber-500 font-mono text-[10px] p-2 mb-6 text-center uppercase tracking-widest animate-pulse">
                  ⚠️ Gemini Quota Reached: Entering Safe Mode Quests
                </div>
              )}

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
              <div 
                className="text-black p-8 brutal-border"
                style={{ backgroundColor: selectedTask?.rarity ? RARITIES[selectedTask.rarity].color : '#FFF' }}
              >
                <h2 className="font-display text-4xl mb-2 italic">QUEST ACTIVATED</h2>
                <div className="font-mono bg-black/10 p-2 inline-block text-sm uppercase">
                  {selectedTask?.rarity && `[${RARITIES[selectedTask.rarity].name}] `}
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
                  onClick={completeQuest}
                >
                  <CheckCircle2 size={24} />
                  QUEST COMPLETE (+{selectedTask?.rarity ? RARITIES[selectedTask.rarity].xp : 20} XP)
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
          POWERED BY GEMINI AI ♥︎ • DATABASE HELD BY FIREBASE ♥︎
        </p>
      </footer>

      <div className="fixed bottom-6 right-6 z-40">
        <motion.button 
          whileHover={{ rotate: 90 }}
          onClick={() => setIsSettingsOpen(true)}
          className="p-4 bg-brutal-bg brutal-border hover:bg-primary transition-colors shadow-lg"
        >
          <Settings size={24} />
        </motion.button>
      </div>
    </div>
  );
}

