import React from 'react';
import { Link } from 'react-router-dom';

export default function Hero({ movie }) {
  if (!movie) return null;

  return (
    <section
      className="relative h-64 sm:h-80 md:h-96 mb-8 flex items-end text-white"
      style={{
        backgroundImage: `url(${movie.backdrop || movie.poster})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="bg-gradient-to-t from-black via-transparent to-transparent w-full p-6">
        <h2 className="text-2xl md:text-4xl font-bold mb-4">{movie.title}</h2>
        <Link
          to={`/watch/${movie.id}`}
          className="bg-red-600 px-4 py-2 rounded"
        >
          Watch Now
        </Link>
      </div>
    </section>
  );
}
