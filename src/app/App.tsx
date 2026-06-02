import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { motion } from 'motion/react';
import { Play, Pause, SkipForward, SkipBack, ExternalLink } from 'lucide-react';

import neverGonnaGiveYouUp from '../assets/songs/rick-astley-never-gonna-give-you-up.mp3';
import welcomeToTheJungle from '../assets/songs/guns-n-roses-welcome-to-the-jungle.mp3';
import acesHigh from '../assets/songs/iron-maiden-aces-high.mp3';
import giveItAway from '../assets/songs/red-hot-chili-peppers-give-it-away.mp3';
import seekAndDestroy from '../assets/songs/metallica-seek-and-destroy.mp3';

// Songs are bundled from src/assets/songs/. `url` is the local mp3 the player
// streams; `source` is the canonical link shown on the row's external icon.
const SONGS = [
  { id: 0, title: "Never Gonna Give You Up", artist: "Rick Astley", cover: "https://i.scdn.co/image/ab67616d0000b2733a67639779ccabd632e1a80e", duration: 212, url: neverGonnaGiveYouUp, source: "https://youtu.be/dQw4w9WgXcQ" },
  { id: 1, title: "Welcome to the Jungle", artist: "Guns N' Roses", cover: "https://i.scdn.co/image/ab67616d0000b27321ebf49b3292c3f0f575f0f5", duration: 271, url: welcomeToTheJungle, source: "https://youtu.be/9erLsEHAZRI" },
  { id: 2, title: "Aces High", artist: "Iron Maiden", cover: "https://upload.wikimedia.org/wikipedia/en/7/73/Aces_High_%28Iron_Maiden_single_-_cover_art%29.jpg", duration: 271, url: acesHigh, source: "https://youtu.be/CfPKxm9O04Y" },
  { id: 3, title: "Give It Away", artist: "Red Hot Chili Peppers", cover: "https://i.scdn.co/image/ab67616d00001e02153d79816d853f2694b2cc70", duration: 283, url: giveItAway, source: "https://youtu.be/2Wx_UG_UjTY" },
  { id: 4, title: "Seek & Destroy", artist: "Metallica", cover: "https://upload.wikimedia.org/wikipedia/en/5/5c/Metallica_-_Kill_%27Em_All_cover.jpg", duration: 415, url: seekAndDestroy, source: "https://youtu.be/FLTchCiC0T0" },
];

const REST_ANGLE = -15;
const TRACK_WIDTH = 5; // degrees per track on the record

