import React, { useEffect, useRef, useState } from 'react';

let apiPromise = null;

function loadYouTubeApi() {
  if (typeof window !== 'undefined' && window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback();
      resolve(window.YT);
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  });

  return apiPromise;
}

const DRIFT_THRESHOLD_SECONDS = 2.0;

export default function VideoPlayer({
  videoId,
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
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const suppressEventsUntil = useRef(0);
  const currentLoadedVideoId = useRef(null);
  const [duration, setDuration] = useState(0);
  const [currentProgress, setCurrentProgress] = useState(0);

  function suppress(ms = 800) {
    suppressEventsUntil.current = Date.now() + ms;
  }

  function handleStateChange(event) {
    const YT = window.YT;
    if (!YT || Date.now() < suppressEventsUntil.current) return;

    if (event.data === YT.PlayerState.PLAYING) {
      setAutoplayBlocked(false);
      if (isHost) {
        onPlay?.(playerRef.current?.getCurrentTime?.() || 0);
      }
    } else if (event.data === YT.PlayerState.PAUSED) {
      if (isHost) {
        onPause?.(playerRef.current?.getCurrentTime?.() || 0);
      }
    } else if (event.data === YT.PlayerState.ENDED) {
      if (isHost) {
        onEnded?.();
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
                if (isPlaying) {
                  player.loadVideoById({
                    videoId,
                    startSeconds: typeof syncPosition === 'number' ? syncPosition : 0
                  });
                } else {
                  player.cueVideoById({
                    videoId,
                    startSeconds: typeof syncPosition === 'number' ? syncPosition : 0
                  });
                }
              }
            },
            onStateChange: handleStateChange,
            onError: (err) => {
              console.warn('[YouTube Player] Notice:', err?.data);
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
        // ignore cleanup error
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle videoId changes
  useEffect(() => {
    if (!ready || !playerRef.current || !videoId) return;

    if (currentLoadedVideoId.current !== videoId) {
      currentLoadedVideoId.current = videoId;
      suppress(1200);

      const targetPos = typeof syncPosition === 'number' ? syncPosition : 0;
      if (isPlaying) {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: targetPos
        });
      } else {
        playerRef.current.cueVideoById({
          videoId,
          startSeconds: targetPos
        });
      }
    }
  }, [videoId, ready, isPlaying, syncPosition]);

  // Handle authoritative sync updates (play / pause / seek from server)
  useEffect(() => {
    if (!ready || !playerRef.current || !videoId) return;
    const player = playerRef.current;

    suppress(800);

    try {
      const cur = player.getCurrentTime?.() ?? 0;
      if (typeof syncPosition === 'number' && Math.abs(cur - syncPosition) > DRIFT_THRESHOLD_SECONDS) {
        player.seekTo(syncPosition, true);
      }

      if (isPlaying) {
        const playPromise = player.playVideo?.();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            setAutoplayBlocked(true);
          });
        }
      } else {
        player.pauseVideo?.();
      }
    } catch {
      // player might still be transitioning
    }
  }, [syncSignal, ready, isPlaying, syncPosition, videoId]);

  // Host heartbeat & tracking duration / progress
  const lastKnown = useRef({ position: 0, time: Date.now() });

  useEffect(() => {
    if (!ready) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;

      try {
        const pos = player.getCurrentTime();
        const dur = player.getDuration?.() || 0;
        setCurrentProgress(pos);
        if (dur > 0) setDuration(dur);

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
    }, 1500);

    return () => clearInterval(interval);
  }, [isHost, ready, isPlaying, onHeartbeat, onSeek]);

  function handleManualSeek(e) {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && playerRef.current?.seekTo) {
      suppress(1000);
      playerRef.current.seekTo(val, true);
      setCurrentProgress(val);
      onSeek?.(val);
    }
  }

  function handleUserStartPlayback() {
    setAutoplayBlocked(false);
    try {
      playerRef.current?.playVideo?.();
    } catch {
      // ignore
    }
  }

  return (
    <div className="w-full flex flex-col">
      <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden border border-bg-border relative shadow-lg">
        {/* The YouTube iframe container is permanently attached */}
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
              Paste a YouTube link in the Queue to start listening together!
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

        {/* Autoplay blocked overlay for guests/listeners */}
        {autoplayBlocked && videoId && (
          <div
            onClick={handleUserStartPlayback}
            className="absolute inset-0 z-20 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center cursor-pointer p-4 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center text-2xl shadow-lg hover:scale-105 transition-transform mb-3">
              ▶
            </div>
            <p className="text-gray-100 font-semibold text-sm">Click to start audio sync</p>
            <p className="text-gray-400 text-xs mt-1">Browser requires one click to enable video sound</p>
          </div>
        )}

        {/* API Error display */}
        {apiError && (
          <div className="absolute inset-0 bg-bg-elevated flex flex-col items-center justify-center border border-red-900 text-center px-6">
            <span className="text-4xl mb-3">⚠️</span>
            <p className="text-red-400 text-sm">
              Couldn't load the YouTube player. Check your connection and refresh.
            </p>
          </div>
        )}
      </div>

      {/* Host Seekbar */}
      {isHost && ready && videoId && duration > 0 && (
        <div className="mt-3 px-1">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.5}
            value={currentProgress}
            onChange={handleManualSeek}
            className="w-full accent-accent cursor-pointer"
            aria-label="Seek timeline"
          />
        </div>
      )}
    </div>
  );
}
