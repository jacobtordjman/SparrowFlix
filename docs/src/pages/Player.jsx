import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createTicket } from '../api.js';
import { API_BASE_URL } from '../config.js';

export default function Player() {
  const { id } = useParams();
    const [streamUrl, setStreamUrl] = useState(null);
    const [error, setError] = useState(null);

  useEffect(() => {
    createTicket({ contentId: id, type: 'movie' })
        .then(({ streamUrl }) => {
          setStreamUrl(`${API_BASE_URL}${streamUrl}`);
        })
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <section className="p-4">
      {streamUrl ? (
        <video
          controls
          autoPlay
          className="w-full max-w-screen-md mx-auto"
          src={streamUrl}
        />
      ) : (
        <div>Loading...</div>
      )}
    </section>
  );
}
