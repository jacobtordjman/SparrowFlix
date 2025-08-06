// docs/src/components/NetflixHomepage.jsx - Enhanced Netflix-Style Homepage

import React, { useState, useEffect, useRef } from 'react';
import NetflixStyleHeader from './NetflixStyleHeader';
import HeroCarousel from './HeroCarousel';
import EnhancedContentRow from './EnhancedContentRow';
import './netflix-homepage.css';

const NetflixHomepage = ({ user }) => {
  const [content, setContent] = useState({ movies: [], shows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [heroContent, setHeroContent] = useState([]);
  const [contentRows, setContentRows] = useState([]);
  const [viewingHistory, setViewingHistory] = useState([]);
  
  const retryTimeoutRef = useRef(null);

  useEffect(() => {
    fetchContent();
    fetchNotifications();
    fetchViewingHistory();
  }, []);

  useEffect(() => {
    if (content.movies.length > 0 || content.shows.length > 0) {
      setupContentRows();
      setupHeroContent();
    }
  }, [content, viewingHistory]);

  const fetchContent = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if we're on GitHub Pages (no API available)
      const isGitHubPages = window.location.hostname.includes('github.io');
      
      if (isGitHubPages) {
        // Use mock data for GitHub Pages demo
        const mockData = {
          movies: [
            {
              id: 'movie1',
              title: 'Demo Movie',
              year: 2024,
              genre: 'Action',
              overview: 'This is a demo movie for SparrowFlix',
              poster: 'https://via.placeholder.com/300x450/333/fff?text=Demo+Movie',
              backdrop: 'https://via.placeholder.com/1920x1080/333/fff?text=Demo+Backdrop',
              rating: 8.5,
              file_id: 'demo_file'
            }
          ],
          shows: [
            {
              id: 'show1',
              title: 'Demo TV Show',
              year: 2024,
              genre: 'Drama',
              overview: 'This is a demo TV show for SparrowFlix',
              poster: 'https://via.placeholder.com/300x450/333/fff?text=Demo+Show',
              backdrop: 'https://via.placeholder.com/1920x1080/333/fff?text=Demo+Show',
              seasons: 2,
              episodes: [
                { id: 'ep1', season: 1, episode: 1, title: 'Pilot', file_id: 'demo_ep' }
              ]
            }
          ]
        };
        setContent(mockData);
        return;
      }
      
      const response = await fetch('/api/content');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setContent(data);
      
    } catch (error) {
      console.error('Failed to fetch content:', error);
      
      // Retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setError(`Connection error. Retrying in ${delay/1000} seconds...`);
        
        retryTimeoutRef.current = setTimeout(() => {
          fetchContent(retryCount + 1);
        }, delay);
      } else {
        setError(`Failed to load content: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      // Simulate notifications - replace with actual API call
      const mockNotifications = [
        {
          id: 1,
          title: 'New Episodes Available',
          message: 'Season 2 of your favorite show is now streaming',
          timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
          read: false
        },
        {
          id: 2,
          title: 'Recommended for You',
          message: 'Check out these new movies based on your viewing history',
          timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
          read: true
        }
      ];
      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const fetchViewingHistory = async () => {
    try {
      // Get from localStorage for now - replace with API call
      const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');
      setViewingHistory(history);
    } catch (error) {
      console.error('Failed to fetch viewing history:', error);
    }
  };

  const setupHeroContent = () => {
    const allContent = [...content.movies, ...content.shows];
    
    // Select featured content for hero carousel
    const featured = allContent
      .filter(item => item.backdrop || item.poster)
      .sort((a, b) => {
        // Prioritize high-rated content
        const ratingA = a.rating || a.vote_average || 0;
        const ratingB = b.rating || b.vote_average || 0;
        return ratingB - ratingA;
      })
      .slice(0, 5);
    
    setHeroContent(featured);
  };

  const setupContentRows = () => {
    const rows = [];
    
    // Continue Watching (based on viewing history)
    const continueWatching = viewingHistory
      .filter(item => item.progress > 0 && item.progress < 95)
      .slice(0, 20);
    
    if (continueWatching.length > 0) {
      rows.push({
        id: 'continue-watching',
        title: 'Continue Watching',
        items: continueWatching,
        type: 'continue'
      });
    }

    // Popular Movies
    const popularMovies = content.movies
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20);
    
    if (popularMovies.length > 0) {
      rows.push({
        id: 'popular-movies',
        title: 'Popular Movies',
        items: popularMovies,
        type: 'movie'
      });
    }

    // Trending TV Shows
    const trendingShows = content.shows
      .filter(show => show.episodes && show.episodes.length > 0)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 20);
    
    if (trendingShows.length > 0) {
      rows.push({
        id: 'trending-shows',
        title: 'Trending TV Shows',
        items: trendingShows,
        type: 'show'
      });
    }

    // Genre-based rows
    const genres = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror', 'Romance'];
    
    genres.forEach(genre => {
      const genreContent = [...content.movies, ...content.shows]
        .filter(item => 
          item.genre && 
          item.genre.toLowerCase().includes(genre.toLowerCase())
        )
        .slice(0, 20);
      
      if (genreContent.length > 0) {
        rows.push({
          id: `genre-${genre.toLowerCase()}`,
          title: `${genre} Movies & Shows`,
          items: genreContent,
          type: 'mixed'
        });
      }
    });

    // Recently Added
    const recentlyAdded = [...content.movies, ...content.shows]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 20);
    
    if (recentlyAdded.length > 0) {
      rows.push({
        id: 'recently-added',
        title: 'Recently Added',
        items: recentlyAdded,
        type: 'mixed'
      });
    }

    // My List (if user has favorites)
    const myList = JSON.parse(localStorage.getItem('myList') || '[]');
    if (myList.length > 0) {
      const myListContent = [...content.movies, ...content.shows]
        .filter(item => myList.includes(item.id));
      
      if (myListContent.length > 0) {
        rows.unshift({
          id: 'my-list',
          title: 'My List',
          items: myListContent,
          type: 'mixed'
        });
      }
    }

    setContentRows(rows);
  };

  const handleSearch = (query) => {
    // Navigate to search page or show search results
    window.location.href = `/search?q=${encodeURIComponent(query)}`;
  };

  const handleNotificationClick = (notification) => {
    console.log('Notification clicked:', notification);
    // Mark as read and handle notification action
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      )
    );
  };

  const handleContentClick = (item, rowType) => {
    // Track viewing and navigate to content
    const viewingData = {
      id: item.id,
      title: item.title || item.name,
      type: item.type || (item.episodes ? 'show' : 'movie'),
      poster: item.poster,
      timestamp: Date.now(),
      progress: 0
    };
    
    // Update viewing history
    const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');
    const existingIndex = history.findIndex(h => h.id === item.id);
    
    if (existingIndex >= 0) {
      history[existingIndex] = { ...history[existingIndex], timestamp: Date.now() };
    } else {
      history.unshift(viewingData);
    }
    
    // Keep only last 50 items
    localStorage.setItem('viewingHistory', JSON.stringify(history.slice(0, 50)));
    
    // Navigate to content page
    const contentType = item.type || (item.episodes ? 'show' : 'movie');
    window.location.href = `/watch/${contentType}/${item.id}`;
  };

  const addToMyList = (item) => {
    const myList = JSON.parse(localStorage.getItem('myList') || '[]');
    if (!myList.includes(item.id)) {
      myList.push(item.id);
      localStorage.setItem('myList', JSON.stringify(myList));
      setupContentRows(); // Refresh to show updated My List
    }
  };

  const removeFromMyList = (item) => {
    const myList = JSON.parse(localStorage.getItem('myList') || '[]');
    const filtered = myList.filter(id => id !== item.id);
    localStorage.setItem('myList', JSON.stringify(filtered));
    setupContentRows(); // Refresh to show updated My List
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="netflix-homepage">
        <NetflixStyleHeader 
          user={user}
          onSearch={handleSearch}
          onNotificationClick={handleNotificationClick}
          notifications={notifications}
          currentPage="home"
        />
        <div className="netflix-homepage__loading">
          <div className="netflix-loading-spinner">
            <div className="netflix-loading-spinner__circle"></div>
          </div>
          <p>Loading your entertainment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="netflix-homepage">
        <NetflixStyleHeader 
          user={user}
          onSearch={handleSearch}
          onNotificationClick={handleNotificationClick}
          notifications={notifications}
          currentPage="home"
        />
        <div className="netflix-homepage__error">
          <div className="netflix-error-content">
            <h2>Oops! Something went wrong</h2>
            <p>{error}</p>
            <button 
              onClick={() => fetchContent(0)}
              className="netflix-retry-button"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="netflix-homepage">
      <NetflixStyleHeader 
        user={user}
        onSearch={handleSearch}
        onNotificationClick={handleNotificationClick}
        notifications={notifications}
        currentPage="home"
      />
      
      <main className="netflix-homepage__main">
        {/* Hero Section */}
        {heroContent.length > 0 && (
          <section className="netflix-homepage__hero">
            <HeroCarousel 
              items={heroContent}
              onItemClick={handleContentClick}
              onAddToList={addToMyList}
              onRemoveFromList={removeFromMyList}
            />
          </section>
        )}
        
        {/* Content Rows */}
        <section className="netflix-homepage__content">
          {contentRows.map((row, index) => (
            <div key={row.id} className="netflix-homepage__content-row">
              <EnhancedContentRow
                title={row.title}
                items={row.items}
                contentType={row.type}
                onItemClick={handleContentClick}
                onAddToList={addToMyList}
                onRemoveFromList={removeFromMyList}
                priority={index < 3 ? 'high' : 'low'} // Prioritize first 3 rows
              />
            </div>
          ))}
        </section>
        
        {/* Empty State */}
        {contentRows.length === 0 && (
          <section className="netflix-homepage__empty">
            <div className="netflix-empty-content">
              <h2>Welcome to SparrowFlix!</h2>
              <p>Discover amazing movies and TV shows. Content is being loaded...</p>
            </div>
          </section>
        )}
      </main>
      
      {/* Footer */}
      <footer className="netflix-homepage__footer">
        <div className="netflix-footer-content">
          <div className="netflix-footer-links">
            <a href="/help">Help Center</a>
            <a href="/terms">Terms of Use</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/about">About SparrowFlix</a>
          </div>
          <p className="netflix-footer-copyright">
            © 2024 SparrowFlix. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default NetflixHomepage;