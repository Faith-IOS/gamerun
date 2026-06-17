/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { GameCanvas, GameCanvasHandle } from './components/GameCanvas';
import { TeachableModelLoader } from './components/TeachableModelLoader';
import { Volume2, VolumeX, Terminal, Github, Heart, Gamepad2, Info, ArrowUp, ArrowDown } from 'lucide-react';

interface GameLog {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

export default function App() {
  const gameRef = useRef<GameCanvasHandle | null>(null);
  
  // App variables
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');

  // Push new event logs to ticker feed
  const pushLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const newLog: GameLog = {
      id: Math.random().toString(),
      message,
      type,
      timestamp: timeStr,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 15)); // keep last 15 ticks
  };

  // Run initial loading log
  useEffect(() => {
    pushLog('🎮 Welcome to Teachable 8-Bit Runner platform!', 'success');
    pushLog('⌨️ Quick jump-start: Click on page and press SPACE to run.', 'info');
  }, []);

  // Map gestures triggers from child loader to canvas
  const handleJumpFromGesture = () => {
    if (gameRef.current) {
      gameRef.current.triggerJump();
    }
  };

  const handleCrouchFromGesture = (isHold: boolean) => {
    if (gameRef.current) {
      gameRef.current.triggerCrouch(isHold);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFD93D] text-black font-sans pb-12 p-4 md:p-6 selection:bg-[#FF6B6B] selection:text-white">
      {/* Primary Header Rail (Neo-Brutalist White Card) */}
      <header className="max-w-7xl mx-auto mb-6 bg-white rounded-3xl p-6 shadow-[8px_8px_0px_0px_#222] border-4 border-black flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#FF6B6B] border-4 border-black rounded-lg flex items-center justify-center shadow-[2px_2px_0px_0px_#222]">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-black">
                Teachable 8-Bit Runner
              </span>
              <span className="bg-[#4D96FF] text-white border-2 border-black font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wider">
                v1.2.0
              </span>
            </div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">
              Google Offline Platforms style gesture-controlled web-game
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Audio Mute toggle button */}
          <button
            onClick={() => {
              const updated = !isMuted;
              setIsMuted(updated);
              pushLog(updated ? 'Muted retro synthesizer' : 'Unmuted retro synthesizer', 'info');
            }}
            title={isMuted ? 'Unmute Audio Sfx' : 'Mute Audio Sfx'}
            className={`px-4 py-2 rounded-xl border-4 border-black font-black uppercase text-xs flex items-center gap-2 transition-all shadow-[4px_4px_0px_0px_#222] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
              isMuted
                ? 'bg-[#FF6B6B] text-white'
                : 'bg-white text-black hover:bg-slate-50'
            }`}
          >
            {isMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
            <span>{isMuted ? 'Sound Off' : 'Sound On'}</span>
          </button>
        </div>
      </header>

      {/* Main dashboard content body */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left column: Quick guide list & Active live arcade box (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          
          {/* Game Canvas Box - Framed in solid bright Green neo-brutalist panel */}
          <section className="bg-[#6BCB77] border-4 border-black rounded-[40px] shadow-[8px_8px_0px_0px_#222] p-6 flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-black">
              <span>🦿 Arcade Level Console</span>
              {gameState === 'playing' && (
                <span className="bg-white border-2 border-black text-[#FF6B6B] px-2 py-0.5 rounded font-black font-mono flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#FF6B6B] animate-pulse" /> LIVE STREAM
                </span>
              )}
            </div>

            <GameCanvas
              ref={gameRef}
              isMuted={isMuted}
              onScoreUpdate={(score) => {
                if (score > 0 && score % 100 === 0) {
                  pushLog(`🌟 Milestone achieved! Reached ${score} points!`, 'success');
                }
              }}
              onCoinCollected={(coins) => {
                pushLog(`🪙 Star token collected! [Total: ${coins}]`, 'success');
              }}
              onStateChange={(state) => {
                setGameState(state);
                if (state === 'playing') {
                  pushLog('🏃 Game session started! Dodge the neon barriers and pterodactyl pteroflyers!', 'info');
                } else if (state === 'gameover') {
                  pushLog('💥 Crashed into an obstacle! Best score saved to memory.', 'error');
                }
              }}
            />
          </section>

          {/* Guide Steps to Train Custom Google Teachable Machine Models */}
          <section className="bg-white border-4 border-black rounded-[40px] shadow-[8px_8px_0px_0px_#222] p-6 flex flex-col gap-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
              <Info className="w-4.5 h-4.5 text-[#4D96FF]" />
              How to Publish & Link Your Own Motion Gesture Model
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#222]">
                <div className="flex items-center gap-2 text-xs font-black text-black mb-1.5 uppercase font-mono">
                  <span className="w-5 h-5 rounded-full bg-[#FF6B6B] text-white flex items-center justify-center text-[10px] border border-black font-bold">1</span>
                  Train in Teachable
                </div>
                <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                  Go to <a href="https://teachablemachine.withgoogle.com" target="_blank" rel="noreferrer" className="text-[#2D31FA] font-bold underline hover:text-[#4D96FF]">Teachable Machine</a>. Select <strong>Pose Project</strong> or <strong>Image Project</strong>. Map gestures for:
                </p>
                <ul className="text-[10px] text-slate-600 list-disc pl-4 mt-1.5 space-y-0.5 font-bold uppercase tracking-tight">
                  <li>Normal Running / Neutral</li>
                  <li>Hands Up (Jump gesture)</li>
                  <li>Ducking (Crouch gesture)</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#222]">
                <div className="flex items-center gap-2 text-xs font-black text-black mb-1.5 uppercase font-mono">
                  <span className="w-5 h-5 rounded-full bg-[#4D96FF] text-white flex items-center justify-center text-[10px] border border-black font-bold">2</span>
                  Generate Shared URL
                </div>
                <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                  Click on <strong>Export Model</strong>. Under the update tab, select <strong>Upload (shareable link)</strong>. Copy the published cloud URL once generated.
                </p>
                <div className="bg-[#222] border-2 border-black p-1.5 text-[9px] font-mono text-white rounded-lg mt-2 select-all overflow-x-auto whitespace-nowrap">
                  https://teachablemachine.withgoogle.co...
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#222]">
                <div className="flex items-center gap-2 text-xs font-black text-black mb-1.5 uppercase font-mono">
                  <span className="w-5 h-5 rounded-full bg-[#6BCB77] text-white flex items-center justify-center text-[10px] border border-black font-bold">3</span>
                  Active Map Keys
                </div>
                <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                  Paste that URL inside this dashboard's core input area. Map your TM labels to corresponding movement trigger actions, and activate the camera!
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right column: Teachable camera links + diagnostic logs box (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          
          {/* Teachable Machine Controller Card */}
          <TeachableModelLoader
            onJumpTrigger={handleJumpFromGesture}
            onCrouchTrigger={handleCrouchFromGesture}
            onLog={pushLog}
          />

          {/* Live Action Ticker / Terminal logs */}
          <section className="bg-white border-4 border-black rounded-[40px] shadow-[8px_8px_0px_0px_#222] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-black text-black uppercase tracking-widest border-b-2 border-black pb-2">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-[#4D96FF]" /> Live Ticker Log
              </span>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] font-bold text-[#FF6B6B] hover:text-[#ef4444] uppercase font-mono hover:underline"
              >
                Clear output
              </button>
            </div>

            <div className="h-[200px] bg-slate-900 border-2 border-black rounded-2xl p-3 overflow-y-auto font-mono text-xs flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-slate-800 pr-1 select-all">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic h-full flex items-center justify-center text-center">
                  Terminal is quiet, awaiting gestures...
                </div>
              ) : (
                logs.map((log) => {
                  let badgeColor = 'text-slate-400';
                  if (log.type === 'success') badgeColor = 'text-[#6BCB77] font-bold';
                  else if (log.type === 'warning') badgeColor = 'text-[#FFD93D] font-bold';
                  else if (log.type === 'error') badgeColor = 'text-[#FF6B6B] font-bold';
                  else if (log.type === 'info') badgeColor = 'text-[#4D96FF] font-bold';

                  return (
                    <div key={log.id} className="leading-5 border-l-2 border-slate-700 pl-2 py-0.5 flex gap-2">
                      <span className="text-slate-500 text-[10px] tracking-tight">{log.timestamp}</span>
                      <span className={`${badgeColor} flex-shrink-0`}>[{log.type.toUpperCase()}]</span>
                      <span className="text-slate-300 break-words flex-grow">{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

        </div>
      </main>

      {/* Humble craft footnote footer */}
      <footer className="max-w-7xl mx-auto px-6 mt-12 pt-6 border-t-4 border-black text-center flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-800 uppercase">
        <p className="flex items-center gap-1">
          Designed with nostalgic 8-bit precision by Google AI Studio
        </p>
        <p className="font-mono text-[10px]">
          UTC: 2026-06-16 22:54:33
        </p>
      </footer>
    </div>
  );
}

