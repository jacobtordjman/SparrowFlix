// docs/src/components/SocialFeatures.jsx - Social Features and Watch Parties (Phase 3.2)
import React, { useState, useEffect, useRef } from 'react';
import { 
  UserGroupIcon, 
  ChatBubbleLeftRightIcon, 
  ShareIcon, 
  HeartIcon,
  PaperAirplaneIcon,
  UsersIcon,
  LinkIcon,
  ClockIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function SocialFeatures({ movieId, movieTitle }) {
  const [showWatchParty, setShowWatchParty] = useState(false);
  const [watchParty, setWatchParty] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [reactions, setReactions] = useState({});
  
  const chatRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    // Auto-scroll chat to bottom
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize WebSocket connection for watch party
  const initializeWatchParty = () => {
    // Simulate WebSocket connection (replace with actual implementation)
    const mockWs = {
      send: (data) => console.log('WebSocket send:', data),
      close: () => console.log('WebSocket closed'),
      onmessage: null,
      onopen: null,
      onclose: null
    };

    wsRef.current = mockWs;

    // Simulate receiving messages
    setTimeout(() => {
      addMessage({
        id: Date.now(),
        user: 'System',
        text: 'Watch party started!',
        timestamp: Date.now(),
        type: 'system'
      });
    }, 1000);

    return mockWs;
  };

  const createWatchParty = () => {
    const partyId = generatePartyId();
    const party = {
      id: partyId,
      movieId,
      movieTitle,
      host: 'You',
      participants: ['You'],
      createdAt: Date.now(),
      isActive: true,
      syncedTime: 0
    };

    setWatchParty(party);
    setIsHost(true);
    setParticipants([{ name: 'You', isHost: true }]);
    setShowWatchParty(true);
    setShowChat(true);
    
    initializeWatchParty();
    
    // Copy invite link to clipboard
    const inviteLink = `${window.location.origin}/watch-party/${partyId}`;
    navigator.clipboard.writeText(inviteLink);
    
    addMessage({
      id: Date.now(),
      user: 'System',
      text: `Watch party created! Invite link copied to clipboard.`,
      timestamp: Date.now(),
      type: 'system'
    });
  };

  const joinWatchParty = (partyId) => {
    // Simulate joining a party
    const party = {
      id: partyId,
      movieId,
      movieTitle,
      host: 'Friend',
      participants: ['You', 'Friend'],
      createdAt: Date.now() - 300000, // 5 minutes ago
      isActive: true,
      syncedTime: 1250 // 20 minutes into movie
    };

    setWatchParty(party);
    setIsHost(false);
    setParticipants([
      { name: 'Friend', isHost: true },
      { name: 'You', isHost: false }
    ]);
    setShowWatchParty(true);
    setShowChat(true);
    
    initializeWatchParty();
    
    addMessage({
      id: Date.now(),
      user: 'System',
      text: `You joined the watch party!`,
      timestamp: Date.now(),
      type: 'system'
    });
  };

  const leaveWatchParty = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setWatchParty(null);
    setShowWatchParty(false);
    setShowChat(false);
    setMessages([]);
    setParticipants([]);
    setIsHost(false);
  };

  const addMessage = (message) => {
    setMessages(prev => [...prev, message]);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      user: 'You',
      text: newMessage,
      timestamp: Date.now(),
      type: 'user'
    };

    addMessage(message);
    
    // Send via WebSocket
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        message
      }));
    }

    setNewMessage('');
  };

  const sendReaction = (emoji) => {
    const reaction = {
      id: Date.now(),
      user: 'You',
      emoji,
      timestamp: Date.now()
    };

    setReactions(prev => ({
      ...prev,
      [Date.now()]: reaction
    }));

    // Send via WebSocket
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'reaction',
        reaction
      }));
    }

    // Remove reaction after 3 seconds
    setTimeout(() => {
      setReactions(prev => {
        const updated = { ...prev };
        delete updated[reaction.id];
        return updated;
      });
    }, 3000);
  };

  const generatePartyId = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const shareWatchlist = () => {
    const shareData = {
      title: `Check out my SparrowFlix watchlist!`,
      text: `I'm watching ${movieTitle} on SparrowFlix`,
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(shareData.url);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Social Actions Floating Button */}
      <div className="flex flex-col space-y-2">
        {/* Watch Party Button */}
        <button
          onClick={() => setShowWatchParty(!showWatchParty)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
            watchParty 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-purple-600 hover:bg-purple-700'
          } text-white`}
        >
          <UserGroupIcon className="w-6 h-6" />
          {watchParty && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {participants.length}
            </span>
          )}
        </button>

        {/* Share Button */}
        <button
          onClick={shareWatchlist}
          className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all"
        >
          <ShareIcon className="w-6 h-6" />
        </button>

        {/* Chat Toggle (only when in watch party) */}
        {watchParty && (
          <button
            onClick={() => setShowChat(!showChat)}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
              showChat 
                ? 'bg-gray-600 hover:bg-gray-700' 
                : 'bg-orange-600 hover:bg-orange-700'
            } text-white`}
          >
            <ChatBubbleLeftRightIcon className="w-6 h-6" />
            {messages.length > 0 && !showChat && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </button>
        )}
      </div>

      {/* Watch Party Panel */}
      {showWatchParty && (
        <div className="fixed bottom-20 right-4 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center">
                <UserGroupIcon className="w-5 h-5 mr-2" />
                Watch Party
              </h3>
              <button
                onClick={() => setShowWatchParty(false)}
                className="text-gray-400 hover:text-white"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4">
            {!watchParty ? (
              <div className="space-y-3">
                <button
                  onClick={createWatchParty}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition-colors"
                >
                  Create Watch Party
                </button>
                
                <div className="text-center text-gray-400 text-sm">or</div>
                
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Enter party ID"
                    className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    onClick={() => joinWatchParty('demo123')}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Join
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Party Info */}
                <div className="bg-gray-800 p-3 rounded">
                  <div className="text-sm text-gray-300">
                    <div className="flex justify-between">
                      <span>Party ID:</span>
                      <span className="font-mono">{watchParty.id}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>Host:</span>
                      <span>{watchParty.host}</span>
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center">
                    <UsersIcon className="w-4 h-4 mr-1" />
                    Participants ({participants.length})
                  </h4>
                  <div className="space-y-1">
                    {participants.map((participant, index) => (
                      <div key={index} className="flex items-center text-sm text-gray-300">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                        {participant.name}
                        {participant.isHost && (
                          <span className="ml-2 px-1 py-0.5 bg-purple-600 text-xs rounded">
                            Host
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sync Controls (for host) */}
                {isHost && (
                  <div className="border-t border-gray-700 pt-3">
                    <h4 className="text-sm font-semibold text-white mb-2">Host Controls</h4>
                    <div className="flex space-x-2">
                      <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-1 px-2 rounded">
                        Sync
                      </button>
                      <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-1 px-2 rounded">
                        Pause All
                      </button>
                    </div>
                  </div>
                )}

                {/* Leave Button */}
                <button
                  onClick={leaveWatchParty}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors"
                >
                  Leave Party
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {showChat && watchParty && (
        <div className="fixed bottom-20 right-96 w-80 h-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col">
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center">
              <ChatBubbleLeftRightIcon className="w-5 h-5 mr-2" />
              Party Chat
            </h3>
            <button
              onClick={() => setShowChat(false)}
              className="text-gray-400 hover:text-white"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div 
            ref={chatRef}
            className="flex-1 overflow-y-auto p-3 space-y-2"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${
                  message.type === 'system' 
                    ? 'text-center text-gray-400 text-xs' 
                    : ''
                }`}
              >
                {message.type === 'system' ? (
                  <div className="bg-gray-800 px-2 py-1 rounded text-xs">
                    {message.text}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-semibold ${
                        message.user === 'You' ? 'text-blue-400' : 'text-green-400'
                      }`}>
                        {message.user}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-white mt-1">
                      {message.text}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Reaction Buttons */}
          <div className="border-t border-gray-700 p-2">
            <div className="flex justify-center space-x-2 mb-2">
              {['😂', '😮', '😍', '👍', '👎', '🔥'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="text-lg hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <form onSubmit={sendMessage} className="border-t border-gray-700 p-3">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Reactions */}
      <div className="fixed inset-0 pointer-events-none z-40">
        {Object.values(reactions).map((reaction) => (
          <div
            key={reaction.id}
            className="absolute text-2xl animate-bounce"
            style={{
              left: `${Math.random() * 80 + 10}%`,
              top: `${Math.random() * 80 + 10}%`,
              animation: 'float-up 3s ease-out forwards'
            }}
          >
            {reaction.emoji}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px);
          }
        }
      `}</style>
    </div>
  );
}