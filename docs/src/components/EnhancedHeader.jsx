// docs/src/components/EnhancedHeader.jsx - Netflix-style Header (Phase 3.1)
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  MagnifyingGlassIcon, 
  BellIcon, 
  ChevronDownIcon,
  UserCircleIcon 
} from '@heroicons/react/24/outline';

export default function EnhancedHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const notificationRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const navigate = useNavigate();

  // Handle scroll for header transparency
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim()) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      searchTimeoutRef.current = setTimeout(async () => {
        await performSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const performSearch = async (query) => {
    setIsSearching(true);
    try {
      // Simulate API call - replace with actual search
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock search results
      const mockResults = [
        { id: 1, title: 'The Matrix', type: 'movie', year: 1999 },
        { id: 2, title: 'Breaking Bad', type: 'tv', year: 2008 },
        { id: 3, title: 'Inception', type: 'movie', year: 2010 },
      ].filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase())
      );
      
      setSearchResults(mockResults);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearch(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const navLinks = [
    { to: '/', label: 'Home', end: true },
    { to: '/movies', label: 'Movies' },
    { to: '/tv-shows', label: 'TV Shows' },
    { to: '/my-list', label: 'My List' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled 
          ? 'bg-black/95 backdrop-blur-md py-2' 
          : 'bg-gradient-to-b from-black/80 to-transparent py-4'
      }`}
    >
      <nav className="container mx-auto flex items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center space-x-8">
          <NavLink 
            to="/" 
            className="text-red-600 text-2xl font-bold hover:text-red-500 transition-colors"
          >
            SparrowFlix
          </NavLink>

          {/* Navigation Links - Desktop */}
          <ul className="hidden md:flex items-center space-x-6">
            {navLinks.map(link => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors hover:text-gray-300 ${
                      isActive ? 'text-white' : 'text-gray-400'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative" ref={searchRef}>
            {!showSearch ? (
              <button
                onClick={() => setShowSearch(true)}
                className="p-2 text-white hover:text-gray-300 transition-colors"
                aria-label="Search"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </button>
            ) : (
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="flex items-center bg-black/80 border border-white/20 rounded-md">
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 ml-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies, TV shows..."
                    className="bg-transparent text-white placeholder-gray-400 px-3 py-2 w-64 focus:outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="p-2 text-gray-400 hover:text-white"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {(searchResults.length > 0 || isSearching) && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border border-white/20 rounded-md max-h-80 overflow-y-auto">
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-400">
                        Searching...
                      </div>
                    ) : (
                      <>
                        {searchResults.map(result => (
                          <NavLink
                            key={result.id}
                            to={`/watch/${result.id}`}
                            className="block p-3 hover:bg-white/10 transition-colors"
                            onClick={() => {
                              setShowSearch(false);
                              setSearchQuery('');
                              setSearchResults([]);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-white font-medium">
                                  {result.title}
                                </div>
                                <div className="text-gray-400 text-sm">
                                  {result.type === 'movie' ? 'Movie' : 'TV Show'} • {result.year}
                                </div>
                              </div>
                            </div>
                          </NavLink>
                        ))}
                        {searchResults.length === 0 && searchQuery && (
                          <div className="p-4 text-center text-gray-400">
                            No results found for "{searchQuery}"
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>

          {/* Notifications */}
          <div className="relative hidden md:block" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-white hover:text-gray-300 transition-colors relative"
              aria-label="Notifications"
            >
              <BellIcon className="w-5 h-5" />
              {/* Notification Badge */}
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </button>

            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-black/95 border border-white/20 rounded-md">
                <div className="p-4">
                  <h3 className="text-white font-semibold mb-3">Notifications</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded">
                      <div className="text-white text-sm">New episode available</div>
                      <div className="text-gray-400 text-xs">Breaking Bad S5E16</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded">
                      <div className="text-white text-sm">Added to your list</div>
                      <div className="text-gray-400 text-xs">The Matrix Reloaded</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded">
                      <div className="text-white text-sm">Continue watching</div>
                      <div className="text-gray-400 text-xs">Inception (45% complete)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile Menu */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 p-1 hover:bg-white/10 rounded transition-colors"
            >
              <UserCircleIcon className="w-8 h-8 text-white" />
              <ChevronDownIcon className={`w-4 h-4 text-white transition-transform hidden md:block ${
                showProfileMenu ? 'rotate-180' : ''
              }`} />
            </button>

            {showProfileMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-black/95 border border-white/20 rounded-md">
                <div className="py-2">
                  <NavLink
                    to="/profile"
                    className="block px-4 py-2 text-white hover:bg-white/10 transition-colors"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    Profile
                  </NavLink>
                  <NavLink
                    to="/account"
                    className="block px-4 py-2 text-white hover:bg-white/10 transition-colors"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    Account
                  </NavLink>
                  <NavLink
                    to="/settings"
                    className="block px-4 py-2 text-white hover:bg-white/10 transition-colors"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    Settings
                  </NavLink>
                  <hr className="border-white/20 my-2" />
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      // Handle logout
                    }}
                    className="block w-full text-left px-4 py-2 text-white hover:bg-white/10 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Menu */}
      <div className="md:hidden border-t border-white/10 mt-2">
        <div className="flex justify-around py-2">
          {navLinks.slice(0, 4).map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `px-3 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-white' : 'text-gray-400'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}