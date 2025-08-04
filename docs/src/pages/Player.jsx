import React, { useEffect, useState } from 'https://esm.sh/react@18';
import { useParams } from 'https://esm.sh/react-router-dom@6?deps=react@18,react-dom@18';
import { createTicket } from '../api.js';

export default function Player() {
  const { id } = useParams();
  const [streamUrl, setStreamUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    createTicket({ contentId: id, type: 'movie' })
      .then(({ streamUrl }) => {
        setStreamUrl(`https://sparrowflix-dev.sparrowflix.workers.dev${streamUrl}`);
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
