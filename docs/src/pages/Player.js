import React, { useEffect, useState } from 'https://esm.sh/react@18';
import { useParams } from 'https://esm.sh/react-router-dom@6';
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
    return React.createElement('div', { className: 'p-4 text-red-500' }, error);
  }

  return React.createElement(
    'section',
    { className: 'p-4' },
    streamUrl
      ? React.createElement('video', {
          controls: true,
          autoPlay: true,
          className: 'w-full max-w-screen-md mx-auto',
          src: streamUrl,
        })
      : React.createElement('div', null, 'Loading...')
  );
}
