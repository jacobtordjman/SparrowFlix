// docs/src/components/HeroCarousel.jsx - Netflix-inspired Hero Carousel (Phase 3.1)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { SoundOnIcon, SoundOffIcon } from './icons/SoundIcons';

export default function HeroCarousel({ movies = [], onMovieChange }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const intervalRef = useRef(null);
  const videoRef = useRef(null);

  const currentMovie = movies[currentIndex];

  // Auto-advance carousel
  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (isPlaying) {
        setCurrentIndex(prev => (prev + 1) % movies.length);
      }
    }, 8000); // 8 seconds per slide
  }, [movies.length, isPlaying]);

  useEffect(() => {
    if (movies.length > 1) {
      startInterval();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startInterval, movies.length]);

  // Reset image loaded state when movie changes
  useEffect(() => {
    setImageLoaded(false);
    if (onMovieChange) {
      onMovieChange(currentMovie);
    }
  }, [currentIndex, currentMovie, onMovieChange]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setIsPlaying(false);
    setTimeout(() => setIsPlaying(true), 2000); // Resume after 2s
  };

  const nextSlide = () => {
    setCurrentIndex(prev => (prev + 1) % movies.length);
  };

  const prevSlide = () => {
    setCurrentIndex(prev => (prev - 1 + movies.length) % movies.length);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const pauseCarousel = () => {
    setIsPlaying(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const resumeCarousel = () => {
    setIsPlaying(true);
    startInterval();
  };

  if (!currentMovie) return null;

  return (
    <section 
      className="relative h-[60vh] md:h-[80vh] overflow-hidden"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onFocus={() => setShowControls(true)}
      onBlur={() => setShowControls(false)}
    >
      {/* Background Image with Parallax Effect */}
      <div className="absolute inset-0 scale-110 transition-transform duration-[8000ms] ease-linear">
        <img
          src={currentMovie.backdropPath || currentMovie.posterPath}
          alt={currentMovie.title}
          className={`w-full h-full object-cover transition-opacity duration-1000 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/1920x1080/1a1a1a/666666?text=SparrowFlix';
          }}
        />
      </div>

      {/* Video Trailer (if available) */}
      {currentMovie.trailerUrl && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted={isMuted}
          loop
          playsInline
          onLoadedData={() => setImageLoaded(true)}
        >
          <source src={currentMovie.trailerUrl} type="video/mp4" />
        </video>
      )}

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />

      {/* Navigation Arrows */}
      {movies.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            onMouseEnter={pauseCarousel}
            onMouseLeave={resumeCarousel}
            className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all duration-300 z-10 ${
              showControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}
            aria-label="Previous movie"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          
          <button
            onClick={nextSlide}
            onMouseEnter={pauseCarousel}
            onMouseLeave={resumeCarousel}
            className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all duration-300 z-10 ${
              showControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
            }`}
            aria-label="Next movie"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Content Information */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 space-y-4 md:space-y-6">
        <div className="max-w-2xl">
          {/* Movie Title */}
          <h1 className="text-3xl md:text-6xl font-bold text-white mb-4 animate-fadeInUp">
            {currentMovie.title}
          </h1>

          {/* Movie Overview */}
          <p className="text-sm md:text-lg text-gray-200 line-clamp-3 mb-6 animate-fadeInUp animation-delay-200">
            {currentMovie.overview || 'Experience premium streaming with SparrowFlix.'}
          </p>

          {/* Movie Meta Info */}
          <div className="flex items-center space-x-4 text-sm text-gray-300 mb-6 animate-fadeInUp animation-delay-300">
            {currentMovie.releaseDate && (
              <span>{new Date(currentMovie.releaseDate).getFullYear()}</span>
            )}
            {currentMovie.runtime && <span>{currentMovie.runtime} min</span>}
            {currentMovie.genres && currentMovie.genres.length > 0 && (
              <span>{currentMovie.genres.slice(0, 2).map(g => g.name).join(', ')}</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 animate-fadeInUp animation-delay-400">
            <Link
              to={`/watch/${currentMovie.id}`}
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-black font-semibold rounded-md hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
            >
              <PlayIcon className="w-5 h-5 mr-2" />
              Play
            </Link>
            
            <Link
              to={`/movie/${currentMovie.id}`}
              className="inline-flex items-center justify-center px-8 py-3 bg-gray-600/80 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <InformationCircleIcon className="w-5 h-5 mr-2" />
              More Info
            </Link>
          </div>
        </div>

        {/* Audio Control */}
        {currentMovie.trailerUrl && (
          <button
            onClick={toggleMute}
            className={`absolute bottom-6 right-6 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all duration-300 ${
              showControls ? 'opacity-100' : 'opacity-60'
            }`}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <SoundOffIcon className="w-5 h-5" />
            ) : (
              <SoundOnIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Slide Indicators */}
      {movies.length > 1 && (
        <div className="absolute bottom-6 right-1/2 translate-x-1/2 flex space-x-2">
          {movies.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              onMouseEnter={pauseCarousel}
              onMouseLeave={resumeCarousel}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-white scale-125' 
                  : 'bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {isPlaying && movies.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div 
            className="h-full bg-red-600 transition-all duration-100 ease-linear animate-progress"
            style={{ animationDuration: '8000ms' }}
          />
        </div>
      )}
    </section>
  );
}

// Custom CSS animations would be added to index.css