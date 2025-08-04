import React from 'https://esm.sh/react@18';
import { BrowserRouter, Routes, Route } from 'https://esm.sh/react-router-dom@6?deps=react@18,react-dom@18';
import Header from './components/Header.jsx';
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
    </BrowserRouter>
  );
}
