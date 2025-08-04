import React from 'https://esm.sh/react@18';
import { BrowserRouter, Routes, Route } from 'https://esm.sh/react-router-dom@6';
import Header from './components/Header.js';
import Home from './pages/Home.js';
import Movies from './pages/Movies.js';
import Player from './pages/Player.js';

export default function App() {
  return React.createElement(
    BrowserRouter,
    null,
    React.createElement(Header),
    React.createElement(
      Routes,
      null,
      React.createElement(Route, { path: '/', element: React.createElement(Home) }),
      React.createElement(Route, { path: '/movies', element: React.createElement(Movies) }),
      React.createElement(Route, { path: '/watch/:id', element: React.createElement(Player) })
    )
  );
}
