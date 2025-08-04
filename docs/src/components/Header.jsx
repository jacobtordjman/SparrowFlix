import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const linkClasses = (path) =>
    `px-3 py-2 ${location.pathname === path ? 'text-red-500 font-semibold' : 'text-gray-300'}`;

  return (
    <header className="bg-black shadow-md">
      <nav className="container mx-auto flex items-center justify-between p-4">
        <Link to="/" className="text-xl font-bold text-white">SparrowFlix</Link>
        <button className="text-white md:hidden" onClick={() => setOpen((o) => !o)}>
          ☰
        </button>
        <div
          className={`${open ? 'block' : 'hidden'} md:flex md:space-x-4 space-y-2 md:space-y-0`}
        >
          <Link to="/" className={linkClasses('/')}>Home</Link>
          <Link to="/movies" className={linkClasses('/movies')}>Movies</Link>
        </div>
      </nav>
    </header>
  );
}
