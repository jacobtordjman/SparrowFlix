// docs/src/components/EnhancedContentRow.jsx - Netflix-style Content Row (Phase 3.1)
import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, PlusIcon, HandThumbUpIcon } from '@heroicons/react/24/outline';

export default function EnhancedContentRow({ title, items = [], category = 'default' }) {
  const rowRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Check scroll position to show/hide arrows
  const checkScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const row = rowRef.current;
    if (row) {
      row.addEventListener('scroll', checkScroll);
      checkScroll(); // Initial check
      return () => row.removeEventListener('scroll', checkScroll);
    }
  }, [items]);

  const scroll = (direction) => {
    if (rowRef.current && !isScrolling) {
      setIsScrolling(true);
      const { clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.8; // Scroll 80% of visible width
      
      rowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });

      // Reset scrolling flag after animation
      setTimeout(() => setIsScrolling(false), 600);
    }
  };

  const handleMouseEnter = (item, index) => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    // Set new timeout for hover preview
    const timeout = setTimeout(() => {
      setHoveredItem({ ...item, index });
    }, 800); // 800ms delay before showing preview

    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    
    // Delay hiding the preview to allow interaction
    setTimeout(() => {
      setHoveredItem(null);
    }, 200);
  };

  // Get card size classes based on category
  const getCardClasses = () => {
    switch (category) {
      case 'trending':
        return 'w-44 sm:w-52 h-64 sm:h-72';
      case 'continue':
        return 'w-56 sm:w-64 h-36 sm:h-40';
      default:
        return 'w-40 sm:w-48 h-56 sm:h-64';
    }
  };

  if (!items.length) return null;

  return (
    <section className="mb-8 relative" aria-label={title}>
      {/* Section Title */}
      <h2 className="text-lg md:text-xl font-semibold mb-4 px-4 md:px-6 text-white">
        {title}
      </h2>

      {/* Scrollable Content Container */}
      <div className="relative group">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-black/80 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:scale-110"
            aria-label="Scroll left"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
        )}

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-black/80 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:scale-110"
            aria-label="Scroll right"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        )}

        {/* Content Row */}
        <div
          ref={rowRef}
          className="flex overflow-x-auto scrollbar-hide space-x-2 md:space-x-3 px-4 md:px-6 pb-4 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, index) => (
            <ContentCard
              key={`${item.id}-${index}`}
              item={item}
              index={index}
              cardClasses={getCardClasses()}
              category={category}
              onMouseEnter={() => handleMouseEnter(item, index)}
              onMouseLeave={handleMouseLeave}
              isHovered={hoveredItem?.index === index}
            />
          ))}
        </div>
      </div>

      {/* Hover Preview Modal */}
      {hoveredItem && (
        <HoverPreview
          item={hoveredItem}
          onClose={() => setHoveredItem(null)}
        />
      )}
    </section>
  );
}

// Individual Content Card Component
function ContentCard({ item, index, cardClasses, category, onMouseEnter, onMouseLeave, isHovered }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getImageSrc = () => {
    if (imageError) {
      return 'https://via.placeholder.com/300x450/1a1a1a/666666?text=No+Image';
    }
    
    switch (category) {
      case 'continue':
        return item.backdropPath || item.posterPath;
      default:
        return item.posterPath || item.backdropPath;
    }
  };

  return (
    <div
      className={`${cardClasses} flex-shrink-0 relative group cursor-pointer`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Link to={`/watch/${item.id}`} className="block w-full h-full">
        {/* Main Image */}
        <div className="relative w-full h-full overflow-hidden rounded-md">
          <img
            src={getImageSrc()}
            alt={item.title}
            className={`w-full h-full object-cover transition-all duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            } ${isHovered ? 'scale-110' : 'group-hover:scale-105'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />

          {/* Loading Skeleton */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse" />
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Continue Watching Progress Bar */}
          {category === 'continue' && item.watchProgress && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
              <div
                className="h-full bg-red-600"
                style={{ width: `${item.watchProgress}%` }}
              />
            </div>
          )}

          {/* Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
            <h3 className="font-semibold text-sm md:text-base line-clamp-2">
              {item.title}
            </h3>
            
            {/* Quick Action Buttons */}
            <div className="flex items-center space-x-2 mt-2">
              <button
                className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                aria-label={`Play ${item.title}`}
                onClick={(e) => {
                  e.preventDefault();
                  // Handle play action
                }}
              >
                <PlayIcon className="w-4 h-4" />
              </button>
              
              <button
                className="w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label={`Add ${item.title} to watchlist`}
                onClick={(e) => {
                  e.preventDefault();
                  // Handle add to watchlist
                }}
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quality Badge */}
          {item.quality && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 text-white text-xs font-bold rounded">
              {item.quality}
            </div>
          )}

          {/* New Badge */}
          {item.isNew && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
              NEW
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

// Hover Preview Component (simplified version)
function HoverPreview({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div 
        className="bg-gray-900 rounded-lg max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <img
            src={item.backdropPath || item.posterPath}
            alt={item.title}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
        </div>
        
        <div className="p-4">
          <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
          <p className="text-gray-300 text-sm line-clamp-3 mb-4">
            {item.overview || 'No description available.'}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to={`/watch/${item.id}`}
                className="bg-white text-black px-4 py-2 rounded font-semibold hover:bg-gray-200 transition-colors"
              >
                Play
              </Link>
              <button className="text-white hover:text-gray-300">
                <HandThumbUpIcon className="w-6 h-6" />
              </button>
            </div>
            
            {item.releaseDate && (
              <span className="text-gray-400 text-sm">
                {new Date(item.releaseDate).getFullYear()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}