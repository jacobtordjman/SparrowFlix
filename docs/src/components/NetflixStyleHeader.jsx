// docs/src/components/NetflixStyleHeader.jsx - Enhanced Netflix-Style Header

import React, { useState, useEffect, useRef } from 'react';
import './netflix-header.css';

const NetflixStyleHeader = ({ 
  user, 
  onSearch, 
  onNotificationClick,
  notifications = [],
  currentPage = 'home'
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchInputRef = useRef(null);
  const searchTimeout = useRef(null);

  // Handle scroll effect for header background
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 70;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-focus search input when search is activated
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (searchQuery.trim()) {
      setIsSearching(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          const results = await performSearch(searchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error('Search error:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery]);

  const performSearch = async (query) => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
      if (response.ok) {
        const data = await response.json();
        return data.results || [];
      }
    } catch (error) {
      console.error('Search API error:', error);
    }
    return [];
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const handleSearchResultClick = (result) => {
    if (onSearch) {
      onSearch(result.title || result.name);
    }
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleNotificationClick = (notification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    setShowNotifications(false);
  };

  const navigationItems = [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'movies', label: 'Movies', href: '/movies' },
    { id: 'series', label: 'TV Shows', href: '/series' },
    { id: 'mylist', label: 'My List', href: '/my-list' },
    { id: 'browse', label: 'Browse', href: '/browse' }
  ];

  return (
    <header className={`netflix-header ${isScrolled ? 'netflix-header--scrolled' : ''}`}>
      <div className="netflix-header__container">
        {/* Logo */}
        <div className="netflix-header__brand">
          <a href="/" className="netflix-header__logo">
            <span className="netflix-header__logo-text">SparrowFlix</span>
          </a>
        </div>

        {/* Main Navigation */}
        <nav className="netflix-header__nav">
          <ul className="netflix-header__nav-list">
            {navigationItems.map((item) => (
              <li key={item.id} className="netflix-header__nav-item">
                <a 
                  href={item.href}
                  className={`netflix-header__nav-link ${currentPage === item.id ? 'netflix-header__nav-link--active' : ''}`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Secondary Navigation */}
        <div className="netflix-header__secondary">
          {/* Search */}
          <div className={`netflix-header__search ${showSearch ? 'netflix-header__search--active' : ''}`}>
            <button
              className="netflix-header__search-toggle"
              onClick={() => setShowSearch(!showSearch)}
              aria-label="Search"
            >
              <svg className="netflix-header__search-icon" viewBox="0 0 24 24">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </button>
            
            {showSearch && (
              <div className="netflix-header__search-container">
                <form onSubmit={handleSearchSubmit} className="netflix-header__search-form">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Titles, people, genres"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="netflix-header__search-input"
                  />
                </form>
                
                {/* Search Results Dropdown */}
                {(searchResults.length > 0 || isSearching) && (
                  <div className="netflix-header__search-results">
                    {isSearching ? (
                      <div className="netflix-header__search-loading">
                        <div className="spinner"></div>
                        <span>Searching...</span>
                      </div>
                    ) : (
                      <>
                        {searchResults.map((result, index) => (
                          <div
                            key={index}
                            className="netflix-header__search-result"
                            onClick={() => handleSearchResultClick(result)}
                          >
                            <div className="netflix-header__search-result-poster">
                              <img 
                                src={result.poster || '/placeholder-poster.jpg'} 
                                alt={result.title || result.name}
                                loading="lazy"
                              />
                            </div>
                            <div className="netflix-header__search-result-info">
                              <h4>{result.title || result.name}</h4>
                              <p>{result.year} • {result.genre}</p>
                            </div>
                          </div>
                        ))}
                        <div className="netflix-header__search-result netflix-header__search-result--view-all">
                          <div className="netflix-header__search-result-info">
                            <h4>View all results for "{searchQuery}"</h4>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="netflix-header__notifications">
            <button
              className={`netflix-header__notifications-toggle ${notifications.length > 0 ? 'netflix-header__notifications-toggle--has-notifications' : ''}`}
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
            >
              <svg className="netflix-header__notifications-icon" viewBox="0 0 24 24">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
              </svg>
              {notifications.length > 0 && (
                <span className="netflix-header__notifications-badge">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="netflix-header__notifications-dropdown">
                <div className="netflix-header__notifications-header">
                  <h3>Notifications</h3>
                </div>
                <div className="netflix-header__notifications-list">
                  {notifications.length > 0 ? (
                    notifications.map((notification, index) => (
                      <div
                        key={index}
                        className={`netflix-header__notification-item ${notification.read ? '' : 'netflix-header__notification-item--unread'}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="netflix-header__notification-content">
                          <h4>{notification.title}</h4>
                          <p>{notification.message}</p>
                          <span className="netflix-header__notification-time">
                            {formatTime(notification.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="netflix-header__notifications-empty">
                      <p>No new notifications</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Menu */}
          <div className="netflix-header__profile">
            <button
              className="netflix-header__profile-toggle"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label="Account menu"
            >
              <img
                src={user?.avatar || '/default-avatar.jpg'}
                alt={user?.name || 'User'}
                className="netflix-header__profile-avatar"
              />
              <svg className="netflix-header__profile-arrow" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>

            {showProfileMenu && (
              <div className="netflix-header__profile-dropdown">
                <div className="netflix-header__profile-header">
                  <img
                    src={user?.avatar || '/default-avatar.jpg'}
                    alt={user?.name || 'User'}
                    className="netflix-header__profile-dropdown-avatar"
                  />
                  <div>
                    <h4>{user?.name || 'Guest User'}</h4>
                    <p>{user?.email || 'Not signed in'}</p>
                  </div>
                </div>
                <div className="netflix-header__profile-menu">
                  <a href="/account" className="netflix-header__profile-menu-item">
                    <span>Account Settings</span>
                  </a>
                  <a href="/watchlist" className="netflix-header__profile-menu-item">
                    <span>My Watchlist</span>
                  </a>
                  <a href="/viewing-history" className="netflix-header__profile-menu-item">
                    <span>Viewing History</span>
                  </a>
                  <div className="netflix-header__profile-menu-divider"></div>
                  <a href="/help" className="netflix-header__profile-menu-item">
                    <span>Help Center</span>
                  </a>
                  <button className="netflix-header__profile-menu-item netflix-header__profile-menu-item--logout">
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

// Helper function to format notification time
const formatTime = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInMinutes = Math.floor((now - time) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return time.toLocaleDateString();
};

export default NetflixStyleHeader;