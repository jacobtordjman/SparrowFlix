import React from 'https://esm.sh/react@18';
import { Link } from 'https://esm.sh/react-router-dom@6';

export default function Home() {
  return React.createElement(
    'section',
    { className: 'p-8 text-center' },
    React.createElement(
      'h1',
      { className: 'text-3xl font-bold mb-4' },
      'Welcome to Your Personal Cinema'
    ),
    React.createElement(
      'p',
      { className: 'mb-6' },
      'Stream your collection anywhere, anytime'
    ),
    React.createElement(
      Link,
      { to: '/movies', className: 'bg-blue-500 text-white px-4 py-2 rounded' },
      'Start Watching'
    )
  );
}
