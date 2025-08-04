import React from 'react';
import { Link } from 'react-router-dom';

export default function ContentRow({ title, items = [] }) {
  return (
    <section className="mb-8">
      <h3 className="text-xl font-semibold mb-2 px-2">{title}</h3>
      <div className="flex overflow-x-auto space-x-4 pb-4 px-2 snap-x snap-mandatory">
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
    </section>
  );
}
