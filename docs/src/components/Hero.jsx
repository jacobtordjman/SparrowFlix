import React from 'react';
import { Link } from 'react-router-dom';

export default function Hero({ movie }) {
  if (!movie) return null;

  const bg = movie.backdrop || movie.poster;

  return (
    <section className="relative h-64 sm:h-80 md:h-96 mb-8 text-white">
      <img
        src={bg}
        alt={movie.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
      <div className="relative z-10 flex flex-col justify-end h-full p-6">
        <h2 className="text-2xl md:text-4xl font-bold mb-4">{movie.title}</h2>
        <div className="space-x-2">
          <Link
            to={`/watch/${movie.id}`}
            className="bg-red-600 px-4 py-2 rounded"
          >
            Play
          </Link>
          <Link
            to="/movies"
            className="bg-gray-700 px-4 py-2 rounded"
          >
            More Info
          </Link>
        </div>
      </div>
    </section>
  );
}
