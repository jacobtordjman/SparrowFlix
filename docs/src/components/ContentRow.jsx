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
    <section className="mb-8">
      <h3 className="text-xl font-semibold mb-2 px-2">{title}</h3>
      <div className="relative">
        <button
          aria-label="scroll left"
          className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2"
          onClick={() => scroll('left')}
        >
          ‹
        </button>
        <div
          ref={rowRef}
          className="flex overflow-x-auto space-x-4 pb-4 px-2 snap-x snap-mandatory scroll-smooth"
        >
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/watch/${item.id}`}
              className="flex-none w-32 sm:w-40 snap-start"
            >
              <img
                src={item.poster}
                alt={item.title}
                className="rounded hover:scale-105 transition-transform"
              />
            </Link>
          ))}
        </div>
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
