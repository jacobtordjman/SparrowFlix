import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Hero({ movie }) {
  if (!movie) return null;

  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState(movie.backdrop || movie.poster);

  return (
    <section className="relative h-[50vh] md:h-[70vh] mb-8 text-white">
      <img
        src={src}
        alt={movie.title}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setSrc('https://via.placeholder.com/1280x720?text=No+Image')}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
      <div className="relative z-10 flex flex-col justify-end h-full p-6 space-y-4">
        <h2 className="text-3xl md:text-5xl font-bold max-w-xl">{movie.title}</h2>
        <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
          <Link
            to={`/watch/${movie.id}`}
            className="bg-red-600 hover:brightness-110 h-10 px-4 rounded flex items-center justify-center"
          >
            Play
          </Link>
          <Link
            to="/movies"
            className="bg-gray-700 hover:brightness-110 h-10 px-4 rounded flex items-center justify-center"
          >
            More Info
          </Link>
        </div>
      </div>
    </section>
  );
}
