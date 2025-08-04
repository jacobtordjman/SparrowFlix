import React from 'react';
import { NavLink } from 'react-router-dom';

export default function MobileNav() {
  const link = ({ isActive }) =>
    `flex-1 flex flex-col items-center justify-center text-xs h-14 ${
      isActive ? 'text-[#E50914]' : 'text-gray-300'
    }`;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-black/90 backdrop-blur-sm md:hidden flex border-t border-gray-800"
      role="tablist"
    >
      <NavLink to="/" end className={link} aria-label="Home" role="tab">
        <span className="text-lg">🏠</span>
        Home
      </NavLink>
      <NavLink to="/search" className={link} aria-label="Search" role="tab">
        <span className="text-lg">🔍</span>
        Search
      </NavLink>
      <NavLink to="/my-list" className={link} aria-label="My List" role="tab">
        <span className="text-lg">📺</span>
        My List
      </NavLink>
    </nav>
  );
}

