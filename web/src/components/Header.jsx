import React from 'https://esm.sh/react@18';
import { Link, useLocation } from 'https://esm.sh/react-router-dom@6';

export default function Header() {
  const location = useLocation();
  const linkClasses = (path) =>
    `px-3 py-2 ${location.pathname === path ? 'text-blue-500 font-semibold' : 'text-gray-700'}`;

  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto flex items-center justify-between p-4">
        <Link to="/" className="text-xl font-bold">SparrowFlix</Link>
        <div className="space-x-4">
          <Link to="/" className={linkClasses('/')}>Home</Link>
          <Link to="/movies" className={linkClasses('/movies')}>Movies</Link>
        </div>
      </nav>
    </header>
  );
}
