import React, { useState } from 'https://esm.sh/react@18';
import { Link, useLocation } from 'https://esm.sh/react-router-dom@6?deps=react@18,react-dom@18';

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
