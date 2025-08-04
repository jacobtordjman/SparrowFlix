import React, { useRef } from 'react';
import { Link } from 'react-router-dom';

export default function ContentRow({ title, items = [] }) {
  const rowRef = useRef(null);
  const scroll = (dir) => {
    if (rowRef.current) {
      const { clientWidth } = rowRef.current;
      rowRef.current.scrollBy({
        left: dir === 'left' ? -clientWidth : clientWidth,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="mb-8" aria-label={title}>
      <h3 className="text-xl font-semibold mb-2 px-2">{title}</h3>
      <div className="relative">
        <button
          aria-label="scroll left"
          className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2"
          onClick={() => scroll('left')}
        >
          ‹
        </button>
        <ul
          ref={rowRef}
          role="list"
          className="flex overflow-x-auto space-x-4 pb-4 px-2 snap-x snap-mandatory scroll-smooth"
        >
          {items.map((item) => (
            <li key={item.id} role="listitem" className="flex-none w-32 sm:w-40 snap-start">
              <Link to={`/watch/${item.id}`} className="block">
                <div className="relative">
                  <img
                    src={item.poster}
                    alt={item.title}
                    onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150x225?text=No+Image')}
                    className="rounded hover:scale-105 transition-transform w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-xs p-1 opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.title}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <button
          aria-label="scroll right"
          className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2"
          onClick={() => scroll('right')}
        >
          ›
        </button>
      </div>
    </section>
  );
}
