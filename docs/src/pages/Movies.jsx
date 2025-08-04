import React from 'react';
import { Link } from 'react-router-dom';
import useContent from '../hooks/useContent.js';

export default function Movies() {
  const { movies, loading, error } = useContent();

  if (loading) {
    return (
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 pb-16">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-48 bg-gray-800 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <section className="p-4 pb-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {movies.map((movie) => (
        <Link key={movie.id} to={`/watch/${movie.id}`} className="block" aria-label={movie.title}>
          <img
            src={movie.poster}
            alt={movie.title}
            onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150x225?text=No+Image')}
            className="rounded hover:scale-105 transition-transform"
          />
        </Link>
      ))}
    </section>
  );
}
