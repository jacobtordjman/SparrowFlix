import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import MobileNav from './components/MobileNav.jsx';
import Home from './pages/Home.jsx';
import Movies from './pages/Movies.jsx';
import Player from './pages/Player.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/watch/:id" element={<Player />} />
      </Routes>
      <MobileNav />
    </BrowserRouter>
  );
}
