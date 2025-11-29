import React, { useState, useEffect, useRef } from 'react';
import { useGeminiLive } from './hooks/use-gemini-live';
import { UniverseConfig, UniverseType } from './types';

const UNIVERSES: UniverseConfig[] = [
  {
    id: 'fantasy',
    title: 'Realms of Aethelgard',
    description: 'A high-fantasy world of ancient dragons, forgotten ruins, and wild magic. You are an adventurer seeking glory.',
    icon: '🐉',
    color: 'bg-amber-900',
    initialPrompt: `You are the Game Master for a Dungeons & Dragons style fantasy adventure set in the Realms of Aethelgard. 
    The tone is epic and mysterious. Describe scenes vividly but concisely (2-4 sentences). 
    Always pause to ask "What do you do?" after setting a scene. 
    Keep track of the player's inventory and health implicitly in your narration.
    Start by welcoming the traveler to the Sleeping Giant Inn.`,
    voiceName: 'Zephyr'
  },
  {
    id: 'scifi',
    title: 'Station X-9',
    description: 'A survival horror scenario on a derelict space station orbiting a black hole. Something is hunting you.',
    icon: '🚀',
    color: 'bg-slate-900',
    initialPrompt: `You are the Game Master for a Sci-Fi survival horror adventure on Station X-9.
    The tone is tense, claustrophobic, and suspenseful.
    Describe the cold, metallic environment and the flickering lights.
    Always pause to ask "What do you do?" after setting a scene.
    Start by describing the player waking up from cryosleep to a red alert siren.`,
    voiceName: 'Fenrir'
  },
  {
    id: 'noir',
    title: 'Neon Shadows',
    description: 'A cyberpunk noir detective story in a rain-slicked metropolis. Solving the murder of a synthetic pop star.',
    icon: '🕵️‍♂️',
    color: 'bg-indigo-950',
    initialPrompt: `You are the Game Master for a Cyberpunk Noir detective story.
    The tone is gritty, cynical, and atmospheric.
    Describe the neon lights reflecting on wet pavement.
    Always pause to ask "What do you do?" after setting a scene.
    Start by describing the player standing over a crime scene in a dark alleyway.`,
    voiceName: 'Puck'
  }
];

const App = () => {
  const [activeUniverse, setActiveUniverse] = useState<UniverseConfig | null>(null);
  const { connect, disconnect, messages, isConnected, volume, error } = useGeminiLive();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleStartGame = async (universe: UniverseConfig) => {
    setActiveUniverse(universe);
    await connect({
      systemInstruction: universe.initialPrompt,
      voiceName: universe.voiceName
    });
  };

  const handleEndGame = () => {
    disconnect();
    setActiveUniverse(null);
  };

  const handleRestart = async () => {
    if (activeUniverse) {
        // Disconnect and reconnect to reset state
        disconnect();
        // Small delay to ensure cleanup
        setTimeout(() => {
            handleStartGame(activeUniverse);
        }, 500);
    }
  };

  // --- Render: Universe Selection ---
  if (!activeUniverse) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6 flex flex-col items-center justify-center bg-grid-pattern">
        <header className="mb-12 text-center">
          <h1 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-amber-400 pb-2">
            Dungeon Master Live
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto text-lg">
            Choose your adventure and speak to your Game Master.
            Powered by Gemini 2.5 Live API.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full">
          {UNIVERSES.map((universe) => (
            <button
              key={universe.id}
              onClick={() => handleStartGame(universe)}
              className={`relative group overflow-hidden rounded-2xl border border-gray-800 hover:border-gray-600 transition-all duration-300 text-left p-6 ${universe.color} bg-opacity-40 hover:bg-opacity-60`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-9xl transform translate-x-4 -translate-y-4">
                {universe.icon}
              </div>
              <div className="relative z-10">
                <span className="text-4xl mb-4 block">{universe.icon}</span>
                <h3 className="text-2xl font-bold font-serif mb-2 text-white group-hover:text-amber-300 transition-colors">
                  {universe.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {universe.description}
                </p>
                <div className="mt-6 flex items-center text-sm font-semibold text-gray-400 group-hover:text-white">
                  <span>Start Adventure</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- Render: Active Game ---
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{activeUniverse.icon}</span>
          <div>
            <h2 className="font-bold font-serif text-lg leading-none">{activeUniverse.title}</h2>
            <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-400 uppercase tracking-wider">
                    {isConnected ? 'Live Session' : 'Disconnected'}
                </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleRestart}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
            >
                Restart Story
            </button>
            <button 
                onClick={handleEndGame}
                className="px-4 py-2 text-sm bg-red-900/30 text-red-300 hover:bg-red-900/50 rounded-lg transition-colors border border-red-900/50"
            >
                Exit Game
            </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide space-y-6 max-w-4xl mx-auto w-full pb-32">
        {messages.length === 0 && isConnected && (
            <div className="text-center text-gray-500 italic mt-20 animate-pulse">
                Summoning the Game Master...
            </div>
        )}
        {messages.map((msg, index) => (
          <div
            key={msg.id + index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-6 py-4 shadow-lg ${
                msg.role === 'user'
                  ? 'bg-indigo-600/80 text-white rounded-tr-none'
                  : 'bg-gray-800/80 text-gray-200 rounded-tl-none border border-gray-700'
              } ${msg.isPartial ? 'opacity-80' : 'opacity-100'} transition-all`}
            >
              {msg.role === 'model' && (
                <div className="text-xs font-bold text-amber-500 mb-1 uppercase tracking-widest font-serif">
                  Game Master
                </div>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">
                {msg.text}
                {msg.isPartial && <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse align-middle"></span>}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      {/* Bottom Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent pt-12 pb-6 px-4">
        <div className="max-w-2xl mx-auto flex flex-col items-center">
            
            {/* Visualizer Circle */}
            <div className="relative mb-6">
                {/* Glow effect based on volume */}
                <div 
                    className="absolute inset-0 rounded-full bg-indigo-500 blur-2xl opacity-40 transition-all duration-75"
                    style={{ transform: `scale(${1 + volume * 1.5})` }}
                ></div>
                
                <div 
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        isConnected ? 'border-indigo-400 bg-gray-900' : 'border-gray-700 bg-gray-900'
                    }`}
                >
                    {isConnected ? (
                        <div className="flex gap-1 items-center h-full">
                            {/* Simple Bar Visualizer inside button */}
                            {[1, 2, 3, 4, 5].map(i => (
                                <div 
                                    key={i} 
                                    className="w-1 bg-indigo-400 rounded-full transition-all duration-75"
                                    style={{ 
                                        height: `${Math.max(4, Math.random() * (volume * 40 + 10))}px`,
                                        opacity: 0.8
                                    }}
                                ></div>
                            ))}
                        </div>
                    ) : (
                        <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                </div>
            </div>

            <div className="text-center">
                {error ? (
                    <div className="text-red-400 text-sm mb-2">{error}</div>
                ) : (
                    <p className="text-gray-400 text-sm font-medium animate-pulse">
                        {isConnected ? "Listening... Speak to play" : "Connecting..."}
                    </p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
