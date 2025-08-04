import React from 'react';
import useContent from '../hooks/useContent.js';
import Hero from '../components/Hero.jsx';
import ContentRow from '../components/ContentRow.jsx';

export default function Home() {
  const { movies, loading, error } = useContent();

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  const [featured, ...rest] = movies;
  const trending = rest.slice(0, 10);
  const newReleases = rest.slice(10, 20);
  const classics = rest.slice(20, 30);

  return (
    <div className="p-2">
      <Hero movie={featured} />
      <ContentRow title="Trending Now" items={trending.length ? trending : movies} />
      <ContentRow title="New Releases" items={newReleases.length ? newReleases : movies} />
      <ContentRow title="Classics" items={classics.length ? classics : movies} />
    </div>
  );
}
