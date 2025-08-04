import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getContent } from '../api.js';

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getContent()
      .then((data) => setMovies(data.movies || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <section className="p-8">
      <h1 className="text-2xl font-bold mb-4">Featured</h1>
      <div className="flex overflow-x-auto space-x-4 pb-4">
        {movies.map((m) => (
          <Link key={m.id} to={`/watch/${m.id}`} className="flex-none w-40">
            <img
              src={m.poster}
              alt={m.title}
              className="rounded hover:scale-105 transition-transform" />
          </Link>
        ))}
      </div>
    </section>
  );
}
