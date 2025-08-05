// docs/src/components/WatchHistory.jsx - Watch History and Continue Watching (Phase 3.2)
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlayIcon, ClockIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import PersonalizationEngine from '../utils/personalization-engine.js';

export default function WatchHistory() {
  const [personalization] = useState(() => new PersonalizationEngine());
  const [continueWatching, setContinueWatching] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  const [viewingStats, setViewingStats] = useState({});
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadWatchData();
  }, []);

  const loadWatchData = () => {
    setContinueWatching(personalization.getContinueWatching());
    setWatchHistory(personalization.getWatchHistory());
    setViewingStats(personalization.getViewingStats());
  };

  const formatWatchTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const removeFromContinueWatching = (movieId) => {
    // Mark as completed to remove from continue watching
    personalization.recordWatchEvent(movieId, 100, 100, true);
    loadWatchData();
  };

  const clearAllHistory = () => {
    if (confirm('Are you sure you want to clear all watch history? This cannot be undone.')) {
      personalization.clearAllData();
      loadWatchData();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Viewing Activity</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
            >
              <EyeIcon className="w-5 h-5" />
              <span>{showHistory ? 'Hide History' : 'Show History'}</span>
            </button>
            <button
              onClick={clearAllHistory}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition-colors"
            >
              <TrashIcon className="w-5 h-5" />
              <span>Clear All</span>
            </button>
          </div>
        </div>

        {/* Viewing Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 p-4 rounded">
            <div className="text-2xl font-bold text-red-500">
              {formatWatchTime(viewingStats.totalWatchTime / 60)}
            </div>
            <div className="text-gray-400 text-sm">Total Watch Time</div>
          </div>
          <div className="bg-gray-900 p-4 rounded">
            <div className="text-2xl font-bold text-blue-500">
              {viewingStats.totalMovies}
            </div>
            <div className="text-gray-400 text-sm">Movies Watched</div>
          </div>
          <div className="bg-gray-900 p-4 rounded">
            <div className="text-2xl font-bold text-green-500">
              {viewingStats.totalRatings}
            </div>
            <div className="text-gray-400 text-sm">Movies Rated</div>
          </div>
          <div className="bg-gray-900 p-4 rounded">
            <div className="text-2xl font-bold text-yellow-500">
              {viewingStats.avgRating}/5
            </div>
            <div className="text-gray-400 text-sm">Average Rating</div>
          </div>
        </div>

        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <ClockIcon className="w-6 h-6 mr-2 text-red-500" />
              Continue Watching
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {continueWatching.map((item) => (
                <ContinueWatchingCard
                  key={item.movieId}
                  item={item}
                  onRemove={() => removeFromContinueWatching(item.movieId)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Watch History */}
        {showHistory && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Watch History</h2>
            <div className="space-y-3">
              {watchHistory.map((item, index) => (
                <div
                  key={`${item.movieId}-${index}`}
                  className="flex items-center space-x-4 p-4 bg-gray-900 rounded hover:bg-gray-800 transition-colors"
                >
                  <div className="w-16 h-24 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={`https://via.placeholder.com/64x96/333333/ffffff?text=${item.movieId}`}
                      alt="Movie poster"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold">Movie #{item.movieId}</h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                      <span>Watched {formatDate(item.timestamp)}</span>
                      <span>•</span>
                      <span>{formatWatchTime(item.watchTime / 60)}</span>
                      <span>•</span>
                      <span>{Math.round(item.progress)}% complete</span>
                      {item.completed && (
                        <>
                          <span>•</span>
                          <span className="text-green-400">Finished</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <Link
                    to={`/watch/${item.movieId}`}
                    className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition-colors flex items-center space-x-2"
                  >
                    <PlayIcon className="w-4 h-4" />
                    <span>Watch</span>
                  </Link>
                </div>
              ))}
              
              {watchHistory.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <ClockIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No watch history yet</p>
                  <p className="text-sm">Start watching movies to see them here</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Favorite Genres/Actors */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gray-900 p-4 rounded">
            <h3 className="font-semibold mb-3">Favorite Genres</h3>
            <div className="space-y-2">
              {viewingStats.favoriteGenres?.slice(0, 5).map(({ genre, score }) => (
                <div key={genre} className="flex justify-between items-center text-sm">
                  <span>{genre}</span>
                  <span className="text-gray-400">{score}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gray-900 p-4 rounded">
            <h3 className="font-semibold mb-3">Favorite Actors</h3>
            <div className="space-y-2">
              {viewingStats.favoriteActors?.slice(0, 5).map(({ actor, score }) => (
                <div key={actor} className="flex justify-between items-center text-sm">
                  <span className="truncate">{actor}</span>
                  <span className="text-gray-400">{score}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gray-900 p-4 rounded">
            <h3 className="font-semibold mb-3">Favorite Directors</h3>
            <div className="space-y-2">
              {viewingStats.favoriteDirectors?.slice(0, 5).map(({ director, score }) => (
                <div key={director} className="flex justify-between items-center text-sm">
                  <span className="truncate">{director}</span>
                  <span className="text-gray-400">{score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Continue Watching Card Component
function ContinueWatchingCard({ item, onRemove }) {
  return (
    <div className="relative group">
      <Link to={`/watch/${item.movieId}`} className="block">
        <div className="aspect-[16/9] bg-gray-800 rounded overflow-hidden">
          <img
            src={`https://via.placeholder.com/300x169/333333/ffffff?text=${item.movieId}`}
            alt="Movie thumbnail"
            className="w-full h-full object-cover"
          />
          
          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
            <div
              className="h-full bg-red-600"
              style={{ width: `${item.progress}%` }}
            />
          </div>
          
          {/* Play Overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <PlayIcon className="w-12 h-12 text-white" />
          </div>
        </div>
        
        <div className="mt-2">
          <h3 className="font-medium text-sm truncate">Movie #{item.movieId}</h3>
          <p className="text-gray-400 text-xs">
            {Math.round(item.progress)}% watched
          </p>
        </div>
      </Link>
      
      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        className="absolute top-2 right-2 w-6 h-6 bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
      >
        <TrashIcon className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}