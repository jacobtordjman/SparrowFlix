// docs/src/components/VideoPlayer.jsx - Custom Netflix-style Video Player (Phase 3.2 + 4.2)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  Cog6ToothIcon,
  ArrowUturnLeftIcon,
  ForwardIcon,
  ChatBubbleBottomCenterTextIcon,
  SignalIcon,
  WifiIcon
} from '@heroicons/react/24/outline';
import { createAdaptiveStreaming } from '../utils/adaptive-streaming.js';

export default function VideoPlayer({ 
  src, 
  poster, 
  title, 
  subtitles = [], 
  onProgress, 
  onEnded,
  skipIntro,
  skipOutro,
  nextEpisode 
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const progressBarRef = useRef(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Advanced features
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedSubtitle, setSelectedSubtitle] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState('auto');
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);

  // Picture-in-picture support
  const [isPiP, setIsPiP] = useState(false);

  // Adaptive streaming
  const [adaptiveStreaming, setAdaptiveStreaming] = useState(null);
  const [streamingStats, setStreamingStats] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('good');
  const [showStreamingInfo, setShowStreamingInfo] = useState(false);

  // Keyboard shortcuts
  const handleKeyPress = useCallback((event) => {
    if (!videoRef.current) return;

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft':
        skipBackward();
        break;
      case 'ArrowRight':
        skipForward();
        break;
      case 'ArrowUp':
        event.preventDefault();
        adjustVolume(0.1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        adjustVolume(-0.1);
        break;
      case 'KeyM':
        toggleMute();
        break;
      case 'KeyF':
        toggleFullscreen();
        break;
      case 'KeyC':
        toggleSubtitles();
        break;
      default:
        break;
    }
  }, []);

  // Event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Check for skip opportunities
      checkSkipOpportunities(video.currentTime, video.duration);
      
      // Report progress
      if (onProgress) {
        onProgress(video.currentTime, video.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };

    const handleError = () => {
      setError('Failed to load video');
      setIsLoading(false);
    };

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [onProgress, onEnded]);

  // Keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isPlaying]);

  // Picture-in-picture events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => setIsPiP(true);
    const handleLeavePiP = () => setIsPiP(false);

    video.addEventListener('enterpictureinpicture', handleEnterPiP);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPiP);
      video.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, []);

  // Initialize adaptive streaming
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const initAdaptiveStreaming = async () => {
      try {
        const streaming = createAdaptiveStreaming(video, {
          initialQuality: quality === 'auto' ? 'auto' : quality,
          bufferLength: 30,
          qualityCheckInterval: 5000
        });

        await streaming.init();
        setAdaptiveStreaming(streaming);

        // Listen for quality changes
        video.addEventListener('qualitychange', (event) => {
          setQuality(event.detail.newQuality);
          updateStreamingStats();
        });

        // Update stats periodically
        const statsInterval = setInterval(() => {
          updateStreamingStats();
        }, 2000);

        return () => {
          clearInterval(statsInterval);
          streaming.destroy();
        };

      } catch (error) {
        console.error('Failed to initialize adaptive streaming:', error);
        setConnectionStatus('poor');
      }
    };

    const cleanup = initAdaptiveStreaming();
    return () => cleanup?.then?.(cleanupFn => cleanupFn?.());
  }, [src]);

  // Update streaming statistics
  const updateStreamingStats = useCallback(() => {
    if (adaptiveStreaming) {
      const stats = adaptiveStreaming.getStats();
      setStreamingStats(stats);
      
      // Update connection status based on stats
      if (stats.stallCount > 5) {
        setConnectionStatus('poor');
      } else if (stats.bufferLevel < 5) {
        setConnectionStatus('fair');
      } else {
        setConnectionStatus('good');
      }
    }
  }, [adaptiveStreaming]);

  // Check for skip opportunities based on timestamps
  const checkSkipOpportunities = (currentTime, duration) => {
    // Show skip intro (typically 0-90 seconds)
    if (skipIntro && currentTime >= skipIntro.start && currentTime <= skipIntro.end) {
      setShowSkipIntro(true);
    } else {
      setShowSkipIntro(false);
    }

    // Show skip outro (typically last 30 seconds)
    if (skipOutro && currentTime >= skipOutro.start && currentTime <= skipOutro.end) {
      setShowSkipOutro(true);
    } else {
      setShowSkipOutro(false);
    }

    // Show next episode (last 10 seconds)
    if (nextEpisode && currentTime >= duration - 10) {
      setShowNextEpisode(true);
    } else {
      setShowNextEpisode(false);
    }
  };

  // Player controls
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  };

  const skipBackward = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(0, video.currentTime - 10);
    }
  };

  const skipForward = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.min(video.duration, video.currentTime + 10);
    }
  };

  const adjustVolume = (delta) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.muted = false;
      video.volume = volume;
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (isPiP) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      console.error('Picture-in-picture failed:', error);
    }
  };

  const toggleSubtitles = () => {
    if (subtitles.length > 0) {
      const currentIndex = subtitles.findIndex(sub => sub.id === selectedSubtitle);
      const nextIndex = currentIndex < subtitles.length - 1 ? currentIndex + 1 : -1;
      setSelectedSubtitle(nextIndex >= 0 ? subtitles[nextIndex].id : null);
    }
  };

  const handleProgressClick = (event) => {
    const progressBar = progressBarRef.current;
    const video = videoRef.current;
    if (!progressBar || !video) return;

    const rect = progressBar.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    video.currentTime = pos * video.duration;
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p>Failed to load video</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => !showSettings && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        onClick={togglePlayPause}
        preload="metadata"
        crossOrigin="anonymous"
      >
        {/* Subtitle tracks */}
        {subtitles.map(subtitle => (
          <track
            key={subtitle.id}
            kind="subtitles"
            src={subtitle.src}
            srcLang={subtitle.lang}
            label={subtitle.label}
            default={subtitle.id === selectedSubtitle}
          />
        ))}
      </video>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Play/Pause Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <button
          onClick={togglePlayPause}
          className={`w-20 h-20 bg-black/50 rounded-full flex items-center justify-center text-white transition-opacity duration-300 pointer-events-auto ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {isPlaying ? (
            <PauseIcon className="w-10 h-10" />
          ) : (
            <PlayIcon className="w-10 h-10 ml-1" />
          )}
        </button>
      </div>

      {/* Skip Buttons */}
      {showSkipIntro && (
        <button
          onClick={() => {
            if (videoRef.current && skipIntro) {
              videoRef.current.currentTime = skipIntro.end;
            }
          }}
          className="absolute top-4 right-4 bg-white/90 text-black px-4 py-2 rounded font-semibold hover:bg-white transition-colors"
        >
          Skip Intro
        </button>
      )}

      {showSkipOutro && (
        <button
          onClick={() => {
            if (videoRef.current && skipOutro) {
              videoRef.current.currentTime = skipOutro.end;
            }
          }}
          className="absolute top-4 right-4 bg-white/90 text-black px-4 py-2 rounded font-semibold hover:bg-white transition-colors"
        >
          Skip Outro
        </button>
      )}

      {/* Next Episode */}
      {showNextEpisode && nextEpisode && (
        <div className="absolute bottom-20 right-4 bg-black/80 p-4 rounded-lg">
          <p className="text-white text-sm mb-2">Next Episode</p>
          <div className="flex items-center space-x-3">
            <img
              src={nextEpisode.thumbnail}
              alt={nextEpisode.title}
              className="w-16 h-10 object-cover rounded"
            />
            <div>
              <p className="text-white font-semibold text-sm">{nextEpisode.title}</p>
              <button
                onClick={() => nextEpisode.onPlay()}
                className="text-blue-400 text-sm hover:text-blue-300"
              >
                Play now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress Bar */}
        <div
          ref={progressBarRef}
          className="w-full h-2 bg-white/30 rounded-full cursor-pointer mb-4 group/progress"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-red-600 rounded-full relative group-hover/progress:bg-red-500 transition-colors"
            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="text-white hover:text-gray-300 transition-colors"
            >
              {isPlaying ? (
                <PauseIcon className="w-8 h-8" />
              ) : (
                <PlayIcon className="w-8 h-8" />
              )}
            </button>

            {/* Skip Controls */}
            <button
              onClick={skipBackward}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <ArrowUturnLeftIcon className="w-6 h-6" />
            </button>

            <button
              onClick={skipForward}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <ForwardIcon className="w-6 h-6" />
            </button>

            {/* Volume */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-gray-300 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <SpeakerXMarkIcon className="w-6 h-6" />
                ) : (
                  <SpeakerWaveIcon className="w-6 h-6" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const newVolume = parseFloat(e.target.value);
                  setVolume(newVolume);
                  setIsMuted(newVolume === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = newVolume;
                    videoRef.current.muted = newVolume === 0;
                  }
                }}
                className="w-20 accent-red-600"
              />
            </div>

            {/* Time Display */}
            <span className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Subtitles */}
            {subtitles.length > 0 && (
              <button
                onClick={toggleSubtitles}
                className={`text-white hover:text-gray-300 transition-colors ${
                  selectedSubtitle ? 'text-red-400' : ''
                }`}
              >
                <ChatBubbleBottomCenterTextIcon className="w-6 h-6" />
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <Cog6ToothIcon className="w-6 h-6" />
            </button>

            {/* Picture-in-Picture */}
            {document.pictureInPictureEnabled && (
              <button
                onClick={togglePictureInPicture}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <div className="w-6 h-6 border-2 border-current rounded">
                  <div className="w-2 h-2 bg-current mt-1 ml-1 rounded-sm" />
                </div>
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-gray-300 transition-colors"
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="w-6 h-6" />
              ) : (
                <ArrowsPointingOutIcon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute bottom-16 right-4 bg-black/90 rounded-lg p-4 min-w-48">
            <h3 className="text-white font-semibold mb-3">Settings</h3>
            
            {/* Playback Speed */}
            <div className="mb-3">
              <label className="text-white text-sm block mb-1">Speed</label>
              <select
                value={playbackRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  setPlaybackRate(rate);
                  if (videoRef.current) {
                    videoRef.current.playbackRate = rate;
                  }
                }}
                className="bg-gray-700 text-white rounded px-2 py-1 text-sm w-full"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>Normal</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>

            {/* Quality */}
            <div className="mb-3">
              <label className="text-white text-sm block mb-1">Quality</label>
              <select
                value={quality}
                onChange={(e) => {
                  const newQuality = e.target.value;
                  setQuality(newQuality);
                  if (adaptiveStreaming) {
                    adaptiveStreaming.setQuality(newQuality);
                  }
                }}
                className="bg-gray-700 text-white rounded px-2 py-1 text-sm w-full"
              >
                <option value="auto">Auto (Adaptive)</option>
                <option value="1080p">1080p HD</option>
                <option value="720p">720p HD</option>
                <option value="360p">360p</option>
              </select>
            </div>

            {/* Streaming Info */}
            {streamingStats.currentQuality && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white text-sm">Connection</label>
                  <button
                    onClick={() => setShowStreamingInfo(!showStreamingInfo)}
                    className="text-blue-400 text-xs hover:text-blue-300"
                  >
                    {showStreamingInfo ? 'Hide' : 'Show'} Details
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  {connectionStatus === 'good' ? (
                    <SignalIcon className="w-4 h-4 text-green-400" />
                  ) : connectionStatus === 'fair' ? (
                    <WifiIcon className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <SignalIcon className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-white text-sm capitalize">
                    {streamingStats.currentQuality} • {connectionStatus}
                  </span>
                </div>
                
                {showStreamingInfo && (
                  <div className="mt-2 space-y-1 text-xs text-gray-300">
                    <div>Buffer: {Math.round(streamingStats.bufferLevel || 0)}s</div>
                    <div>Bandwidth: {Math.round((streamingStats.averageBandwidth || 0) / 1000000)}Mbps</div>
                    <div>Stalls: {streamingStats.stallCount || 0}</div>
                    {streamingStats.qualityLocked && (
                      <div className="text-yellow-400">Quality Locked</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Subtitles */}
            {subtitles.length > 0 && (
              <div>
                <label className="text-white text-sm block mb-1">Subtitles</label>
                <select
                  value={selectedSubtitle || ''}
                  onChange={(e) => setSelectedSubtitle(e.target.value || null)}
                  className="bg-gray-700 text-white rounded px-2 py-1 text-sm w-full"
                >
                  <option value="">Off</option>
                  {subtitles.map(subtitle => (
                    <option key={subtitle.id} value={subtitle.id}>
                      {subtitle.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}