import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkClass = ({ isActive }) =>
    `block h-11 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#E50914] ${
      isActive ? 'text-[#E50914] font-semibold' : 'text-gray-300'
    }`;

  return (
    <header
      className={`sticky top-0 z-20 transition-all ${
        scrolled ? 'bg-black/70 backdrop-blur-sm py-2' : 'bg-black py-4'
      }`}
    >
      <nav className="container mx-auto flex items-center justify-between px-6">
        <NavLink to="/" className="text-xl font-bold text-white pr-4" aria-label="SparrowFlix home">
          SparrowFlix
        </NavLink>
        <div className="flex items-center space-x-4">
          <button
            className="text-white md:hidden h-11 w-11 flex items-center justify-center"
            aria-label="Toggle navigation"
            aria-expanded={open}
            aria-controls="nav-menu"
            onClick={() => setOpen((o) => !o)}
          >
            ☰
          </button>
          <div className="relative hidden md:block">
            <button
              className="h-11 w-11 rounded-full bg-gray-700 text-white flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#E50914]"
              aria-label="User menu"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
            >
              U
            </button>
            {menu && (
              <ul
                role="menu"
                className="absolute right-0 mt-2 w-40 bg-black shadow-lg border border-gray-700 rounded"
              >
                <li>
                  <NavLink to="/profile" className="block px-4 py-2 hover:bg-gray-800" role="menuitem">
                    Profile
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/settings" className="block px-4 py-2 hover:bg-gray-800" role="menuitem">
                    Settings
                  </NavLink>
                </li>
                <li>
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-800" role="menuitem">
                    Logout
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
        <ul
          id="nav-menu"
          className={`${open ? 'block' : 'hidden'} md:flex md:space-x-4 space-y-2 md:space-y-0 absolute md:static top-full left-0 w-full md:w-auto bg-black md:bg-transparent px-6 md:px-0`}
        >
          <li>
            <NavLink to="/" end className={linkClass} aria-label="Home" onClick={() => setOpen(false)}>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/movies"
              className={linkClass}
              aria-label="Movies"
              onClick={() => setOpen(false)}
            >
              Movies
            </NavLink>
          </li>
        </ul>
      </nav>
    </header>
  );
}
