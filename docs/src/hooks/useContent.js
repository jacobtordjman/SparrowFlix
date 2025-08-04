import { useEffect, useState } from 'react';
import { getContent } from '../api.js';

export default function useContent() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getContent()
      .then((data) => setMovies(data.movies || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { movies, loading, error };
}
