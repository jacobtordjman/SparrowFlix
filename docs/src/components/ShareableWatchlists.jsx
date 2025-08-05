// docs/src/components/ShareableWatchlists.jsx - Shareable Watchlists (Phase 3.2)
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  ShareIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  LinkIcon,
  HeartIcon,
  BookmarkIcon,
  GlobeAltIcon,
  LockClosedIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function ShareableWatchlists() {
  const [watchlists, setWatchlists] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListPrivacy, setNewListPrivacy] = useState('private');

  useEffect(() => {
    loadWatchlists();
  }, []);

  const loadWatchlists = () => {
    // Load from localStorage or API
    const stored = localStorage.getItem('sparrowflix_watchlists');
    if (stored) {
      setWatchlists(JSON.parse(stored));
    } else {
      // Initialize with default lists
      const defaultLists = [
        {
          id: 'favorites',
          name: 'My Favorites',
          description: 'Movies and shows I absolutely love',
          privacy: 'private',
          movies: [1, 2, 3, 4, 5],
          createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
          updatedAt: Date.now() - 24 * 60 * 60 * 1000,
          shareId: generateShareId(),
          views: 0,
          likes: 0
        },
        {
          id: 'watchlater',
          name: 'Watch Later',
          description: 'Movies and shows on my to-watch list',
          privacy: 'private',
          movies: [6, 7, 8],
          createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
          updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
          shareId: generateShareId(),
          views: 0,
          likes: 0
        }
      ];
      setWatchlists(defaultLists);
      localStorage.setItem('sparrowflix_watchlists', JSON.stringify(defaultLists));
    }
  };

  const saveWatchlists = (lists) => {
    localStorage.setItem('sparrowflix_watchlists', JSON.stringify(lists));
    setWatchlists(lists);
  };

  const generateShareId = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  const createWatchlist = (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const newList = {
      id: Date.now().toString(),
      name: newListName,
      description: newListDescription,
      privacy: newListPrivacy,
      movies: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shareId: generateShareId(),
      views: 0,
      likes: 0
    };

    const updatedLists = [...watchlists, newList];
    saveWatchlists(updatedLists);
    
    setNewListName('');
    setNewListDescription('');
    setNewListPrivacy('private');
    setShowCreateForm(false);
  };

  const updateWatchlist = (listId, updates) => {
    const updatedLists = watchlists.map(list =>
      list.id === listId
        ? { ...list, ...updates, updatedAt: Date.now() }
        : list
    );
    saveWatchlists(updatedLists);
  };

  const deleteWatchlist = (listId) => {
    if (confirm('Are you sure you want to delete this watchlist?')) {
      const updatedLists = watchlists.filter(list => list.id !== listId);
      saveWatchlists(updatedLists);
    }
  };

  const toggleListPrivacy = (listId) => {
    const list = watchlists.find(l => l.id === listId);
    if (list) {
      updateWatchlist(listId, {
        privacy: list.privacy === 'private' ? 'public' : 'private'
      });
    }
  };

  const shareWatchlist = async (list) => {
    const shareUrl = `${window.location.origin}/shared-watchlist/${list.shareId}`;
    
    const shareData = {
      title: `Check out my "${list.name}" watchlist on SparrowFlix`,
      text: list.description || `A collection of movies and shows curated by me`,
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Watchlist link copied to clipboard!');
      }
      
      // Track share
      updateWatchlist(list.id, { views: list.views + 1 });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getListIcon = (privacy) => {
    return privacy === 'public' ? (
      <GlobeAltIcon className="w-4 h-4 text-green-500" />
    ) : (
      <LockClosedIcon className="w-4 h-4 text-gray-500" />
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Watchlists</h1>
            <p className="text-gray-400 mt-1">
              Create and share your personalized movie collections
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Create List</span>
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-gray-900 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Create New Watchlist</h2>
            <form onSubmit={createWatchlist} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">List Name</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Action Movies, Horror Classics"
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-red-500 focus:outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                <textarea
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Describe your watchlist..."
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-red-500 focus:outline-none resize-none"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Privacy</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="private"
                      checked={newListPrivacy === 'private'}
                      onChange={(e) => setNewListPrivacy(e.target.value)}
                      className="mr-2"
                    />
                    <LockClosedIcon className="w-4 h-4 mr-1" />
                    Private
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="public"
                      checked={newListPrivacy === 'public'}
                      onChange={(e) => setNewListPrivacy(e.target.value)}
                      className="mr-2"
                    />
                    <GlobeAltIcon className="w-4 h-4 mr-1" />
                    Public
                  </label>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                >
                  Create List
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Watchlists Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {watchlists.map((list) => (
            <WatchlistCard
              key={list.id}
              list={list}
              onEdit={(list) => setEditingList(list)}
              onDelete={() => deleteWatchlist(list.id)}
              onTogglePrivacy={() => toggleListPrivacy(list.id)}
              onShare={() => shareWatchlist(list)}
              onUpdate={(updates) => updateWatchlist(list.id, updates)}
            />
          ))}
        </div>

        {watchlists.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <BookmarkIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No watchlists yet</h3>
            <p className="mb-4">Create your first watchlist to organize your favorite content</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded transition-colors"
            >
              Create Your First List
            </button>
          </div>
        )}

        {/* Edit Modal */}
        {editingList && (
          <EditWatchlistModal
            list={editingList}
            onSave={(updates) => {
              updateWatchlist(editingList.id, updates);
              setEditingList(null);
            }}
            onCancel={() => setEditingList(null)}
          />
        )}
      </div>
    </div>
  );
}

