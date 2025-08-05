// docs/src/utils/personalization-engine.js - Client-side Personalization Engine (Phase 3.2)

/**
 * Client-side personalization engine for SparrowFlix
 * Implements collaborative filtering and content-based recommendations
 * All data stored locally for privacy and GDPR compliance
 */

class PersonalizationEngine {
  constructor() {
    this.storage = new PersonalizationStorage();
    this.userProfile = this.storage.getUserProfile();
    this.watchHistory = this.storage.getWatchHistory();
    this.ratings = this.storage.getRatings();
    this.preferences = this.storage.getPreferences();
  }

  // Update user watch history
  recordWatchEvent(movieId, watchTime, totalTime, completed = false) {
    const watchEvent = {
      movieId,
      watchTime,
      totalTime,
      progress: (watchTime / totalTime) * 100,
      completed,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };

    this.watchHistory = this.storage.addWatchEvent(watchEvent);
    this.updateUserProfile(movieId, watchEvent);
    
    return watchEvent;
  }

  // Record user rating
  recordRating(movieId, rating, movie) {
    const ratingEvent = {
      movieId,
      rating,
      movie,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };

    this.ratings = this.storage.addRating(ratingEvent);
    this.updateUserProfile(movieId, { rating });
    
    return ratingEvent;
  }

  // Update user preferences based on viewing behavior
  updateUserProfile(movieId, event) {
    const movie = this.storage.getMovieDetails(movieId);
    if (!movie) return;

    // Extract genres, actors, directors
    const genres = movie.genres || [];
    const actors = movie.cast?.slice(0, 5) || [];
    const directors = movie.crew?.filter(c => c.job === 'Director') || [];

    // Update genre preferences
    if (event.completed || event.progress > 70) {
      genres.forEach(genre => {
        this.userProfile.genrePreferences[genre] = 
          (this.userProfile.genrePreferences[genre] || 0) + 1;
      });
    }

    // Update actor preferences
    actors.forEach(actor => {
      this.userProfile.actorPreferences[actor.name] = 
        (this.userProfile.actorPreferences[actor.name] || 0) + 
        (event.rating ? event.rating / 5 : 0.5);
    });

    // Update director preferences  
    directors.forEach(director => {
      this.userProfile.directorPreferences[director.name] = 
        (this.userProfile.directorPreferences[director.name] || 0) + 
        (event.rating ? event.rating / 5 : 0.5);
    });

    // Update year preferences
    if (movie.year) {
      const decade = Math.floor(movie.year / 10) * 10;
      this.userProfile.yearPreferences[decade] = 
        (this.userProfile.yearPreferences[decade] || 0) + 0.5;
    }

    this.storage.saveUserProfile(this.userProfile);
  }

