import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

export default function Header() {
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `px-3 py-2 ${isActive ? 'text-red-500 font-semibold' : 'text-gray-300'}`;

  return (
    <header className="bg-black shadow-md sticky top-0 z-10">
      <nav className="container mx-auto flex items-center justify-between p-4">
        <NavLink to="/" className="text-xl font-bold text-white">
          SparrowFlix
        </NavLink>
        <button
          className="text-white md:hidden"
          onClick={() => setOpen((o) => !o)}
        >
          ☰
        </button>
        <div
          className={`${open ? 'block' : 'hidden'} md:flex md:space-x-4 space-y-2 md:space-y-0`}
        >
          <NavLink to="/" className={linkClass} onClick={() => setOpen(false)}>
            Home
          </NavLink>
          <NavLink
            to="/movies"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            Movies
          </NavLink>
        </div>
      </nav>
    </header>
  );
}
