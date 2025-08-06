import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NetflixHomepage from './components/NetflixHomepage.jsx';
import Movies from './pages/Movies.jsx';
import Player from './pages/Player.jsx';

export default function App() {
  // Mock user data - replace with actual auth
  const user = {
    id: '1',
    name: 'Demo User',
    email: 'demo@sparrowflix.com',
    avatar: '/default-avatar.jpg'
  };

  return (
    <BrowserRouter basename="/SparrowFlix">
      <Routes>
        <Route path="/" element={<NetflixHomepage user={user} />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/watch/:type/:id" element={<Player />} />
        <Route path="/search" element={<div>Search Results Page - Coming Soon</div>} />
        <Route path="/my-list" element={<div>My List Page - Coming Soon</div>} />
        <Route path="/account" element={<div>Account Settings - Coming Soon</div>} />
      </Routes>
    </BrowserRouter>
  );
}
