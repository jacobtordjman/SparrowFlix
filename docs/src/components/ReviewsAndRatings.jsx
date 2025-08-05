// docs/src/components/ReviewsAndRatings.jsx - Reviews and Ratings System (Phase 3.2)
import React, { useState, useEffect } from 'react';
import { 
  StarIcon, 
  HandThumbUpIcon, 
  HandThumbDownIcon, 
  FlagIcon,
  ChatBubbleLeftIcon,
  UserCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import PersonalizationEngine from '../utils/personalization-engine.js';

export default function ReviewsAndRatings({ movieId, movieTitle }) {
  const [personalization] = useState(() => new PersonalizationEngine());
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const [filterBy, setFilterBy] = useState('all');
  const [averageRating, setAverageRating] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState({});
  const [expandedReviews, setExpandedReviews] = useState(new Set());

  useEffect(() => {
    loadReviews();
    loadUserRating();
  }, [movieId]);

  const loadUserRating = () => {
    const userRatings = personalization.getUserRatings();
    const existingRating = userRatings.find(r => r.movieId === movieId);
    if (existingRating) {
      setUserRating(existingRating.rating);
    }
  };

  const loadReviews = () => {
    // Mock reviews data - replace with API call
    const mockReviews = [
      {
        id: 1,
        userId: 'user1',
        userName: 'MovieBuff2023',
        rating: 5,
        review: 'Absolutely incredible! The cinematography was breathtaking and the story kept me on the edge of my seat. One of the best films I\'ve seen this year.',
        timestamp: Date.now() - 86400000, // 1 day ago
        likes: 24,
        dislikes: 2,
        verified: true,
        spoiler: false,
        helpful: true
      },
      {
        id: 2,
        userId: 'user2',
        userName: 'CinemaLover',
        rating: 4,
        review: 'Great movie overall. The acting was superb and the plot was engaging. A few pacing issues in the middle but the ending made up for it.',
        timestamp: Date.now() - 172800000, // 2 days ago
        likes: 18,
        dislikes: 1,
        verified: false,
        spoiler: false,
        helpful: true
      },
      {
        id: 3,
        userId: 'user3',
        userName: 'FilmCritic',
        rating: 3,
        review: 'Decent watch but didn\'t live up to the hype. The special effects were good but the story felt predictable. Worth watching once but not memorable.',
        timestamp: Date.now() - 259200000, // 3 days ago
        likes: 12,
        dislikes: 8,
        verified: true,
        spoiler: false,
        helpful: false
      },
      {
        id: 4,
        userId: 'user4',
        userName: 'ActionFan',
        rating: 5,
        review: 'Mind-blowing action sequences! The fight choreography and stunts were absolutely perfect. SPOILER ALERT: The plot twist at the end completely changed everything!',
        timestamp: Date.now() - 345600000, // 4 days ago
        likes: 31,
        dislikes: 3,
        verified: false,
        spoiler: true,
        helpful: true
      }
    ];

    // Calculate average rating and distribution
    const ratings = mockReviews.map(r => r.rating);
    const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    setAverageRating(Math.round(avg * 10) / 10);

    const distribution = {};
    for (let i = 1; i <= 5; i++) {
      distribution[i] = ratings.filter(r => r === i).length;
    }
    setRatingDistribution(distribution);

    setReviews(mockReviews);
  };

  const submitRating = (rating) => {
    setUserRating(rating);
    personalization.recordRating(movieId, rating, { title: movieTitle });
    
    if (rating >= 4) {
      setShowReviewForm(true);
    }
  };

  const submitReview = (e) => {
    e.preventDefault();
    if (!userReview.trim()) return;

    const newReview = {
      id: Date.now(),
      userId: 'currentUser',
      userName: 'You',
      rating: userRating,
      review: userReview,
      timestamp: Date.now(),
      likes: 0,
      dislikes: 0,
      verified: false,
      spoiler: false,
      helpful: false
    };

    setReviews(prev => [newReview, ...prev]);
    setUserReview('');
    setShowReviewForm(false);
  };

  const toggleExpanded = (reviewId) => {
    setExpandedReviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  const handleReviewAction = (reviewId, action) => {
    setReviews(prev => prev.map(review => {
      if (review.id === reviewId) {
        if (action === 'like') {
          return { ...review, likes: review.likes + 1 };
        } else if (action === 'dislike') {
          return { ...review, dislikes: review.dislikes + 1 };
        }
      }
      return review;
    }));
  };

  const getSortedReviews = () => {
    let filtered = reviews;

    // Filter by rating
    if (filterBy !== 'all') {
      const rating = parseInt(filterBy);
      filtered = reviews.filter(r => r.rating === rating);
    }

    // Sort reviews
    switch (sortBy) {
      case 'newest':
        return filtered.sort((a, b) => b.timestamp - a.timestamp);
      case 'oldest':
        return filtered.sort((a, b) => a.timestamp - b.timestamp);
      case 'highest':
        return filtered.sort((a, b) => b.rating - a.rating);
      case 'lowest':
        return filtered.sort((a, b) => a.rating - b.rating);
      case 'helpful':
        return filtered.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
      default:
        return filtered;
    }
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

  const renderStars = (rating, interactive = false, onRate = null) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => interactive && onRate && onRate(star)}
            className={`${interactive ? 'hover:scale-110 transition-transform' : ''}`}
            disabled={!interactive}
          >
            {star <= rating ? (
              <StarIconSolid className="w-5 h-5 text-yellow-400" />
            ) : (
              <StarIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Rating Overview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Reviews & Ratings</h2>
          <div className="text-right">
            <div className="flex items-center space-x-2">
              {renderStars(Math.round(averageRating))}
              <span className="text-white font-semibold text-lg">
                {averageRating}/5
              </span>
            </div>
            <div className="text-gray-400 text-sm">
              {reviews.length} reviews
            </div>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {[5, 4, 3, 2, 1].map(rating => (
            <div key={rating} className="text-center">
              <div className="text-white text-sm font-semibold mb-1">
                {rating}★
              </div>
              <div className="bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full"
                  style={{
                    width: `${(ratingDistribution[rating] || 0) / reviews.length * 100}%`
                  }}
                />
              </div>
              <div className="text-gray-400 text-xs mt-1">
                {ratingDistribution[rating] || 0}
              </div>
            </div>
          ))}
        </div>

        {/* User Rating */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-white font-semibold mb-3">Rate this movie</h3>
          <div className="flex items-center space-x-4">
            {renderStars(userRating, true, submitRating)}
            {userRating > 0 && (
              <span className="text-white">
                You rated: {userRating}/5
              </span>
            )}
          </div>
          
          {showReviewForm && (
            <form onSubmit={submitReview} className="mt-4">
              <textarea
                value={userReview}
                onChange={(e) => setUserReview(e.target.value)}
                placeholder="Write your review..."
                className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                rows={4}
              />
              <div className="flex justify-end space-x-2 mt-3">
                <button
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Submit Review
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Filter and Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-gray-400 text-sm">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest Rated</option>
              <option value="lowest">Lowest Rated</option>
              <option value="helpful">Most Helpful</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-gray-400 text-sm">Filter:</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {getSortedReviews().map((review) => (
          <div key={review.id} className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <UserCircleIcon className="w-10 h-10 text-gray-400" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-semibold">
                      {review.userName}
                    </span>
                    {review.verified && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    {renderStars(review.rating)}
                    <span className="text-gray-400 text-sm">
                      {formatDate(review.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                className="text-gray-400 hover:text-white"
                title="Report review"
              >
                <FlagIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-3">
              {review.spoiler && (
                <div className="bg-yellow-600 text-black text-xs font-bold px-2 py-1 rounded mb-2 inline-block">
                  SPOILER WARNING
                </div>
              )}
              
              <p className="text-gray-300 leading-relaxed">
                {expandedReviews.has(review.id) || review.review.length <= 200
                  ? review.review
                  : `${review.review.substring(0, 200)}...`}
              </p>
              
              {review.review.length > 200 && (
                <button
                  onClick={() => toggleExpanded(review.id)}
                  className="text-blue-400 hover:text-blue-300 text-sm mt-2 flex items-center"
                >
                  {expandedReviews.has(review.id) ? (
                    <>
                      Show less <ChevronUpIcon className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Show more <ChevronDownIcon className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Review Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleReviewAction(review.id, 'like')}
                  className="flex items-center space-x-1 text-gray-400 hover:text-green-400 transition-colors"
                >
                  <HandThumbUpIcon className="w-4 h-4" />
                  <span className="text-sm">{review.likes}</span>
                </button>
                
                <button
                  onClick={() => handleReviewAction(review.id, 'dislike')}
                  className="flex items-center space-x-1 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <HandThumbDownIcon className="w-4 h-4" />
                  <span className="text-sm">{review.dislikes}</span>
                </button>
                
                <button className="flex items-center space-x-1 text-gray-400 hover:text-blue-400 transition-colors">
                  <ChatBubbleLeftIcon className="w-4 h-4" />
                  <span className="text-sm">Reply</span>
                </button>
              </div>
              
              {review.helpful && (
                <span className="text-green-400 text-xs font-semibold">
                  ✓ Helpful
                </span>
              )}
            </div>
          </div>
        ))}
        
        {getSortedReviews().length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <ChatBubbleLeftIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No reviews found for the selected filters</p>
          </div>
        )}
      </div>
    </div>
  );
}