export default function App() {
  const [activeTrack, setActiveTrack] = useState<number | null>(null);
  const [lastTrack, setLastTrack] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [dragAngle, setDragAngle] = useState(REST_ANGLE);
  const pivotRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  const seekToFraction = (fraction: number) => {
    const el = playerRef.current;
    if (!el) return false;
    const duration = el.duration;
    if (!Number.isFinite(duration) || duration <= 0) return false;
    el.currentTime = Math.max(0, Math.min(duration - 0.05, fraction * duration));
    return true;
  };

  // Audio Context for authentic vinyl crackle
  useEffect(() => {
    if (!isPlaying) return;
    
    let ctx: AudioContext | null = null;
    let noise: AudioBufferSourceNode | null = null;
    
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            let val = white * 0.015;
            if (Math.random() < 0.0003) val += white * 0.5; // occasional pop
            output[i] = val;
        }
        noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2500;

        const gain = ctx.createGain();
        gain.gain.value = 0.3;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start();
      }
    } catch (e) {
      console.warn("Web Audio not supported or failed to start", e);
    }
    
    return () => {
      if (noise) noise.stop();
      if (ctx) ctx.close();
    };
  }, [isPlaying]);

  // Removed track progress simulation; replaced by react-player

  // Pointer dragging logic for Tone Arm
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setIsPlaying(false);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !pivotRef.current) return;
    const rect = pivotRef.current.getBoundingClientRect();
    const pivotX = rect.left + rect.width / 2;
    const pivotY = rect.top + rect.height / 2;
    
    const dx = e.clientX - pivotX;
    const dy = e.clientY - pivotY;
    
    let newAngle = Math.atan2(-dx, dy) * (180 / Math.PI);
    newAngle = Math.max(-20, Math.min(30, newAngle));
    setDragAngle(newAngle);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    
    // Snap to tracks based on angle
    if (dragAngle >= 0 && dragAngle <= 25) {
       const trackIndex = Math.floor(dragAngle / TRACK_WIDTH);
       const safeIndex = Math.max(0, Math.min(4, trackIndex));
       setActiveTrack(safeIndex);
       setLastTrack(safeIndex);
       setIsPlaying(true);
       const trackProgress = (dragAngle - (safeIndex * TRACK_WIDTH)) / TRACK_WIDTH;
       const newProgress = Math.max(0, Math.min(0.99, trackProgress));
       setProgress(newProgress);
       
       pendingSeek.current = newProgress;
       seekToFraction(newProgress);
    } else {
       setActiveTrack(null);
       setIsPlaying(false);
    }
  };

  // Compute final arm angle based on state
  let computedAngle = REST_ANGLE;
  if (isDragging) {
    computedAngle = dragAngle;
  } else if (activeTrack !== null) {
    computedAngle = (activeTrack * TRACK_WIDTH) + (progress * TRACK_WIDTH);
  }

  const togglePlay = () => {
    if (activeTrack === null) {
       setActiveTrack(0);
       setLastTrack(0);
       setProgress(0);
       setIsPlaying(true);
    } else {
       setIsPlaying(!isPlaying);
    }
  };

  const playNext = () => {
    if (activeTrack === null) return;
    const next = (activeTrack + 1) % SONGS.length;
    setActiveTrack(next);
    setLastTrack(next);
    setProgress(0);
    setIsPlaying(true);
  };

  const playPrev = () => {
    if (activeTrack === null) return;
    const prev = (activeTrack - 1 + SONGS.length) % SONGS.length;
    setActiveTrack(prev);
    setLastTrack(prev);
    setProgress(0);
    setIsPlaying(true);
  };

  const playSpecificTrack = (index: number) => {
    if (activeTrack === index) {
       setIsPlaying(!isPlaying);
    } else {
       setActiveTrack(index);
       setLastTrack(index);
       setProgress(0);
       setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentCover = activeTrack !== null ? SONGS[activeTrack].cover : SONGS[lastTrack].cover;
  
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (isDragging) return;
    const el = e.currentTarget;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    setProgress(el.currentTime / el.duration);
  };

  const handleEnded = () => {
    if (activeTrack === null) return;
    const next = activeTrack + 1;
    if (next < SONGS.length) {
       setActiveTrack(next);
       setLastTrack(next);
       setProgress(0);
       setIsPlaying(true);
    } else {
       setIsPlaying(false);
       setActiveTrack(null);
       setProgress(0);
    }
  };
  
  const handleReady = () => {
    setIsReady(true);
    if (pendingSeek.current !== null && seekToFraction(pendingSeek.current)) {
       pendingSeek.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1D] text-white flex flex-col font-sans overflow-hidden touch-manipulation">
      <style>{`
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header */}
      <div className="pt-10 pb-4 px-6 text-center z-10 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Vinyl Player</h1>
        <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-mono">Move the tone arm to play</p>
      </div>

      {/* Main Player Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 relative z-0 shrink-0 mt-2 mb-6">
         {/* Turntable Base */}
         <div className="relative w-[340px] h-[340px] bg-[#2a2a2c] rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] border-t-2 border-zinc-600/30 flex items-center justify-center">
            
            {/* Status Lights */}
            <div className="absolute bottom-8 left-8 flex gap-3">
               <div className={`w-3 h-3 rounded-full shadow-inner border border-black/50 ${isPlaying ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-zinc-700'}`}></div>
               <div className={`w-3 h-3 rounded-full shadow-inner border border-black/50 ${!isPlaying && activeTrack !== null ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-zinc-700'}`}></div>
            </div>
            
            <div className="absolute bottom-8 right-10 text-[10px] font-mono text-zinc-500 uppercase tracking-widest opacity-60">
               Make-FX-1
            </div>

            {/* Platter */}
            <div className="absolute w-[290px] h-[290px] rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex items-center justify-center border-b-4 border-zinc-600">
               {/* Vinyl Record */}
               <div className={`relative w-[280px] h-[280px] rounded-full bg-[#0a0a0a] shadow-2xl flex items-center justify-center border-4 border-zinc-900 ${isPlaying ? 'animate-[spin_3s_linear_infinite]' : ''}`} style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}>
                  
                  {/* Grooves */}
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="absolute rounded-full border border-white/[0.03]" style={{ width: `${95 - i*8}%`, height: `${95 - i*8}%` }} />
                  ))}
                  
                  {/* Vinyl Reflections */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/5 via-transparent to-white/5 mix-blend-overlay"></div>
                  <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.08)_45deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.08)_225deg,transparent_270deg)]"></div>

                  {/* Center Label */}
                  <div className="relative w-[100px] h-[100px] rounded-full overflow-hidden shadow-inner border-[4px] border-zinc-800 flex items-center justify-center bg-zinc-900">
                     <img src={currentCover} className={`w-full h-full object-cover transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-80'}`} alt="Center Label" />
                     {/* Spindle hole */}
                     <div className="absolute w-3 h-3 bg-zinc-400 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border border-zinc-600 z-10"></div>
                  </div>
               </div>
            </div>

            {/* Static Pivot Base Wrapper */}
            <div ref={pivotRef} className="absolute top-[35px] right-[35px] w-[30px] h-[30px] z-20">
               {/* Moveable Tone Arm */}
               <motion.div
                  animate={{ rotate: computedAngle }}
                  transition={{ 
                    type: isDragging ? "tween" : "spring", 
                    duration: isDragging ? 0 : 0.6,
                    stiffness: 70, 
                    damping: 15 
                  }}
                  style={{ transformOrigin: "15px 15px" }}
                  className="absolute inset-0 flex justify-center"
               >
                  {/* Counterweight */}
                  <div className="absolute top-[-20px] w-[22px] h-[26px] bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-sm shadow-lg border-b-2 border-zinc-950" />
                  
                  {/* Pivot Pin */}
                  <div className="absolute top-[8px] left-[8px] w-[14px] h-[14px] bg-zinc-900 rounded-full shadow-inner border border-zinc-700 z-10" />

                  {/* Arm Tube */}
                  <div className="absolute top-[15px] w-[6px] h-[160px] bg-gradient-to-r from-zinc-300 via-zinc-400 to-zinc-500 rounded-full shadow-[2px_5px_10px_rgba(0,0,0,0.5)]" />
                  
                  {/* Headshell Hitbox (Larger for mobile touch precision) */}
                  <div 
                     className="absolute top-[165px] left-[-9px] w-[24px] h-[50px] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none z-30"
                     onPointerDown={handlePointerDown}
                     onPointerMove={handlePointerMove}
                     onPointerUp={handlePointerUp}
                     onPointerCancel={handlePointerUp}
                  >
                     {/* Headshell Visual */}
                     <div className="w-[14px] h-[36px] bg-zinc-800 rotate-[18deg] rounded-[2px] origin-top shadow-[2px_10px_10px_rgba(0,0,0,0.4)] border-t border-zinc-600 relative">
                        {/* Stylus */}
                        <div className="absolute bottom-0 right-[-2px] w-[2px] h-[6px] bg-red-500/80 rounded-b-sm" />
                     </div>
                  </div>
               </motion.div>
            </div>
         </div>

         {/* Transport Controls */}
         <div className="flex items-center gap-6 mt-8 z-10">
            <button onClick={playPrev} className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
               <SkipBack size={24} />
            </button>
            <button onClick={togglePlay} className="w-16 h-16 flex items-center justify-center bg-white text-black rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all">
               {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} className="ml-1" fill="currentColor" />}
            </button>
            <button onClick={playNext} className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
               <SkipForward size={24} />
            </button>
         </div>
      </div>

      {/* Tracklist UI */}
      <div className="bg-[#222225] rounded-t-[32px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] flex-1 min-h-[40vh] z-20 flex flex-col">
         <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mb-6" />
         
         <div className="flex-1 overflow-y-auto space-y-2 pr-2 pb-10 hide-scroll">
            {SONGS.map((song, i) => (
                <div 
                  key={song.id} 
                  onClick={() => playSpecificTrack(i)}
                  className={`flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer ${activeTrack === i ? 'bg-white/10 shadow-sm' : 'hover:bg-white/5'}`}
                >
                   <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative shadow-md">
                      <img src={song.cover} alt={song.title} className="w-full h-full object-cover" />
                      {activeTrack === i && isPlaying && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                           <AudioWave />
                        </div>
                      )}
                   </div>
                   <div className="flex-1 min-w-0">
                      <h3 className={`font-medium truncate ${activeTrack === i ? 'text-white' : 'text-zinc-300'}`}>{song.title}</h3>
                      <p className="text-sm text-zinc-500 truncate">{song.artist}</p>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="text-sm text-zinc-500 tabular-nums flex flex-col items-end">
                         {activeTrack === i ? (
                            <>
                              <span className="text-white/90">{formatTime(progress * song.duration)}</span>
                              <span className="text-[10px] text-zinc-500">/ {formatTime(song.duration)}</span>
                            </>
                         ) : (
                            <span>{formatTime(song.duration)}</span>
                         )}
                      </div>
                      <a
                         href={song.source}
                         target="_blank"
                         rel="noopener noreferrer"
                         onClick={(e) => e.stopPropagation()}
                         className="p-2 -mr-2 text-zinc-500 hover:text-white transition-colors"
                         aria-label={`Open ${song.title} on YouTube`}
                      >
                         <ExternalLink size={16} />
                      </a>
                   </div>
                </div>
            ))}
         </div>
      </div>
      
      {/* Hidden audio player (local mp3s from src/assets/songs/) */}
      <ReactPlayer
        ref={playerRef}
        src={activeTrack !== null ? SONGS[activeTrack].url : undefined}
        playing={isPlaying && !isDragging}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onReady={handleReady}
        onStart={handleReady}
        width="1px"
        height="1px"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}

const AudioWave = () => (
  <div className="flex items-center gap-[3px]">
     <motion.div animate={{ height: [6, 14, 6] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }} className="w-1 bg-white rounded-full" />
     <motion.div animate={{ height: [6, 18, 6] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.1, ease: "easeInOut" }} className="w-1 bg-white rounded-full" />
     <motion.div animate={{ height: [6, 12, 6] }} transition={{ repeat: Infinity, duration: 0.7, delay: 0.2, ease: "easeInOut" }} className="w-1 bg-white rounded-full" />
  </div>
);
