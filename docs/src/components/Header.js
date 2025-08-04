import React from 'https://esm.sh/react@18';
import { Link, useLocation } from 'https://esm.sh/react-router-dom@6';

export default function Header() {
  const location = useLocation();
  const linkClasses = (path) =>
    `px-3 py-2 ${location.pathname === path ? 'text-blue-500 font-semibold' : 'text-gray-700'}`;

  return React.createElement(
    'header',
    { className: 'bg-white shadow-md' },
    React.createElement(
      'nav',
      { className: 'container mx-auto flex items-center justify-between p-4' },
      React.createElement(Link, { to: '/', className: 'text-xl font-bold' }, 'SparrowFlix'),
      React.createElement(
        'div',
        { className: 'space-x-4' },
        React.createElement(Link, { to: '/', className: linkClasses('/') }, 'Home'),
        React.createElement(Link, { to: '/movies', className: linkClasses('/movies') }, 'Movies')
      )
    )
  );
}
