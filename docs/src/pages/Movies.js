import React, { useEffect, useState } from 'https://esm.sh/react@18';
import { Link } from 'https://esm.sh/react-router-dom@6';
import { getContent } from '../api.js';

export default function Movies() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    getContent().then(data => setMovies(data.movies || [])).catch(() => {});
  }, []);

  return React.createElement(
    'section',
    { className: 'p-4 grid grid-cols-2 md:grid-cols-4 gap-4' },
    movies.map(movie =>
      React.createElement(
        'div',
        { key: movie.id, className: 'bg-gray-200 rounded p-2 text-center' },
        React.createElement('div', { className: 'font-semibold mb-2' }, movie.title),
        React.createElement(
          Link,
          { to: `/watch/${movie.id}`, className: 'text-blue-500' },
          'Play'
        )
      )
    )
  );
}
