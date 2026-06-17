/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { audio } from '../utils/AudioEngine';

interface GameCanvasProps {
  onScoreUpdate: (score: number) => void;
  onCoinCollected: (coins: number) => void;
  onStateChange: (state: 'idle' | 'playing' | 'gameover') => void;
  isMuted: boolean;
}

export interface GameCanvasHandle {
  triggerJump: () => void;
  triggerCrouch: (isHold: boolean) => void;
  restartGame: () => void;
}

// Retro pixel matrices (12x12 or 16x16 grid represented as strings of letters for fast rendering)
// "." = transparent, "G" = green body, "D" = dark green, "E" = eye white, "K" = pupil black, "O" = orange accent
const DINO_RUN1 = [
  "....GGGGGGG.....",
  "...GGGGGGGGGG...",
  "..GGGGGGGGGGGG..",
  "..GGEKGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGG.....",
  "..GGGGGGGGGGGG..",
  "...GGGGGGGGGG...",
  "....GGGGGGGG....",
  ".....GGGGGG.....",
  "......GGGG......",
  ".....GG.GG......",
  ".....G...G......",
  ".....G...G......",
  "....GG...G......",
  "................"
];

const DINO_RUN2 = [
  "....GGGGGGG.....",
  "...GGGGGGGGGG...",
  "..GGGGGGGGGGGG..",
  "..GGEKGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGG.....",
  "..GGGGGGGGGGGG..",
  "...GGGGGGGGGG...",
  "....GGGGGGGG....",
  ".....GGGGGG.....",
  "......GGGG......",
  ".....GG.GG......",
  "......G..GG.....",
  "......G..GG.....",
  "......GG.G......",
  "................"
];

const DINO_JUMP = [
  "....GGGGGGG.....",
  "...GGGGGGGGGG...",
  "..GGGGGGGGGGGG..",
  "..GGEKGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGG.....",
  "..GGGGGGGGGGGG..",
  "...GGGGGGGGGG...",
  "....GGGGGGGG....",
  ".....GGGGGG.....",
  "......GGGG......",
  ".....GG..GG.....",
  "....G......G....",
  "....G......G....",
  "................",
  "................"
];

const DINO_CROUCH1 = [
  "................",
  "................",
  "......GGGGGGGGGG",
  "....GGGGGEKGGGGG",
  "....GGGGGGGGGGGG",
  "....GGGGGGGGGG..",
  "GGGGGGGGGGGG....",
  "GGGGGGGGGGGG....",
  ".GGGGGGGGGG.....",
  "..GGGGGGGG......",
  "....GG.GG.......",
  "....G...G.......",
  "....GG.GG.......",
  "................",
  "................",
  "................"
];

const DINO_CROUCH2 = [
  "................",
  "................",
  "......GGGGGGGGGG",
  "....GGGGGEKGGGGG",
  "....GGGGGGGGGGGG",
  "....GGGGGGGGGG..",
  "GGGGGGGGGGGG....",
  "GGGGGGGGGGGG....",
  ".GGGGGGGGGG.....",
  "..GGGGGGGG......",
  "....GG...GG.....",
  ".....G..G.......",
  "....GG.GG.......",
  "................",
  "................",
  "................"
];

const DINO_DEAD = [
  "....GGGGGGG.....",
  "...GGGGGGGGGG...",
  "..GGGGGGGGGGGG..",
  "..GGXKGGGGGGGG..", // X for dead eye
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGG.....",
  "..GGGGGGGGGGGG..",
  "...GGGGGGGGGG...",
  "....GGGGGGGG....",
  ".....GGGGGG.....",
  "......GGGG......",
  ".....GG.GG......",
  ".....GG.GG......",
  "....GG...GG.....",
  "................",
  "................"
];

// P = Pink/Red obstacle (Cactus/Laser Spike)
const CACTUS_SMALL = [
  "...PP...",
  "...PP...",
  "...PP.PP",
  "PP.PP.PP",
  "PP.PP.PP",
  "PPPPPPPP",
  "PPPPPPPP",
  "...PP...",
  "...PP...",
  "...PP...",
  "...PP...",
  "...PP..."
];

