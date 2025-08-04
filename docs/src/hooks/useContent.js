import { useEffect, useState } from 'react';
import { getContent } from '../api.js';

let cache = null;
let cacheTime = 0;
const TTL = 5 * 60 * 1000; // 5 minutes

export default function useContent() {
  const [movies, setMovies] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        if (cache && Date.now() - cacheTime < TTL) {
          const { all, first, rowData } = cache;
          if (!ignore) {
            setMovies(all);
            setFeatured(first);
            setRows(rowData);
          }
        } else {
          const data = await getContent();
          const all = data.movies || [];
          const [first, ...rest] = all;
          const rowData = [
            { title: 'Trending Now', items: rest.slice(0, 10) },
            { title: 'New Releases', items: rest.slice(10, 20) },
            { title: 'Classics', items: rest.slice(20, 30) },
          ];
          cache = { all, first, rowData };
          cacheTime = Date.now();
          if (!ignore) {
            setMovies(all);
            setFeatured(first);
            setRows(rowData);
          }
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  return { movies, featured, rows, loading, error };
}
