import React, { useEffect, useState } from 'https://esm.sh/react@18';
import { getContent } from '../api.js';

export default function Movies() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    getContent().then(data => setMovies(data.movies || [])).catch(() => {});
  }, []);

  return (
    <section className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
      {movies.map(movie => (
        <div key={movie.id} className="bg-gray-200 rounded p-2 text-center">
          <div className="font-semibold">{movie.title}</div>
        </div>
      ))}
    </section>
  );
}