const CACTUS_LARGE = [
  "......PP......",
  "......PP......",
  "..PP..PP..PP..",
  "..PP..PP..PP..",
  "..PPPPPPPPPP..",
  "..PPPPPPPPPP..",
  "....PPPPPP....",
  "......PP......",
  "......PP......",
  "......PP......",
  "......PP......",
  "......PP......"
];

// Flying Puzzles (B = Blue pterodactyl hazard)
const BIRD_UP = [
  "......BB......",
  ".....BBBB.....",
  "....BBBBBB....",
  "...BB.BB.BB...",
  "..BBBBBBBBBB..",
  "BBBBBBBBBBBBBB",
  "BB...BBBB...BB",
  ".....B..B.....",
  "....B....B....",
  "................"
];

const BIRD_DOWN = [
  "......BB......",
  ".....BBBB.....",
  "....BBBBBB....",
  "...BB.BB.BB...",
  "..BBBBBBBBBB..",
  "BB..BBBBBB..BB",
  "B...B....B...B",
  "....B....B....",
  ".....B..B.....",
  "................"
];

// O = Yellow Coin
const COIN_FRAME1 = [
  "..OOOO..",
  ".OOOOOO.",
  "OOO..OOO",
  "OO.OO.OO",
  "OO.OO.OO",
  "OOO..OOO",
  ".OOOOOO.",
  "..OOOO.."
];

const COIN_FRAME2 = [
  "...OO...",
  "..OOOO..",
  ".OO..OO.",
  ".O.OO.O.",
  ".O.OO.O.",
  ".OO..OO.",
  "..OOOO..",
  "...OO..."
];

