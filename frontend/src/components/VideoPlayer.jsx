import React, { useEffect, useRef, useState } from 'react';
import { formatDuration } from '../utils/youtube.js';

let apiPromise = null;

function loadYouTubeApi() {
  if (typeof window !== 'undefined' && window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    // If window.YT is already in page, poll for Player constructor
    const checkInterval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkInterval);
        resolve(window.YT);
      }
    }, 50);

    setTimeout(() => {
      clearInterval(checkInterval);
    }, 8000);

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearInterval(checkInterval);
      if (typeof prevCallback === 'function') prevCallback();
      resolve(window.YT);
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        clearInterval(checkInterval);
        reject(new Error('Failed to load YouTube IFrame API script'));
      };
      document.head.appendChild(tag);
    }
  });

  return apiPromise;
}

const DRIFT_THRESHOLD_SECONDS = 2.0;

export default function VideoPlayer({
  videoId,
  title,
  isPlaying,
  isHost,
  syncSignal,
  syncPosition,
  onPlay,
  onPause,
  onSeek,
  onEnded,
  onHeartbeat
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [needsUserPlay, setNeedsUserPlay] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);

  const suppressEventsUntil = useRef(0);
  const currentLoadedVideoId = useRef(null);
  const lastKnown = useRef({ position: 0, time: Date.now() });

  function suppress(ms = 800) {
    suppressEventsUntil.current = Date.now() + ms;
  }

  function handleStateChange(event) {
    const YT = window.YT;
    if (!YT) return;

    if (event.data === YT.PlayerState.PLAYING) {
      setLocalPlaying(true);
      setNeedsUserPlay(false);
      if (Date.now() >= suppressEventsUntil.current && isHost) {
        onPlay?.(playerRef.current?.getCurrentTime?.() || 0);
      }
    } else if (event.data === YT.PlayerState.PAUSED) {
      setLocalPlaying(false);
      if (Date.now() >= suppressEventsUntil.current && isHost) {
        onPause?.(playerRef.current?.getCurrentTime?.() || 0);
      }
    } else if (event.data === YT.PlayerState.ENDED) {
      setLocalPlaying(false);
      if (isHost) {
        onEnded?.();
      }
    } else if (event.data === YT.PlayerState.CUED || event.data === -1) {
      setLocalPlaying(false);
      if (isPlaying) {
        setNeedsUserPlay(true);
      }
    }
  }

  // Initialize YouTube Iframe Player
  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;

        playerRef.current = new YT.Player(containerRef.current, {
          height: '100%',
          width: '100%',
          videoId: videoId || undefined,
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            controls: 1, // Enable YouTube desktop player controls for direct fallback
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              setReady(true);
              const player = event.target;
              if (videoId) {
                currentLoadedVideoId.current = videoId;
                const startPos = typeof syncPosition === 'number' ? syncPosition : 0;
                if (isPlaying) {
                  player.loadVideoById({ videoId, startSeconds: startPos });
                } else {
                  player.cueVideoById({ videoId, startSeconds: startPos });
                }
              }
            },
            onStateChange: handleStateChange,
            onError: (err) => {
              console.warn('[YouTube Player] Error code:', err?.data);
            }
          }
        });
      })
      .catch((err) => {
        console.error('[YouTube API] Load failed:', err);
        setApiError(true);
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle video changes
  useEffect(() => {
    if (!ready || !playerRef.current || !videoId) return;

    if (currentLoadedVideoId.current !== videoId) {
      currentLoadedVideoId.current = videoId;
      suppress(1200);

      const targetPos = typeof syncPosition === 'number' ? syncPosition : 0;
      if (isPlaying) {
        playerRef.current.loadVideoById({ videoId, startSeconds: targetPos });
      } else {
        playerRef.current.cueVideoById({ videoId, startSeconds: targetPos });
      }
    }
  }, [videoId, ready, isPlaying, syncPosition]);

  // Handle authoritative sync updates (from host or other clients)
  useEffect(() => {
    if (!ready || !playerRef.current || !videoId) return;
    const player = playerRef.current;

    suppress(800);

    try {
      const cur = player.getCurrentTime?.() ?? 0;
      if (typeof syncPosition === 'number' && Math.abs(cur - syncPosition) > DRIFT_THRESHOLD_SECONDS) {
        player.seekTo(syncPosition, true);
        setCurrentTime(syncPosition);
      }

      if (isPlaying) {
        player.playVideo();
        // Check after 800ms if desktop browser blocked unmuted autoplay
        setTimeout(() => {
          if (playerRef.current?.getPlayerState?.() !== 1) {
            setNeedsUserPlay(true);
          } else {
            setNeedsUserPlay(false);
          }
        }, 800);
      } else {
        player.pauseVideo();
        setNeedsUserPlay(false);
      }
    } catch {
      // player might still be transitioning
    }
  }, [syncSignal, ready, isPlaying, syncPosition, videoId]);

  // Track playback time, duration & emit host heartbeat
  useEffect(() => {
    if (!ready) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;

      try {
        const pos = player.getCurrentTime() || 0;
        const dur = player.getDuration?.() || 0;
        setCurrentTime(pos);
        if (dur > 0) setDuration(dur);

        const state = player.getPlayerState?.();
        setLocalPlaying(state === 1);

        if (isPlaying && state !== 1 && state !== 3) {
          // If room is playing but local player is paused/cued, prompt user
          setNeedsUserPlay(true);
        } else if (state === 1) {
          setNeedsUserPlay(false);
        }

        if (isHost && isPlaying) {
          const now = Date.now();
          const expected = lastKnown.current.position + (now - lastKnown.current.time) / 1000;

          if (Math.abs(pos - expected) > 2.5) {
            onSeek?.(pos);
          } else {
            onHeartbeat?.(pos, isPlaying);
          }

          lastKnown.current = { position: pos, time: now };
        }
      } catch {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, ready, isPlaying, onHeartbeat, onSeek]);

  // User Actions
  function handleTogglePlay() {
    if (!ready || !playerRef.current) return;
    const player = playerRef.current;

    if (isHost) {
      if (isPlaying) {
        player.pauseVideo();
        onPause?.(player.getCurrentTime?.() || 0);
      } else {
        player.unMute();
        player.playVideo();
        onPlay?.(player.getCurrentTime?.() || 0);
      }
    } else {
      // Listener clicking play -> Unmute, sync to host position, and play!
      player.unMute();
      if (typeof syncPosition === 'number') {
        player.seekTo(syncPosition, true);
      }
      player.playVideo();
      setNeedsUserPlay(false);
    }
  }

  function handleStartAudioSync() {
    if (!ready || !playerRef.current) return;
    const player = playerRef.current;
    player.unMute();
    player.setVolume(100);
    if (typeof syncPosition === 'number') {
      player.seekTo(syncPosition, true);
    }
    player.playVideo();
    setNeedsUserPlay(false);
  }

  function handleManualSeek(e) {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && playerRef.current?.seekTo) {
      suppress(1000);
      playerRef.current.seekTo(val, true);
      setCurrentTime(val);
      if (isHost) {
        onSeek?.(val);
      }
    }
  }

  function handleToggleMute() {
    if (!playerRef.current) return;
    const player = playerRef.current;
    if (isMuted) {
      player.unMute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  }

  function handleVolumeChange(e) {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(val);
      if (val > 0 && isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  }

  return (
    <div className="w-full flex flex-col">
      {/* Video Viewport */}
      <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden border border-bg-border relative shadow-lg">
        {/* The YouTube iframe container */}
        <div
          ref={containerRef}
          className={`w-full h-full ${!videoId ? 'opacity-0 pointer-events-none' : ''}`}
        />

        {/* Placeholder when no video is selected */}
        {!videoId && (
          <div className="absolute inset-0 bg-bg-elevated flex flex-col items-center justify-center border border-bg-border text-center px-6">
            <span className="text-4xl mb-3">📺</span>
            <p className="text-gray-300 font-medium text-sm mb-1">No video playing yet</p>
            <p className="text-gray-500 text-xs">
              Paste a YouTube link in the Queue on the right to start listening together!
            </p>
          </div>
        )}

        {/* Loading overlay */}
        {videoId && !ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated/90 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400 text-xs font-medium">Connecting YouTube player…</span>
            </div>
          </div>
        )}

        {/* Desktop Autoplay Block Notice Banner */}
        {needsUserPlay && videoId && (
          <div className="absolute inset-x-0 bottom-0 z-30 p-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex items-center justify-between gap-3 animate-slide-up">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl">🔊</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-100 truncate">Song is playing in room</p>
                <p className="text-[11px] text-gray-400 truncate">Click to enable sound & sync playback</p>
              </div>
            </div>
            <button
              onClick={handleStartAudioSync}
              className="btn-primary !py-1.5 !px-4 text-xs font-semibold whitespace-nowrap shadow-lg flex items-center gap-1.5 hover:scale-105 transition-transform"
            >
              <span>▶</span>
              <span>Tap to Play & Sync</span>
            </button>
          </div>
        )}

        {/* API Error display */}
        {apiError && (
          <div className="absolute inset-0 bg-bg-elevated flex flex-col items-center justify-center border border-red-900 text-center px-6">
            <span className="text-4xl mb-3">⚠️</span>
            <p className="text-red-400 text-sm">
              Couldn't connect to YouTube. Please check ad-blockers/network and refresh.
            </p>
          </div>
        )}
      </div>

      {/* Synchronized Control Toolbar */}
      {videoId && (
        <div className="mt-3 p-3 bg-bg-elevated/80 border border-bg-border rounded-xl flex flex-col gap-2.5 shadow-sm">
          {/* Progress Seek Bar */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono text-gray-400 w-10 text-right">
              {formatDuration(Math.floor(currentTime))}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={handleManualSeek}
              disabled={!isHost && !ready}
              className="flex-1 accent-accent cursor-pointer disabled:opacity-50"
              aria-label="Timeline seek"
            />
            <span className="text-[11px] font-mono text-gray-500 w-10">
              {formatDuration(Math.floor(duration))}
            </span>
          </div>

          {/* Controls: Play/Pause, Mute/Volume, Resync */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePlay}
                className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5"
                title={isHost ? (isPlaying ? 'Pause for room' : 'Play for room') : 'Play / Sync audio'}
              >
                <span>{isPlaying ? '⏸' : '▶'}</span>
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                onClick={handleStartAudioSync}
                className="btn-secondary !py-1.5 !px-2.5 text-xs text-accent hover:text-accent-hover"
                title="Resync to host position"
              >
                <span>🔄 Sync</span>
              </button>

              {isHost && (
                <span className="text-[10px] bg-amber-500/15 text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30 hidden sm:inline">
                  👑 You control playback
                </span>
              )}
            </div>

            {/* Local Volume Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMute}
                className="text-gray-400 hover:text-gray-200 text-sm p-1"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-18 sm:w-24 accent-accent cursor-pointer"
                aria-label="Volume control"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