// Individual Watchlist Card
function WatchlistCard({ list, onEdit, onDelete, onTogglePrivacy, onShare, onUpdate }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-xl font-semibold">{list.name}</h3>
            {getListIcon(list.privacy)}
          </div>
          {list.description && (
            <p className="text-gray-400 text-sm line-clamp-2">
              {list.description}
            </p>
          )}
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-400 hover:text-white p-1"
          >
            ⋮
          </button>
          
          {showMenu && (
            <div className="absolute top-8 right-0 bg-gray-800 border border-gray-700 rounded-lg py-2 min-w-32 z-10">
              <button
                onClick={() => {
                  onEdit(list);
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm flex items-center"
              >
                <PencilIcon className="w-4 h-4 mr-2" />
                Edit
              </button>
              <button
                onClick={() => {
                  onTogglePrivacy();
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm flex items-center"
              >
                {list.privacy === 'private' ? (
                  <>
                    <EyeIcon className="w-4 h-4 mr-2" />
                    Make Public
                  </>
                ) : (
                  <>
                    <EyeSlashIcon className="w-4 h-4 mr-2" />
                    Make Private
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  onShare();
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm flex items-center"
              >
                <ShareIcon className="w-4 h-4 mr-2" />
                Share
              </button>
              <hr className="border-gray-600 my-1" />
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm flex items-center text-red-400"
              >
                <TrashIcon className="w-4 h-4 mr-2" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
        <span>{list.movies.length} movies</span>
        <div className="flex items-center space-x-3">
          {list.privacy === 'public' && (
            <>
              <span className="flex items-center">
                <EyeIcon className="w-4 h-4 mr-1" />
                {list.views}
              </span>
              <span className="flex items-center">
                <HeartIcon className="w-4 h-4 mr-1" />
                {list.likes}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Movie Previews */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {list.movies.slice(0, 3).map((movieId, index) => (
          <div
            key={movieId}
            className="aspect-[2/3] bg-gray-700 rounded overflow-hidden"
          >
            <img
              src={`https://via.placeholder.com/120x180/444444/ffffff?text=${movieId}`}
              alt={`Movie ${movieId}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        {list.movies.length > 3 && (
          <div className="aspect-[2/3] bg-gray-700 rounded flex items-center justify-center">
            <span className="text-gray-400">+{list.movies.length - 3}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        <Link
          to={`/watchlist/${list.id}`}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-center py-2 rounded transition-colors"
        >
          View List
        </Link>
        <button
          onClick={onShare}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        >
          <ShareIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Updated */}
      <div className="text-xs text-gray-500 mt-3">
        Updated {new Date(list.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

// Edit Modal Component
function EditWatchlistModal({ list, onSave, onCancel }) {
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description);
  const [privacy, setPrivacy] = useState(list.privacy);

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ name, description, privacy });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Edit Watchlist</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">List Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-red-500 focus:outline-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-red-500 focus:outline-none resize-none"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Privacy</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="private"
                  checked={privacy === 'private'}
                  onChange={(e) => setPrivacy(e.target.value)}
                  className="mr-2"
                />
                <LockClosedIcon className="w-4 h-4 mr-1" />
                Private
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="public"
                  checked={privacy === 'public'}
                  onChange={(e) => setPrivacy(e.target.value)}
                  className="mr-2"
                />
                <GlobeAltIcon className="w-4 h-4 mr-1" />
                Public
              </label>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded transition-colors"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const getListIcon = (privacy) => {
  return privacy === 'public' ? (
    <GlobeAltIcon className="w-4 h-4 text-green-500" />
  ) : (
    <LockClosedIcon className="w-4 h-4 text-gray-500" />
  );
};