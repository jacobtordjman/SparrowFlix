import React from 'react';
import { Link } from 'react-router-dom';
import useContent from '../hooks/useContent.js';

export default function Movies() {
  const { movies, loading, error } = useContent();

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <section className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {movies.map((movie) => (
        <Link key={movie.id} to={`/watch/${movie.id}`} className="block">
          <img
            src={movie.poster}
            alt={movie.title}
            className="rounded hover:scale-105 transition-transform"
          />
        </Link>
      ))}
    </section>
  );
}
