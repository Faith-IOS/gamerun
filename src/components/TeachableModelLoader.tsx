/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload, Sparkles, HelpCircle, AlertCircle, Play, Square, Settings, Check } from 'lucide-react';

interface TeachableModelLoaderProps {
  onJumpTrigger: () => void;
  onCrouchTrigger: (isHold: boolean) => void;
  onLog: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const TeachableModelLoader: React.FC<TeachableModelLoaderProps> = ({
  onJumpTrigger,
  onCrouchTrigger,
  onLog
}) => {
  // Model settings
  const [modelType, setModelType] = useState<'image' | 'pose'>('image');
  const [modelUrl, setModelUrl] = useState('');
  const [isLteLoaded, setIsLteLoaded] = useState(false);
  const [scriptsStatus, setScriptsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  
  // Available classes discovered in metadata
  const [detectedClasses, setDetectedClasses] = useState<string[]>([]);
  
  // Action Mappings (Label string to Game Command)
  const [jumpClass, setJumpClass] = useState<string>('');
  const [crouchClass, setCrouchClass] = useState<string>('');
  const [neutralClass, setNeutralClass] = useState<string>('');
  
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.80);
  
  // Simulated gestures (Sandbox Mode)
  const [isSandboxMode, setIsSandboxMode] = useState(true);
  const [simulatedClass, setSimulatedClass] = useState<string>('Neutral/Normal');

  // Webcam stream capture parameters
  const [webcamActive, setWebcamActive] = useState(false);
  const [predictions, setPredictions] = useState<Array<{ className: string; probability: number }>>([]);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const tmModelRef = useRef<any>(null);
  const tmWebcamRef = useRef<any>(null);
  const activeLoopRef = useRef<any>(null);
  const lastActivePoseActionRef = useRef<string>('neutral');

  // Dynamically load Teachable Machine CDN scripts sequentially
  const loadTeachableScripts = async () => {
    if (scriptsStatus === 'loading' || scriptsStatus === 'ready') return;
    setScriptsStatus('loading');
    onLog('Loading TensorFlow.ts core from CDNs...', 'info');

    try {
      // 1. Load basic TensorFlow core
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
      onLog('TF.JS loaded successfully. Booting Image/Pose handlers...', 'info');

      // 2. Load Image model package
      await loadScript('https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js');
      
      // 3. Load Pose model package
      await loadScript('https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8.5/dist/teachablemachine-pose.min.js');
      
      setScriptsStatus('ready');
      setIsLteLoaded(true);
      onLog('Teachable Machine SDK libraries loaded. Ready to bind camera or load models!', 'success');
    } catch (err) {
      setScriptsStatus('error');
      onLog('Failed to download TensorFlow/TeachableMachine assets from CDN.', 'error');
      console.error(err);
    }
  };

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already injected
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load script ${src}`));
      document.body.appendChild(s);
    });
  };

  // Start Sandbox preset immediately on component load
  useEffect(() => {
    // Populate dummy/mock classes for Sandbox mode
    const sandboxLabels = ['Neutral/Normal', 'Hands Up/Jump Gesture', 'Ducking/Crouch Gesture'];
    setDetectedClasses(sandboxLabels);
    setJumpClass('Hands Up/Jump Gesture');
    setCrouchClass('Ducking/Crouch Gesture');
    setNeutralClass('Neutral/Normal');
    onLog('Offline Simulation Sandbox launched! Toggle buttons below to simulate model outputs.', 'info');
  }, []);

  // Sandbox simulation triggers
  const triggerSandboxAction = (label: string) => {
    if (!isSandboxMode) return;
    setSimulatedClass(label);

    const mappedPredictions = detectedClasses.map((cls) => ({
      className: cls,
      probability: cls === label ? 1.0 : 0.0,
    }));
    setPredictions(mappedPredictions);

    // Trigger actions based on active mappings
    if (label === jumpClass) {
      onJumpTrigger();
      onCrouchTrigger(false);
      lastActivePoseActionRef.current = 'jump';
      onLog('🎮 [Simulated TM]: Detected *Jump* Class! Jumping.', 'success');
    } else if (label === crouchClass) {
      onCrouchTrigger(true);
      lastActivePoseActionRef.current = 'crouch';
      onLog('🎮 [Simulated TM]: Detected *Crouch* Class! Crouching.', 'success');
    } else {
      onCrouchTrigger(false);
      lastActivePoseActionRef.current = 'neutral';
    }
  };

  // Turn Sandbox OFF when loading a real URL
  const loadCustomTeachableMachineModel = async () => {
    if (scriptsStatus !== 'ready') {
      await loadTeachableScripts();
    }

    if (!modelUrl.trim()) {
      onLog('Please provide a valid Teachable Machine workspace URL.', 'warning');
      return;
    }

    // Standardize URL structure: must end with /
    let cleanUrl = modelUrl.trim();
    if (!cleanUrl.endsWith('/')) {
      cleanUrl += '/';
    }

    setModelLoading(true);
    onLog(`Connecting to model at ${cleanUrl}...`, 'info');

    try {
      const modelJson = `${cleanUrl}model.json`;
      const metadataJson = `${cleanUrl}metadata.json`;

      let model;
      if (modelType === 'image') {
        const tmImage = (window as any).tmImage;
        if (!tmImage) throw new Error('TeachableMachine library tfjs-image not found globally');
        model = await tmImage.load(modelJson, metadataJson);
      } else {
        const tmPose = (window as any).tmPose;
        if (!tmPose) throw new Error('TeachableMachine library tfjs-pose not found globally');
        model = await tmPose.load(modelJson, metadataJson);
      }

      tmModelRef.current = model;
      const classes = model.getClassLabels();
      setDetectedClasses(classes);

      // Auto-configure initial mappings based on regex guess
      let jCls = '';
      let cCls = '';
      let nCls = '';

      classes.forEach((label: string) => {
        const lowers = label.toLowerCase();
        if (lowers.includes('jump') || lowers.includes('up') || lowers.includes('raise') || lowers.includes('rise')) {
          jCls = label;
        } else if (lowers.includes('crouch') || lowers.includes('duck') || lowers.includes('down') || lowers.includes('low')) {
          cCls = label;
        } else if (lowers.includes('neutral') || lowers.includes('idle') || lowers.includes('normal') || lowers.includes('run')) {
          nCls = label;
        }
      });

      // Default if fallback not matched
      setJumpClass(jCls || classes[1] || '');
      setCrouchClass(cCls || classes[2] || '');
      setNeutralClass(nCls || classes[0] || '');

      setIsSandboxMode(false);
      setModelLoaded(true);
      setModelLoading(false);
      onLog(`Model linked! Classes loaded: [${classes.join(', ')}]. Core mappings suggested automatically.`, 'success');
    } catch (err: any) {
      setModelLoading(false);
      onLog(`Error connecting to model. Ensure URL is public and type is correct.`, 'error');
      console.error(err);
    }
  };

  // Setup actual browser webcam stream capture
  const toggleWebcam = async () => {
    if (webcamActive) {
      stopWebcam();
      return;
    }

    try {
      onLog('Requesting webcam camera device stream...', 'info');
      
      const width = 320;
      const height = 240;
      
      // Start browser standard getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width, height, facingMode: 'user' },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setWebcamActive(true);
      onLog('Webcam linked. Active scanning on running frames!', 'success');

      // Begin running predictions at 24FPS
      startPredictionLoop();
    } catch (err: any) {
      onLog('Failed to start webcam. Please grant layout camera frame permissions inside the browser settings.', 'error');
      console.error(err);
    }
  };

  const stopWebcam = () => {
    if (activeLoopRef.current) {
      cancelAnimationFrame(activeLoopRef.current);
      activeLoopRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    setWebcamActive(false);
    onLog('Webcam stream terminated.', 'info');
  };

  // Prediction loop running at 15-30 FPS via requestAnimationFrame
  const startPredictionLoop = () => {
    let lastPredictTime = 0;

    const loop = (timestamp: number) => {
      if (!webcamActive && !videoRef.current) return;

      // Restrict calculations to ~15 predictions a second to prevent heavy GPU thermal throttling
      if (timestamp - lastPredictTime > 66) {
        lastPredictTime = timestamp;
        predictFrame();
      }

      activeLoopRef.current = requestAnimationFrame(loop);
    };

    activeLoopRef.current = requestAnimationFrame(loop);
  };

  const predictFrame = async () => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Draw video frames to feedback canvas preview
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        // Flip horizontally to simulate mirror effect
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }

    // Run Teachable Machine Prediction if active
    if (modelLoaded && tmModelRef.current) {
      try {
        let predictionResults = [];

        if (modelType === 'image') {
          predictionResults = await tmModelRef.current.predict(video);
        } else {
          // Pose model handles keypoints estimation and draws skeletons
          const { pose, posenetOutput } = await tmModelRef.current.estimatePose(video);
          predictionResults = await tmModelRef.current.predict(posenetOutput);

          // Draw custom keypoints skeleton visualizer on webcam context preview
          const canvas = canvasRef.current;
          if (canvas && pose) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Scale skeleton to output preview coordinates
              drawSkeleton(ctx, pose.keypoints);
            }
          }
        }

        setPredictions(predictionResults);

        // Process active results mapping against threshold
        let highestClass = '';
        let highestProb = 0;

        predictionResults.forEach((pred: any) => {
          if (pred.probability > highestProb) {
            highestProb = pred.probability;
            highestClass = pred.className;
          }
        });

        if (highestProb >= confidenceThreshold) {
          if (highestClass === jumpClass) {
            if (lastActivePoseActionRef.current !== 'jump') {
              onJumpTrigger();
              onCrouchTrigger(false);
              lastActivePoseActionRef.current = 'jump';
              onLog(`🚀 Detected Gesture Action JUMP: [${highestClass}] - Conf: ${(highestProb * 100).toFixed(0)}%`, 'success');
            }
          } else if (highestClass === crouchClass) {
            onCrouchTrigger(true);
            lastActivePoseActionRef.current = 'crouch';
          } else {
            // Neutral / Run
            if (lastActivePoseActionRef.current === 'crouch') {
              onCrouchTrigger(false);
            }
            lastActivePoseActionRef.current = 'neutral';
          }
        } else {
          // Under threshold, default release crouch
          if (lastActivePoseActionRef.current === 'crouch') {
            onCrouchTrigger(false);
          }
          lastActivePoseActionRef.current = 'neutral';
        }
      } catch (err) {
        console.error('Prediction loop iteration failed', err);
      }
    }
  };

  // Sub-method to draw Pose keypoint circles on user feed canvas
  const drawSkeleton = (ctx: CanvasRenderingContext2D, keypoints: any[]) => {
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;

    const scaleX = canvasRef.current!.width / 320;
    const scaleY = canvasRef.current!.height / 240;

    keypoints.forEach((kp) => {
      if (kp.score > 0.5) {
        // Mirrored math since camera layout draws mirrored stream
        const drawX = canvasRef.current!.width - (kp.position.x * scaleX);
        const drawY = kp.position.y * scaleY;
        
        ctx.beginPath();
        ctx.arc(drawX, drawY, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // Cleanup on dismount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [webcamActive]);

  return (
    <div className="bg-white border-4 border-black rounded-[40px] p-5 flex flex-col gap-6 text-black shadow-[8px_8px_0px_0px_#222]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-lg font-black text-black flex items-center gap-2 font-sans uppercase tracking-tight">
            <Settings className="w-5 h-5 text-[#4D96FF]" />
            Control Center & Teachable Model Mapper
          </h2>
          <p className="text-xs text-slate-700 font-semibold mt-1 uppercase tracking-tight">
            Map webcam visual movements or keyboard buttons seamlessly to dino actions!
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsSandboxMode(true);
              setModelLoaded(false);
              // reset class models
              const simulated = ['Neutral/Normal', 'Hands Up/Jump Gesture', 'Ducking/Crouch Gesture'];
              setDetectedClasses(simulated);
              setJumpClass('Hands Up/Jump Gesture');
              setCrouchClass('Ducking/Crouch Gesture');
              setNeutralClass('Neutral/Normal');
              onLog('Secured sandbox mode preset.', 'info');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight transition duration-200 flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#222] ${
              isSandboxMode
                ? 'bg-[#FFD93D] text-black'
                : 'bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Sandbox Simulator
          </button>

          <button
            onClick={toggleWebcam}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight transition duration-200 flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#222] ${
              webcamActive
                ? 'bg-[#FF6B6B] text-white'
                : 'bg-[#4D96FF] text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            {webcamActive ? 'Stop Camera' : 'Activate Camera'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Link or configure model */}
        <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-5">
          <div className="bg-slate-50 p-4 border-2 border-black rounded-3xl shadow-[3px_3px_0px_0px_#222]">
            <h3 className="text-xs font-black uppercase tracking-wider text-black mb-3 flex items-center justify-between">
              <span>Link your Teachable Machine Model</span>
              <a
                href="https://teachablemachine.withgoogle.com/"
                target="_blank"
                referrerPolicy="no-referrer"
                rel="noreferrer"
                className="text-xs text-[#2D31FA] font-bold hover:underline flex items-center gap-1 lowercase"
              >
                Let's train gestures inside browser →
              </a>
            </h3>

            <div className="flex flex-col gap-3.5">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase text-slate-700">
                  <input
                    type="radio"
                    name="modelType"
                    checked={modelType === 'image'}
                    onChange={() => setModelType('image')}
                    className="accent-[#4D96FF] w-4 h-4"
                  />
                  <span>Image Workspace Model</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase text-slate-700">
                  <input
                    type="radio"
                    name="modelType"
                    checked={modelType === 'pose'}
                    onChange={() => setModelType('pose')}
                    className="accent-[#4D96FF] w-4 h-4"
                  />
                  <span>Pose Skeleton Model</span>
                </label>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={modelUrl}
                  onChange={(e) => setModelUrl(e.target.value)}
                  placeholder="Paste URL e.g. https://teachablemachine.withgoogle.com/models/..."
                  className="bg-white border-2 border-black rounded-lg px-3 py-2 text-xs flex-grow focus:outline-none focus:border-[#4D96FF] font-mono text-black placeholder:text-slate-400"
                />
                <button
                  onClick={loadCustomTeachableMachineModel}
                  disabled={modelLoading}
                  className="bg-[#6BCB77] border-2 border-black text-black px-4 text-xs font-black uppercase rounded-lg transition duration-200 disabled:opacity-50 flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#222]"
                >
                  {modelLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Link
                </button>
              </div>
            </div>
          </div>

          {/* Action Mappings Grid Layout */}
          <div className="bg-slate-50 p-4 border-2 border-black rounded-3xl shadow-[3px_3px_0px_0px_#222] flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center justify-between">
              <span>Dynamic Calibration Maps</span>
              <span className="text-[10px] text-white uppercase font-bold bg-black px-2 py-0.5 rounded">
                {isSandboxMode ? 'simulation' : 'webcam mapped'}
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Jump mapping dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-700 font-bold uppercase tracking-tight">✨ Action: JUMP</label>
                <select
                  value={jumpClass}
                  onChange={(e) => setJumpClass(e.target.value)}
                  className="bg-white border-2 border-black rounded-lg px-2.5 py-1.5 text-xs text-black font-semibold"
                >
                  <option value="">-- No class mapped --</option>
                  {detectedClasses.map((cl) => (
                    <option key={cl} value={cl}>
                      {cl}
                    </option>
                  ))}
                </select>
              </div>

              {/* Crouch mapping dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-700 font-bold uppercase tracking-tight">🛡️ Action: CROUCH</label>
                <select
                  value={crouchClass}
                  onChange={(e) => setCrouchClass(e.target.value)}
                  className="bg-white border-2 border-black rounded-lg px-2.5 py-1.5 text-xs text-black font-semibold"
                >
                  <option value="">-- No class mapped --</option>
                  {detectedClasses.map((cl) => (
                    <option key={cl} value={cl}>
                      {cl}
                    </option>
                  ))}
                </select>
              </div>

              {/* Neutral running mapping dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-700 font-bold uppercase tracking-tight">🏃 Action: NEUTRAL/RUN</label>
                <select
                  value={neutralClass}
                  onChange={(e) => setNeutralClass(e.target.value)}
                  className="bg-white border-2 border-black rounded-lg px-2.5 py-1.5 text-xs text-black font-semibold"
                >
                  <option value="">-- No class mapped --</option>
                  {detectedClasses.map((cl) => (
                    <option key={cl} value={cl}>
                      {cl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-700">
                <span>Confidence Threshold</span>
                <span className="font-mono text-[#4D96FF] font-black">{(confidenceThreshold * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 accent-[#4D96FF] rounded-lg cursor-pointer border border-black"
              />
            </div>
          </div>

          {/* Guidelines info card */}
          <div className="bg-[#4D96FF]/10 px-4 py-3.5 border-2 border-black rounded-2xl flex gap-3 items-start">
            <HelpCircle className="w-5 h-5 text-[#2D31FA] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-800 leading-relaxed font-semibold">
              <strong className="text-black font-black uppercase">Quick Practice Controls:</strong> Use your keyboard Arrow keys! —
              <span className="bg-white px-1.5 py-0.5 text-[#2D31FA] border-2 border-black rounded font-mono font-bold mx-1 text-[11px] shadow-[1px_1px_0px_0px_#000]">↑ Arrow / Space</span> triggers jumps.
              <span className="bg-white px-1.5 py-0.5 text-[#2D31FA] border-2 border-black rounded font-mono font-bold mx-1 text-[11px] shadow-[1px_1px_0px_0px_#000]">↓ Arrow</span> triggers crouching ducks.
            </div>
          </div>
        </div>

        {/* Right Column: Web Cam Capture or Simulator Feed */}
        <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-50 p-4 border-2 border-black rounded-3xl shadow-[3px_3px_0px_0px_#222] flex flex-col gap-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-black">
              Webcam Capture & Visualizer
            </h3>

            <div className="relative aspect-[4/3] w-full bg-[#222] rounded-2xl overflow-hidden border-2 border-black flex items-center justify-center">
              {/* HTML5 Video element stream hidden of real predict */}
              <video
                ref={videoRef}
                className="hidden"
                width="320"
                height="240"
                playsInline
                muted
              />

              {/* Graphical User Canvas Feed showing video skeleton and keypoints */}
              <canvas
                ref={canvasRef}
                className={`w-full h-full block ${webcamActive ? 'opacity-100' : 'opacity-0 absolute'}`}
                width="320"
                height="240"
              />

              {!webcamActive && (
                <div className="flex flex-col items-center text-center p-4">
                  <div className="w-12 h-12 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#222] rounded-full flex items-center justify-center mb-3">
                    <Camera className="w-6 h-6 text-black" />
                  </div>
                  <p className="text-xs text-white font-black uppercase tracking-tight">Camera Feed Inactive</p>
                  <p className="text-[11px] text-slate-300 max-w-xs mt-1 leading-normal font-semibold">
                    Turn on the webcam to start gesture predictions and skeleton drawings live!
                  </p>
                  <button
                    onClick={toggleWebcam}
                    className="mt-4 bg-[#4D96FF] hover:bg-[#3b82f6] text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] font-black uppercase tracking-tight text-xs px-4 py-2 rounded-xl"
                  >
                    Enable Webcam Stream
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sandbox Gesture controls OR Active Predictions bars */}
          <div className="bg-slate-50 p-4 border-2 border-black rounded-3xl shadow-[3px_3px_0px_0px_#222] flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-black">
              {isSandboxMode ? 'Sandbox Output Emulator' : 'Real-time Prediction Bars'}
            </h3>

            {isSandboxMode ? (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-slate-700 font-semibold uppercase tracking-tight">
                  No Teachable Model linked? Press below to trigger simulated gesture classifications:
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => triggerSandboxAction(neutralClass)}
                    className={`px-3 py-2 rounded-xl text-xs font-black text-center border-2 border-black transition font-mono uppercase shadow-[2px_2px_0px_0px_#222] ${
                      simulatedClass === neutralClass
                        ? 'bg-[#4D96FF] text-white'
                        : 'bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    🏃 Run/Idle
                  </button>
                  <button
                    onClick={() => triggerSandboxAction(jumpClass)}
                    className={`px-3 py-2 rounded-xl text-xs font-black text-center border-2 border-black transition font-mono uppercase shadow-[2px_2px_0px_0px_#222] ${
                      simulatedClass === jumpClass
                        ? 'bg-[#6BCB77] text-black'
                        : 'bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    🚀 Jump
                  </button>
                  <button
                    onClick={() => triggerSandboxAction(crouchClass)}
                    className={`px-3 py-2 rounded-xl text-xs font-black text-center border-2 border-black transition font-mono uppercase shadow-[2px_2px_0px_0px_#222] ${
                      simulatedClass === crouchClass
                        ? 'bg-[#FFD93D] text-black'
                        : 'bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    🛡️ Crouch
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {predictions.length === 0 ? (
                  <p className="text-xs text-slate-650 italic font-semibold uppercase mt-1">Starting live classification stream...</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {predictions.map((pred) => {
                      const isTrigger = pred.probability >= confidenceThreshold;
                      let labelEmoji = '⚙️';
                      let colorClass = 'bg-slate-400';

                      if (pred.className === jumpClass) {
                        labelEmoji = '🚀';
                        colorClass = isTrigger ? 'bg-[#6BCB77]' : 'bg-[#6BCB77]/40';
                      } else if (pred.className === crouchClass) {
                        labelEmoji = '🛡️';
                        colorClass = isTrigger ? 'bg-[#FFD93D]' : 'bg-[#FFD93D]/40';
                      } else if (pred.className === neutralClass) {
                        labelEmoji = '🏃';
                        colorClass = isTrigger ? 'bg-[#4D96FF]' : 'bg-[#4D96FF]/40';
                      }

                      return (
                        <div key={pred.className} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold font-mono uppercase">
                            <span className="flex items-center gap-1.5 truncate">
                              <span>{labelEmoji}</span>
                              <span className={isTrigger ? "text-black font-black" : "text-slate-600"}>
                                {pred.className}
                              </span>
                            </span>
                            <span className={isTrigger ? "text-[#2D31FA] font-black" : "text-slate-500"}>
                              {(pred.probability * 100).toFixed(0)}%
                            </span>
                          </div>

                          <div className="w-full h-4 bg-slate-250 border-2 border-black rounded-full overflow-hidden flex items-center">
                            <div
                              className={`h-full rounded-full border-r-2 border-black transition-all duration-75 ${colorClass}`}
                              style={{ width: `${pred.probability * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
