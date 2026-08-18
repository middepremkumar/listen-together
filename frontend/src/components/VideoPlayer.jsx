import React, { useEffect, useRef, useState } from 'react';

let apiPromise = null;

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
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
      document.head.appendChild(tag);
    }
  });

  return apiPromise;
}

const DRIFT_THRESHOLD_SECONDS = 1.5;

export default function VideoPlayer({
  videoId,
  isPlaying,
  isHost,
  syncSignal, // increments whenever server sends an authoritative update the player should snap to
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
  const suppressEventsUntil = useRef(0);
  const lastLoadedVideoId = useRef(null);

  // Initialize player once
  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        playerRef.current = new YT.Player(containerRef.current, {
          height: '100%',
          width: '100%',
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: () => setReady(true),
            onStateChange: handleStateChange,
            onError: () => setApiError(true)
          }
        });
      })
      .catch(() => setApiError(true));

    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStateChange(event) {
    const YT = window.YT;
    if (!YT || Date.now() < suppressEventsUntil.current) return;
    if (!isHost) return; // only host actions drive room state

    if (event.data === YT.PlayerState.PLAYING) {
      onPlay?.(playerRef.current.getCurrentTime());
    } else if (event.data === YT.PlayerState.PAUSED) {
      onPause?.(playerRef.current.getCurrentTime());
    } else if (event.data === YT.PlayerState.ENDED) {
      onEnded?.();
    }
  }

  function suppress(ms = 800) {
    suppressEventsUntil.current = Date.now() + ms;
  }

  // Load / swap video
  useEffect(() => {
    if (!ready || !playerRef.current || !videoId) return;
    if (lastLoadedVideoId.current === videoId) return;
    lastLoadedVideoId.current = videoId;
    suppress(1500);
    playerRef.current.loadVideoById(videoId);
    if (!isPlaying) {
      setTimeout(() => playerRef.current?.pauseVideo?.(), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, ready]);

  // React to authoritative sync signals (play/pause/seek/change from host or corrections)
  useEffect(() => {
    if (!ready || !playerRef.current || !videoId) return;
    const player = playerRef.current;

    suppress(800);

    try {
      const currentTime = player.getCurrentTime?.() ?? 0;
      if (typeof syncPosition === 'number' && Math.abs(currentTime - syncPosition) > DRIFT_THRESHOLD_SECONDS) {
        player.seekTo(syncPosition, true);
      }
      if (isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    } catch {
      // player may not be fully ready yet - ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncSignal, ready]);

  // Host periodically reports position for drift-correction on other clients,
  // and detects manual seeks (jumps beyond normal playback progression) to
  // broadcast those immediately for snappier sync.
  const lastKnown = useRef({ position: 0, time: Date.now() });

  useEffect(() => {
    if (!isHost || !ready) return;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;

      const currentPosition = player.getCurrentTime();
      const now = Date.now();
      const expected = lastKnown.current.position + (now - lastKnown.current.time) / 1000;

      if (Math.abs(currentPosition - expected) > 2) {
        onSeek?.(currentPosition);
      } else {
        onHeartbeat?.(currentPosition, isPlaying);
      }

      lastKnown.current = { position: currentPosition, time: now };
    }, 3000);
    return () => clearInterval(interval);
  }, [isHost, ready, isPlaying, onHeartbeat, onSeek]);

  if (!videoId) {
    return (
      <div className="aspect-video w-full bg-bg-elevated rounded-2xl flex flex-col items-center justify-center border border-bg-border text-center px-6">
        <span className="text-4xl mb-3">📺</span>
        <p className="text-gray-400 text-sm">
          No video playing yet. Add a YouTube link to the queue to get started.
        </p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="aspect-video w-full bg-bg-elevated rounded-2xl flex flex-col items-center justify-center border border-red-900 text-center px-6">
        <span className="text-4xl mb-3">⚠️</span>
        <p className="text-red-400 text-sm">
          Couldn't load the YouTube player. Check your connection and refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden border border-bg-border relative">
        <div ref={containerRef} className="w-full h-full" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated">
            <span className="text-gray-500 text-sm animate-pulse">Loading player…</span>
          </div>
        )}
      </div>
      {isHost && ready && (
        <input
          type="range"
          min={0}
          max={playerRef.current?.getDuration?.() || 0}
          onChange={handleManualSeek}
          className="w-full mt-3 accent-accent"
          aria-label="Seek"
        />
      )}
    </div>
  );
}