  // Get personalized recommendations
  getRecommendations(movies, limit = 20) {
    const scored = movies.map(movie => ({
      ...movie,
      score: this.calculateRecommendationScore(movie)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Calculate recommendation score for a movie
  calculateRecommendationScore(movie) {
    let score = 0;
    
    // Genre matching (40% weight)
    const movieGenres = movie.genres || [];
    movieGenres.forEach(genre => {
      const preference = this.userProfile.genrePreferences[genre] || 0;
      score += preference * 0.4;
    });

    // Actor matching (25% weight)
    const movieActors = movie.cast?.slice(0, 5) || [];
    movieActors.forEach(actor => {
      const preference = this.userProfile.actorPreferences[actor.name] || 0;
      score += preference * 0.25;
    });

    // Director matching (20% weight)
    const movieDirectors = movie.crew?.filter(c => c.job === 'Director') || [];
    movieDirectors.forEach(director => {
      const preference = this.userProfile.directorPreferences[director.name] || 0;
      score += preference * 0.2;
    });

    // Year matching (10% weight)
    if (movie.year) {
      const decade = Math.floor(movie.year / 10) * 10;
      const preference = this.userProfile.yearPreferences[decade] || 0;
      score += preference * 0.1;
    }

    // Popularity boost (5% weight)
    const popularity = movie.popularity || movie.voteAverage || 0;
    score += (popularity / 10) * 0.05;

    // Penalize already watched movies
    const alreadyWatched = this.watchHistory.find(w => w.movieId === movie.id);
    if (alreadyWatched) {
      score *= 0.3; // Reduce score by 70%
    }

    return score;
  }

  // Get continue watching list
  getContinueWatching() {
    return this.watchHistory
      .filter(event => !event.completed && event.progress > 5 && event.progress < 95)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }

  // Get watch history
  getWatchHistory(limit = 50) {
    return this.watchHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Get user ratings
  getUserRatings() {
    return this.ratings.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Get viewing statistics
  getViewingStats() {
    const totalWatchTime = this.watchHistory.reduce((total, event) => 
      total + event.watchTime, 0);
    
    const totalMovies = new Set(this.watchHistory.map(e => e.movieId)).size;
    
    const avgRating = this.ratings.length > 0 
      ? this.ratings.reduce((sum, r) => sum + r.rating, 0) / this.ratings.length
      : 0;

    return {
      totalWatchTime,
      totalMovies,
      totalRatings: this.ratings.length,
      avgRating: Math.round(avgRating * 10) / 10,
      favoriteGenres: this.getFavoriteGenres(),
      favoriteActors: this.getFavoriteActors(),
      favoriteDirectors: this.getFavoriteDirectors()
    };
  }

  getFavoriteGenres(limit = 5) {
    return Object.entries(this.userProfile.genrePreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([genre, score]) => ({ genre, score }));
  }

  getFavoriteActors(limit = 5) {
    return Object.entries(this.userProfile.actorPreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([actor, score]) => ({ actor, score: Math.round(score * 10) / 10 }));
  }

  getFavoriteDirectors(limit = 5) {
    return Object.entries(this.userProfile.directorPreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([director, score]) => ({ director, score: Math.round(score * 10) / 10 }));
  }

  // Clear all data (for privacy/GDPR compliance)
  clearAllData() {
    this.storage.clearAll();
    this.userProfile = this.storage.getUserProfile();
    this.watchHistory = [];
    this.ratings = [];
    this.preferences = {};
  }
}

// Local storage management
class PersonalizationStorage {
  constructor() {
    this.keys = {
      userProfile: 'sparrowflix_user_profile',
      watchHistory: 'sparrowflix_watch_history',
      ratings: 'sparrowflix_ratings',
      preferences: 'sparrowflix_preferences',
      movieCache: 'sparrowflix_movie_cache'
    };
  }

  getUserProfile() {
    const stored = localStorage.getItem(this.keys.userProfile);
    return stored ? JSON.parse(stored) : {
      genrePreferences: {},
      actorPreferences: {},
      directorPreferences: {},
      yearPreferences: {},
      lastUpdated: Date.now()
    };
  }

  saveUserProfile(profile) {
    profile.lastUpdated = Date.now();
    localStorage.setItem(this.keys.userProfile, JSON.stringify(profile));
  }

  getWatchHistory() {
    const stored = localStorage.getItem(this.keys.watchHistory);
    return stored ? JSON.parse(stored) : [];
  }

  addWatchEvent(event) {
    const history = this.getWatchHistory();
    
    // Update existing event or add new one
    const existingIndex = history.findIndex(h => 
      h.movieId === event.movieId && 
      Math.abs(h.timestamp - event.timestamp) < 60000 // Within 1 minute
    );

    if (existingIndex >= 0) {
      history[existingIndex] = event;
    } else {
      history.push(event);
    }

    // Keep only last 1000 events
    const trimmed = history.slice(-1000);
    localStorage.setItem(this.keys.watchHistory, JSON.stringify(trimmed));
    return trimmed;
  }

  getRatings() {
    const stored = localStorage.getItem(this.keys.ratings);
    return stored ? JSON.parse(stored) : [];
  }

  addRating(rating) {
    const ratings = this.getRatings();
    
    // Update existing rating or add new one
    const existingIndex = ratings.findIndex(r => r.movieId === rating.movieId);
    if (existingIndex >= 0) {
      ratings[existingIndex] = rating;
    } else {
      ratings.push(rating);
    }

    localStorage.setItem(this.keys.ratings, JSON.stringify(ratings));
    return ratings;
  }

  getPreferences() {
    const stored = localStorage.getItem(this.keys.preferences);
    return stored ? JSON.parse(stored) : {};
  }

  savePreferences(preferences) {
    localStorage.setItem(this.keys.preferences, JSON.stringify(preferences));
  }

  // Cache movie details for faster recommendations
  cacheMovieDetails(movieId, details) {
    const cache = this.getMovieCache();
    cache[movieId] = { ...details, cachedAt: Date.now() };
    
    // Keep cache under 5MB (rough estimate)
    const cacheKeys = Object.keys(cache);
    if (cacheKeys.length > 500) {
      // Remove oldest entries
      const sorted = cacheKeys
        .map(key => ({ key, cachedAt: cache[key].cachedAt }))
        .sort((a, b) => a.cachedAt - b.cachedAt);
      
      sorted.slice(0, 100).forEach(({ key }) => delete cache[key]);
    }

    localStorage.setItem(this.keys.movieCache, JSON.stringify(cache));
  }

  getMovieDetails(movieId) {
    const cache = this.getMovieCache();
    return cache[movieId];
  }

  getMovieCache() {
    const stored = localStorage.getItem(this.keys.movieCache);
    return stored ? JSON.parse(stored) : {};
  }

  clearAll() {
    Object.values(this.keys).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

export default PersonalizationEngine;
export { PersonalizationStorage };