const COIN_FRAME3 = [
  "....O...",
  "...OO...",
  "..O..O..",
  "..O..O..",
  "..O..O..",
  "..O..O..",
  "...OO...",
  "....O..."
];

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  ({ onScoreUpdate, onCoinCollected, onStateChange, isMuted }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Game state states
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
    const [score, setScore] = useState(0);
    const [coins, setCoins] = useState(0);
    const [highScore, setHighScore] = useState(() => {
      try {
        const hs = localStorage.getItem('teachable_high_score');
        return hs ? parseInt(hs, 10) : 0;
      } catch {
        return 0;
      }
    });

    // Reference to avoid re-running game loops on render
    const gameLoopRef = useRef<any>(null);
    const stateRef = useRef({
      gameState: 'idle' as 'idle' | 'playing' | 'gameover',
      score: 0,
      coins: 0,
      speed: 4.5,
      maxSpeed: 10,
      gravity: 0.6,
      jumpForce: -10,
      player: {
        x: 60,
        y: 195, // ground offset
        width: 44,
        height: 44,
        dy: 0,
        isJumping: false,
        isCrouching: false,
        animFrame: 0,
        animTick: 0,
        doubleJumpAvailable: true,
      },
      obstacles: [] as Array<{
        id: number;
        type: 'cactus_small' | 'cactus_large' | 'bird' | 'coin';
        x: number;
        y: number;
        width: number;
        height: number;
        speedX: number;
        passed: boolean;
        animFrame: number;
        animTick: number;
      }>,
      particles: [] as Array<{
        x: number;
        y: number;
        vx: number;
        vy: number;
        size: number;
        life: number;
        color: string;
      }>,
      bgStars: [] as Array<{ x: number; y: number; size: number; speed: number }>,
      bgClouds: [] as Array<{ x: number; y: number; width: number; height: number; speed: number }>,
      groundX: 0,
      timeElapsed: 0,
      milestoneTick: 100,
    });

    // Sync stateRef values
    useEffect(() => {
      stateRef.current.gameState = gameState;
    }, [gameState]);

    // Handle highscore saving
    useEffect(() => {
      if (score > highScore) {
        setHighScore(score);
        try {
          localStorage.setItem('teachable_high_score', score.toString());
        } catch (_) {}
      }
    }, [score, highScore]);

    // Initialize background stars and clouds
    useEffect(() => {
      const stars = [];
      for (let i = 0; i < 35; i++) {
        stars.push({
          x: Math.random() * 800,
          y: Math.random() * 140,
          size: Math.random() * 2 + 1,
          speed: Math.random() * 0.15 + 0.05,
        });
      }

      const clouds = [];
      for (let i = 0; i < 5; i++) {
        clouds.push({
          x: Math.random() * 800,
          y: Math.random() * 60 + 20,
          width: Math.random() * 60 + 40,
          height: Math.random() * 15 + 10,
          speed: Math.random() * 0.2 + 0.08,
        });
      }

      stateRef.current.bgStars = stars;
      stateRef.current.bgClouds = clouds;

      // Unmute/mute sync inside utility
      audio.setMuted(isMuted);
    }, [isMuted]);

    // Create custom particle burst
    const createExplosion = (x: number, y: number, color: string, count = 12) => {
      for (let i = 0; i < count; i++) {
        stateRef.current.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 2,
          size: Math.random() * 4 + 2,
          life: 1.0,
          color,
        });
      }
    };

    // Main Jump Action
    const jump = () => {
      const p = stateRef.current.player;
      if (stateRef.current.gameState !== 'playing') return;

      if (!p.isJumping) {
        p.dy = stateRef.current.jumpForce;
        p.isJumping = true;
        p.doubleJumpAvailable = true;
        audio.playJump();
        // Jump particles
        createExplosion(p.x + p.width / 2, p.y + p.height, '#22c55e', 6);
      } else if (p.doubleJumpAvailable) {
        p.dy = stateRef.current.jumpForce * 0.85; // slightly weaker double jump
        p.doubleJumpAvailable = false;
        audio.playJump();
        createExplosion(p.x + p.width / 2, p.y + p.height / 2, '#4ade80', 8);
      }
    };

    // Crouch trigger action
    const crouch = (crouching: boolean) => {
      const p = stateRef.current.player;
      if (stateRef.current.gameState !== 'playing') return;

      if (crouching && !p.isCrouching) {
        p.isCrouching = true;
        // Adjust bounding height and offset
        p.height = 24;
        p.y = 215; // move down to ground level
        audio.playCrouch();
      } else if (!crouching && p.isCrouching) {
        p.isCrouching = false;
        p.height = 44;
        p.y = 195; // restore normal ground position
      }
    };

    // Public controller interface via Imperative Handle
    useImperativeHandle(ref, () => ({
      triggerJump: () => {
        jump();
      },
      triggerCrouch: (isHold: boolean) => {
        crouch(isHold);
      },
      restartGame: () => {
        startGame();
      },
    }));

    // Start a new game
    const startGame = () => {
      const state = stateRef.current;
      state.score = 0;
      state.speed = 4.5;
      state.obstacles = [];
      state.particles = [];
      state.timeElapsed = 0;
      state.milestoneTick = 100;
      state.player = {
        x: 60,
        y: 195,
        width: 44,
        height: 44,
        dy: 0,
        isJumping: false,
        isCrouching: false,
        animFrame: 0,
        animTick: 0,
        doubleJumpAvailable: true,
      };

      setScore(0);
      setGameState('playing');
      onStateChange('playing');
      
      // Attempt BGM playback
      audio.setMuted(isMuted);
      audio.playBGM();
    };

    // End game sequence
    const triggerGameOver = () => {
      setGameState('gameover');
      onStateChange('gameover');
      audio.playCrash();
      audio.stopBGM();

      // Large multi-colored game crash explosion particles
      const p = stateRef.current.player;
      createExplosion(p.x + p.width / 2, p.y + p.height / 2, '#ef4444', 18);
      createExplosion(p.x + p.width / 2, p.y + p.height / 2, '#f59e0b', 12);
    };

    // Keyboard Event Handlers
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.repeat) return;
        
        if (e.code === 'ArrowUp' || e.code === 'Space') {
          e.preventDefault();
          if (stateRef.current.gameState === 'idle' || stateRef.current.gameState === 'gameover') {
            startGame();
          } else {
            jump();
          }
        } else if (e.code === 'ArrowDown') {
          e.preventDefault();
          crouch(true);
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'ArrowDown') {
          crouch(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, [isMuted]);

    // Core Canvas Game Loop Updater
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = window.devicePixelRatio || 1;
      canvas.width = 800 * scale;
      canvas.height = 300 * scale;
      ctx.imageSmoothingEnabled = false; // keep classic retro pixel layout crisp!
      ctx.scale(scale, scale);

      let lastTime = 0;

      const loop = (timestamp: number) => {
        if (!lastTime) lastTime = timestamp;
        const dt = timestamp - lastTime;
        lastTime = timestamp;

        update(dt);
        draw(ctx);

        gameLoopRef.current = requestAnimationFrame(loop);
      };

      // Updates internal game parameters
      const update = (dt: number) => {
        const state = stateRef.current;

        // Parallax background stars/clouds scroll, even on menu
        state.bgStars.forEach((star) => {
          star.x -= star.speed * (state.gameState === 'playing' ? state.speed * 0.15 : 0.5);
          if (star.x < 0) star.x = 800;
        });

        state.bgClouds.forEach((cloud) => {
          cloud.x -= cloud.speed * (state.gameState === 'playing' ? state.speed * 0.25 : 0.6);
          if (cloud.x < -cloud.width) {
            cloud.x = 800;
            cloud.y = Math.random() * 60 + 20;
          }
        });

        // Background terrain details scroll
        if (state.gameState === 'playing') {
          state.groundX -= state.speed;
          if (state.groundX <= -800) state.groundX = 0;
        }

        if (state.gameState !== 'playing') {
          // If in menu/dead, update particle life times
          state.particles.forEach((part, index) => {
            part.x += part.vx;
            part.y += part.vy;
            part.life -= 0.035;
            if (part.life <= 0) state.particles.splice(index, 1);
          });
          return;
        }

        // --- ACTIVE GAMEPLAY LOOP ---
        state.timeElapsed += dt;

        // Gradual speed increases
        if (state.speed < state.maxSpeed) {
          state.speed += 0.0007; // subtle incremental ramp up
        }

        // Manage Player physics
        const p = state.player;
        p.dy += state.gravity;
        p.y += p.dy;

        // Check ground plane collision
        const groundLevel = p.isCrouching ? 215 : 195;
        if (p.y >= groundLevel) {
          p.y = groundLevel;
          p.dy = 0;
          if (p.isJumping) {
            p.isJumping = false;
            p.doubleJumpAvailable = true;
            // Landing dust puff
            createExplosion(p.x + p.width / 2, p.y + p.height, '#e2e8f0', 4);
          }
        }

        // Trigger runner legs frames animation
        p.animTick += state.speed * 1.5;
        if (p.animTick >= 40) {
          p.animFrame = p.animFrame === 0 ? 1 : 0;
          p.animTick = 0;

          // Tiny ground running dust particles
          if (!p.isJumping) {
            state.particles.push({
              x: p.x + 5,
              y: groundLevel + p.height,
              vx: -state.speed * 0.5 - Math.random() * 1.5,
              vy: -Math.random() * 1.5,
              size: Math.random() * 2 + 1,
              life: 0.8,
              color: '#d1d5db',
            });
          }
        }

        // Manage obstacles spawning
        if (state.obstacles.length === 0 || state.obstacles[state.obstacles.length - 1].x < 800 - (Math.random() * 280 + 200)) {
          // Spawn logic: cactus small, large, flying bird, or a gold coin
          const roll = Math.random();
          let type: 'cactus_small' | 'cactus_large' | 'bird' | 'coin' = 'cactus_small';
          let w = 24;
          let h = 36;
          let y = 205; // grounded

          if (roll < 0.28) {
            type = 'cactus_small';
            w = 20;
            h = 30;
            y = 208;
          } else if (roll < 0.52) {
            type = 'cactus_large';
            w = 34;
            h = 42;
            y = 196;
          } else if (roll < 0.78) {
            type = 'bird';
            w = 32;
            h = 24;
            // Level heights for flying birds: crouch height (low bird 165), jump height (high bird 125)
            y = Math.random() > 0.6 ? 145 : 185;
          } else {
            type = 'coin';
            w = 16;
            h = 16;
            // Float coins at varying, fun levels
            y = Math.random() > 0.5 ? 180 : 130;
          }

          state.obstacles.push({
            id: Date.now() + Math.random(),
            type,
            x: 850,
            y,
            width: w,
            height: h,
            speedX: state.speed,
            passed: false,
            animFrame: 0,
            animTick: 0,
          });
        }

        // Update active obstacles and bounds
        state.obstacles.forEach((obs, index) => {
          obs.x -= state.speed;

          // Wing flapping or coin rotating frames
          obs.animTick += 1;
          if (obs.animTick >= 10) {
            obs.animFrame = (obs.animFrame + 1) % 3;
            obs.animTick = 0;
          }

          // Coin Collection Check
          if (obs.type === 'coin') {
            const hasCollided =
              p.x < obs.x + obs.width &&
              p.x + p.width > obs.x &&
              p.y < obs.y + obs.height &&
              p.y + p.height > obs.y;

            if (hasCollided) {
              audio.playCoin();
              state.coins += 1;
              onCoinCollected(state.coins);
              
              // Sparkly gold explosion
              createExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2, '#fbbf24', 8);
              state.obstacles.splice(index, 1);
              return;
            }
          }

          // Normal collision mapping with a generous collision buffer inset (tight boxes block frustration)
          const buffer = 4;
          if (obs.type !== 'coin') {
            const collision =
              p.x + buffer < obs.x + obs.width - buffer &&
              p.x + p.width - buffer > obs.x + buffer &&
              p.y + buffer < obs.y + obs.height - buffer &&
              p.y + p.height - buffer > obs.y + buffer;

            if (collision) {
              triggerGameOver();
            }
          }

          // Passing obstacles increases point count
          if (!obs.passed && obs.x + obs.width < p.x) {
            obs.passed = true;
            if (obs.type !== 'coin') {
              state.score += 10;
              setScore(state.score);
              onScoreUpdate(state.score);

              // Sound cue milestone milestone trigger
              if (state.score >= state.milestoneTick) {
                audio.playMilestone();
                state.milestoneTick += 100;

                // Fire fireworks style particles inside canvas
                for (let fire = 0; fire < 3; fire++) {
                  createExplosion(400 + (Math.random() - 0.5) * 200, 80 + (Math.random() - 0.5) * 50, '#3b82f6', 10);
                }
              }
            }
          }

          // Offscreen disposal
          if (obs.x < -80) {
            state.obstacles.splice(index, 1);
          }
        });

        // Update Particle life values
        state.particles.forEach((part, index) => {
          part.x += part.vx;
          part.y += part.vy;
          part.life -= 0.024;
          if (part.life <= 0) {
            state.particles.splice(index, 1);
          }
        });
      };

      // Custom matrix render sprite utility
      const drawPixelSprite = (
        ctx: CanvasRenderingContext2D,
        matrix: string[],
        x: number,
        y: number,
        w: number,
        h: number
      ) => {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const pixelW = w / cols;
        const pixelH = h / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const char = matrix[r][c];
            if (char === '.') continue;

            let color = '';
            // Pixel art color mapping rules
            if (char === 'G') color = '#22c55e'; // Bright active green dino
            else if (char === 'D') color = '#15803d'; // Forest shadow
            else if (char === 'E') color = '#ffffff'; // Eye white
            else if (char === 'K') color = '#0f172a'; // Pupil slate
            else if (char === 'X') color = '#ef4444'; // Red dead indicators
            else if (char === 'P') color = '#f43f5e'; // Glowing neon pink cactus/spike
            else if (char === 'B') color = '#2563eb'; // Aero sky blue bird hazards
            else if (char === 'O') color = '#fbbf24'; // Bright golden stars/coins
            else if (char === 'o') color = '#d97706'; // Dark amber trim

            ctx.fillStyle = color;
            ctx.fillRect(
              Math.floor(x + c * pixelW),
              Math.floor(y + r * pixelH),
              Math.ceil(pixelW),
              Math.ceil(pixelH)
            );
          }
        }
      };

      // Draw active elements
      const draw = (ctx: CanvasRenderingContext2D) => {
        const state = stateRef.current;
        ctx.clearRect(0, 0, 800, 300);

        // Ambient dark blue sky background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 800, 300);

        // Render background tiny glowing stars
        state.bgStars.forEach((star) => {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(Date.now() * 0.003 + star.x) * 0.4 + 0.6})`;
          ctx.fillRect(star.x, star.y, star.size, star.size);
        });

        // Render ambient clouds
        state.bgClouds.forEach((cloud) => {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(cloud.x, cloud.y, cloud.width, cloud.height);
          // Highlight rims
          ctx.fillStyle = '#334155';
          ctx.fillRect(cloud.x + 2, cloud.y + cloud.height - 3, cloud.width - 4, 2);
        });

        // Far horizontal 8-bit mountain peaks
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.moveTo(0, 238);
        ctx.lineTo(80, 180);
        ctx.lineTo(150, 238);
        ctx.lineTo(260, 160);
        ctx.lineTo(380, 238);
        ctx.lineTo(440, 190);
        ctx.lineTo(580, 238);
        ctx.lineTo(670, 175);
        ctx.lineTo(800, 238);
        ctx.lineTo(800, 300);
        ctx.lineTo(0, 300);
        ctx.closePath();
        ctx.fill();

        // High contrast grid desert floor line
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 238);
        ctx.lineTo(800, 238);
        ctx.stroke();

        // Animated neon ground grid dots to capture 3D speed velocity feeling
        ctx.fillStyle = '#334155';
        for (let d = 0; d < 12; d++) {
          const dotX = ((state.groundX + d * 80) % 800 + 800) % 800;
          ctx.fillRect(dotX, 245, 12, 4);
          ctx.fillRect((dotX * 1.5) % 800, 260, 24, 4);
          ctx.fillRect((dotX * 2.2) % 800, 280, 48, 5);
        }

        // Render Obstacles (Cactus, Birds, Coins)
        state.obstacles.forEach((obs) => {
          if (obs.type === 'cactus_small') {
            drawPixelSprite(ctx, CACTUS_SMALL, obs.x, obs.y, obs.width, obs.height);
          } else if (obs.type === 'cactus_large') {
            drawPixelSprite(ctx, CACTUS_LARGE, obs.x, obs.y, obs.width, obs.height);
          } else if (obs.type === 'bird') {
            const matrix = obs.animFrame === 0 ? BIRD_UP : BIRD_DOWN;
            drawPixelSprite(ctx, matrix, obs.x, obs.y, obs.width, obs.height);
          } else if (obs.type === 'coin') {
            const choice = obs.animFrame === 0 ? COIN_FRAME1 : obs.animFrame === 1 ? COIN_FRAME2 : COIN_FRAME3;
            drawPixelSprite(ctx, choice, obs.x, obs.y, obs.width, obs.height);
          }
        });

        // Render Particles (Explosions/Dust trail)
        state.particles.forEach((part) => {
          ctx.fillStyle = part.color;
          ctx.globalAlpha = part.life;
          ctx.fillRect(part.x, part.y, part.size, part.size);
        });
        ctx.globalAlpha = 1.0; // reset

        // Draw Player Sprites based on states
        const p = state.player;
        if (state.gameState === 'gameover') {
          drawPixelSprite(ctx, DINO_DEAD, p.x, p.y, p.width, p.height);
        } else if (p.isJumping) {
          drawPixelSprite(ctx, DINO_JUMP, p.x, p.y, p.width, p.height);
        } else if (p.isCrouching) {
          const frame = p.animFrame === 0 ? DINO_CROUCH1 : DINO_CROUCH2;
          drawPixelSprite(ctx, frame, p.x, p.y, p.width, p.height);
        } else {
          const frame = p.animFrame === 0 ? DINO_RUN1 : DINO_RUN2;
          drawPixelSprite(ctx, frame, p.x, p.y, p.width, p.height);
        }

        // Retro visual scanline overlay to complete the nostalgic arcade machine feel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        for (let s = 0; s < 300; s += 4) {
          ctx.fillRect(0, s, 800, 2);
        }

        // Draw HUD scores, overlays inside canvas if needed (we also do in DOM, but canvas looks extra nice!)
        if (state.gameState === 'idle') {
          // Centered title & call-to-action
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(180, 50, 440, 160);
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.strokeRect(180, 50, 440, 160);

          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 22px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('TEACHABLE MACHINE RUNNER', 400, 95);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '14px "Inter", sans-serif';
          ctx.fillText('PRESS SPACE BAR or UP ARROW TO START', 400, 140);
          
          ctx.fillStyle = '#94a3b8';
          ctx.font = '12px "Inter", sans-serif';
          ctx.fillText('Use Keyboard or load custom Gestures beneath', 400, 175);
        } else if (state.gameState === 'gameover') {
          // Gameover center card
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(200, 60, 400, 140);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(200, 60, 400, 140);

          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 28px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('GAME OVER', 400, 105);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '14px "Inter", sans-serif';
          ctx.fillText(`Final Count: ${state.score} pts  |  Coins: ${state.coins}`, 400, 140);

          ctx.fillStyle = '#22c55e';
          ctx.font = '11px "Inter", sans-serif';
          ctx.fillText('PRESS SPACE OR UP ARROW TO RESTART', 400, 170);
        }
      };

      // Start looping animation frames
      gameLoopRef.current = requestAnimationFrame(loop);

      return () => {
        if (gameLoopRef.current) {
          cancelAnimationFrame(gameLoopRef.current);
        }
      };
    }, [isMuted]);

    return (
      <div ref={containerRef} className="relative w-full aspect-[8/3] border-4 border-slate-700 bg-slate-900 overflow-hidden shadow-2xl rounded-lg">
        {/* Dynamic HUD in Overlay React DOM */}
        <div className="absolute top-3 left-4 right-4 flex justify-between items-center pointer-events-none select-none z-10">
          <div className="flex gap-4">
            <div className="bg-slate-950/80 px-3 py-1 border border-slate-800 rounded font-mono text-xs text-slate-300">
              <span className="text-slate-500">HI: </span>
              <span className="text-yellow-400 font-bold">{highScore.toString().padStart(5, '0')}</span>
            </div>
            <div className="bg-slate-950/80 px-3 py-1 border border-slate-800 rounded font-mono text-xs text-slate-300">
              <span className="text-slate-500">SCORE: </span>
              <span className="text-emerald-400 font-bold">{score.toString().padStart(5, '0')}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="bg-slate-950/80 px-3 py-1 border border-slate-800 rounded font-mono text-xs text-slate-300 flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-300 font-bold">★ {coins}</span>
            </div>

            {gameState === 'playing' && (
              <div className="bg-slate-950/80 px-3 py-1 border border-slate-800 rounded font-mono text-xs text-slate-400">
                <span>SPEED: </span>
                <span className="text-cyan-400 font-bold">{(stateRef.current.speed * 10).toFixed(0)} km/h</span>
              </div>
            )}
          </div>
        </div>

        {/* Canvas DOM Node */}
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    );
  }
);

GameCanvas.displayName = 'GameCanvas';
