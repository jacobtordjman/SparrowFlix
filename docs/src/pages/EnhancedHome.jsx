// docs/src/pages/EnhancedHome.jsx - Netflix-style Home Page (Phase 3.1)
import React, { useState, useEffect } from 'react';
import HeroCarousel from '../components/HeroCarousel.jsx';
import EnhancedContentRow from '../components/EnhancedContentRow.jsx';
import useContent from '../hooks/useContent.js';
import PersonalizationEngine from '../utils/personalization-engine.js';

export default function EnhancedHome() {
  const { featured, rows, movies, loading, error } = useContent();
  const [personalization] = useState(() => new PersonalizationEngine());
  const [featuredMovies, setFeaturedMovies] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [personalizedRows, setPersonalizedRows] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  // Process content data for enhanced experience
  useEffect(() => {
    if (movies && movies.length > 0) {
      // Create featured carousel items (top 5 movies)
      const topMovies = movies
        .filter(movie => movie.backdrop || movie.poster)
        .slice(0, 5)
        .map(movie => ({
          ...movie,
          backdropPath: movie.backdrop || movie.poster,
          posterPath: movie.poster || movie.backdrop,
        }));
      
      setFeaturedMovies(topMovies);

      // Get real continue watching data from personalization engine
      const continueWatchingData = personalization.getContinueWatching();
      const continueWatchingMovies = continueWatchingData.map(event => {
        const movie = movies.find(m => m.id === event.movieId) || {
          id: event.movieId,
          title: `Movie ${event.movieId}`,
          poster: `https://via.placeholder.com/300x450/333333/ffffff?text=${event.movieId}`
        };
        return {
          ...movie,
          watchProgress: event.progress,
          lastWatched: new Date(event.timestamp)
        };
      });
      
      setContinueWatching(continueWatchingMovies);

      // Get personalized recommendations
      const personalizedRecommendations = personalization.getRecommendations(movies, 20);
      setRecommendations(personalizedRecommendations);

      // Create personalized content rows with AI recommendations
      const rowsData = [];
      
      // Add continue watching if available
      if (continueWatchingMovies.length > 0) {
        rowsData.push({
          title: 'Continue Watching',
          items: continueWatchingMovies,
          category: 'continue'
        });
      }

      // Add personalized recommendations
      if (personalizedRecommendations.length > 0) {
        rowsData.push({
          title: 'Recommended for You',
          items: personalizedRecommendations.slice(0, 15),
          category: 'default'
        });
      }

      // Add other content rows
      rowsData.push(
        {
          title: 'Trending Now',
          items: movies.slice(0, 15).map(movie => ({ ...movie, isNew: Math.random() > 0.7 })),
          category: 'trending'
        },
        {
          title: 'Popular Movies',
          items: movies.slice(5, 20),
          category: 'default'
        },
        {
          title: 'Recently Added',
          items: movies.slice(0, 12).map(movie => ({ ...movie, isNew: true })),
          category: 'default'
        },
        {
          title: 'Action & Adventure',
          items: movies.slice(15, 30),
          category: 'default'
        },
        {
          title: 'Sci-Fi Movies',
          items: movies.slice(20, 35),
          category: 'default'
        }
      );

      // Add genre-specific recommendations based on user preferences
      const userStats = personalization.getViewingStats();
      if (userStats.favoriteGenres && userStats.favoriteGenres.length > 0) {
        const topGenre = userStats.favoriteGenres[0];
        rowsData.push({
          title: `More ${topGenre.genre} Movies`,
          items: personalizedRecommendations.slice(15, 30),
          category: 'default'
        });
      }

      setPersonalizedRows(rowsData);
    }
  }, [movies]);

  // Loading state with skeleton screens
  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        {/* Hero Skeleton */}
        <div className="h-[80vh] bg-gradient-to-r from-gray-800 to-gray-700 animate-pulse relative">
          <div className="absolute bottom-12 left-12 space-y-4">
            <div className="h-12 w-96 bg-gray-600 rounded animate-pulse" />
            <div className="h-6 w-80 bg-gray-600 rounded animate-pulse" />
            <div className="h-6 w-64 bg-gray-600 rounded animate-pulse" />
            <div className="flex space-x-4 mt-8">
              <div className="h-12 w-32 bg-gray-600 rounded animate-pulse" />
              <div className="h-12 w-40 bg-gray-600 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Content Rows Skeleton */}
        <div className="space-y-8 p-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-4">
              <div className="h-6 w-48 bg-gray-700 rounded animate-pulse" />
              <div className="flex space-x-4 overflow-hidden">
                {[1, 2, 3, 4, 5, 6].map(j => (
                  <div
                    key={j}
                    className="w-48 h-64 bg-gray-700 rounded animate-pulse flex-shrink-0"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-netflix"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Carousel */}
      {featuredMovies.length > 0 && (
        <HeroCarousel 
          movies={featuredMovies}
          onMovieChange={(movie) => {
            // Could trigger additional actions like preloading trailer
            console.log('Featured movie changed:', movie?.title);
          }}
        />
      )}

      {/* Content Sections */}
      <div className="relative -mt-32 z-10 pb-20">
        {personalizedRows.map((row, index) => (
          <EnhancedContentRow
            key={`${row.title}-${index}`}
            title={row.title}
            items={row.items}
            category={row.category}
          />
        ))}

        {/* Fallback for legacy rows */}
        {rows && rows.length > 0 && rows.map(({ title, items }) => (
          <EnhancedContentRow
            key={title}
            title={title}
            items={items.length ? items : movies.slice(0, 15)}
            category="default"
          />
        ))}
      </div>

      {/* Quick Actions FAB (Mobile) */}
      <div className="fixed bottom-20 right-6 md:hidden z-40">
        <button
          className="w-14 h-14 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-700 transition-colors"
          aria-label="Quick search"
          onClick={() => {
            // Trigger search modal
            document.querySelector('input[placeholder*="Search"]')?.focus();
          }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {/* Background Gradient for Better Visual Hierarchy */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black" />
      </div>
    </div>
  );
}