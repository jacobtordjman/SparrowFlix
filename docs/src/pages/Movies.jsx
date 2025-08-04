import React, { useEffect, useState } from 'https://esm.sh/react@18';
import { Link } from 'https://esm.sh/react-router-dom@6?deps=react@18,react-dom@18';
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
      <section className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {movies.map((movie) => (
          <div key={movie.id} className="bg-gray-200 rounded p-2 text-center">
            <div className="font-semibold mb-2">{movie.title}</div>
            <Link to={`/watch/${movie.id}`} className="text-blue-500">
              Play
            </Link>
          </div>
        ))}
      </section>
    );
  }
