import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getContent } from '../api.js';

export default function Movies() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
      getContent()
        .then((data) => {
          setMovies(data.movies || []);
        })
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
