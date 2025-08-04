import { useEffect, useState } from 'react';
import { getContent } from '../api.js';

export default function useContent() {
  const [movies, setMovies] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getContent()
      .then((data) => {
        const all = data.movies || [];
        const [first, ...rest] = all;
        setMovies(all);
        setFeatured(first);
        setRows([
          { title: 'Trending Now', items: rest.slice(0, 10) },
          { title: 'New Releases', items: rest.slice(10, 20) },
          { title: 'Classics', items: rest.slice(20, 30) },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { movies, featured, rows, loading, error };
}
