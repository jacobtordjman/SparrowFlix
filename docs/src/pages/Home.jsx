import React from 'react';
import useContent from '../hooks/useContent.js';
import Hero from '../components/Hero.jsx';
import ContentRow from '../components/ContentRow.jsx';

export default function Home() {
  const { featured, rows, movies, loading, error } = useContent();

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-2">
      <Hero movie={featured} />
      {rows.map(({ title, items }) => (
        <ContentRow
          key={title}
          title={title}
          items={items.length ? items : movies}
        />
      ))}
    </div>
  );
}
