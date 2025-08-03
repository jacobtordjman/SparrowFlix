// functions/api/index.js - Updated with proper auth handling
import { connectDB } from '../db/connection.js';
import { verifyTelegramWebAppData } from '../utils/auth.js';
import { handleChannelsApi } from './channels.js';
import { handleTicketApi } from './ticket.js';

export async function handleApiRequest(request, env, path) {
  const db = await connectDB(env);
  const url = new URL(request.url);
  
  // Extract API path
  const apiPath = path.replace('/api/', '');
  const [resource, ...params] = apiPath.split('/');

  // Define which routes require authentication
  const protectedRoutes = ['user', 'watch', 'ticket'];
  const requiresAuth = protectedRoutes.includes(resource);

  // Verify Telegram authentication only for protected routes
  const authHeader = request.headers.get('X-Telegram-Init-Data');
  let user = null;
  
  if (authHeader) {
    user = verifyTelegramWebAppData(authHeader, env.BOT_TOKEN);
    if (!user && requiresAuth) {
      return {
        body: JSON.stringify({ error: 'Unauthorized' }),
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      };
    }
  } else if (requiresAuth) {
    return {
      body: JSON.stringify({ error: 'Authentication required' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    switch (resource) {
      case 'content':
        return await handleContentApi(request, db, params, user);
      
      case 'search':
        return await handleSearchApi(request, db, url);
      
      case 'user':
        return await handleUserApi(request, db, user);
      
      case 'watch':
        return await handleWatchApi(request, db, params, user);
      
      case 'ticket':
        return await handleTicketApi(request, env, params, user);

      case 'channels':
        return await handleChannelsApi(request, db, params, user, env);
      
      default:
        return {
          body: JSON.stringify({ error: 'Not found' }),
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        };
    }
  } catch (error) {
    console.error('API error:', error);
    return {
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

// Updated handleContentApi function for functions/api/index.js

async function handleContentApi(request, db, params, user) {
  const [type, id] = params;
  
  if (!type) {
    // Get all content - this should work without auth now
    try {
      console.log('Fetching movies...');
      
      // For D1, let's be more explicit about the query
      const moviesQuery = db.collection('movies').find({});
      const allMovies = await moviesQuery.toArray();
      
      console.log(`Found ${allMovies.length} total movies`);
      
      // Filter movies that have files
      const movies = allMovies.filter(movie => movie.file_id && movie.file_id.trim() !== '');
      
      console.log(`Found ${movies.length} movies with files`);
      
      console.log('Fetching TV shows...');
      
      const showsQuery = db.collection('tv_shows').find({});
      const allShows = await showsQuery.toArray();
      
      console.log(`Found ${allShows.length} total shows`);
      
      // Get episodes for shows
      const episodesQuery = db.collection('episodes').find({});
      const allEpisodes = await episodesQuery.toArray();
      
      console.log(`Found ${allEpisodes.length} total episodes`);
      
      // Group episodes by show_id
      const episodesByShow = {};
      allEpisodes.forEach(episode => {
        if (!episodesByShow[episode.show_id]) {
          episodesByShow[episode.show_id] = [];
        }
        episodesByShow[episode.show_id].push(episode);
      });
      
      // Filter shows that have episodes with files
      const shows = allShows.filter(show => {
        const episodes = episodesByShow[show.id] || [];
        return episodes.some(ep => ep.file_id && ep.file_id.trim() !== '');
      }).map(show => {
        // Add episodes to show details if needed
        const episodes = episodesByShow[show.id] || [];
        const showWithEpisodes = { ...show };
        
        if (showWithEpisodes.details && typeof showWithEpisodes.details === 'object') {
          // Organize episodes by season
          const seasonMap = {};
          episodes.forEach(ep => {
            if (!seasonMap[ep.season_number]) {
              seasonMap[ep.season_number] = [];
            }
            seasonMap[ep.season_number].push(ep);
          });
          
          // Update seasons in details
          if (showWithEpisodes.details.seasons) {
            showWithEpisodes.details.seasons = showWithEpisodes.details.seasons.map(season => ({
              ...season,
              episodes: seasonMap[season.season_number] || []
            }));
          }
        }
        
        return showWithEpisodes;
      });
      
      console.log(`Found ${shows.length} shows with episodes`);
      
      return {
        body: JSON.stringify({
          movies: movies.slice(0, 50).map(formatMovie),
          shows: shows.slice(0, 50).map(formatTVShow)
        }),
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      };
    } catch (error) {
      console.error('Content fetch error:', error);
      return {
        body: JSON.stringify({ 
          error: 'Failed to fetch content',
          details: error.message,
          stack: error.stack
        }),
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      };
    }
  }

  if (type === 'movie' && id) {
    const movie = await db.collection('movies').findOne({ id: id });
    if (!movie) {
      return {
        body: JSON.stringify({ error: 'Movie not found' }),
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    return {
      body: JSON.stringify(formatMovie(movie)),
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  if (type === 'show' && id) {
    const show = await db.collection('tv_shows').findOne({ id: id });
    if (!show) {
      return {
        body: JSON.stringify({ error: 'Show not found' }),
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    return {
      body: JSON.stringify(formatTVShow(show)),
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  return {
    body: JSON.stringify({ error: 'Invalid request' }),
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  };
}

async function handleSearchApi(request, db, url) {
  const query = url.searchParams.get('q');
  const type = url.searchParams.get('type');
  const language = url.searchParams.get('language');
  
  if (!query) {
    return {
      body: JSON.stringify({ error: 'Query parameter required' }),
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const searchFilter = {
    $text: { $search: query }
  };
  
  if (language) {
    searchFilter.language = language.toLowerCase();
  }

  const results = [];
  
  if (!type || type === 'movie') {
    const movies = await db.collection('movies')
      .find(searchFilter)
      .limit(20)
      .toArray();
    results.push(...movies.map(m => ({ ...formatMovie(m), type: 'movie' })));
  }
  
  if (!type || type === 'show') {
    const shows = await db.collection('tv_shows')
      .find(searchFilter)
      .limit(20)
      .toArray();
    results.push(...shows.map(s => ({ ...formatTVShow(s), type: 'show' })));
  }

  return {
    body: JSON.stringify({ results }),
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  };
}

async function handleUserApi(request, db, user) {
  if (!user) {
    return {
      body: JSON.stringify({ error: 'Authentication required' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  // Get or create user
  const userData = await db.collection('users').findOneAndUpdate(
    { telegram_id: user.id },
    {
      $set: {
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        last_seen: new Date()
      },
      $setOnInsert: {
        created_at: new Date(),
        preferences: {
          language: 'english',
          autoplay: true,
          quality: 'auto'
        }
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Get watch history
  const watchHistory = await db.collection('watch_history')
    .find({ user_id: user.id })
    .sort({ last_watched: -1 })
    .limit(20)
    .toArray();

  return {
    body: JSON.stringify({
      user: userData.value,
      watchHistory
    }),
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  };
}

async function handleWatchApi(request, db, params, user) {
  if (!user) {
    return {
      body: JSON.stringify({ error: 'Authentication required' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const [action, contentId] = params;
  
  if (action === 'progress' && request.method === 'POST') {
    const { progress, season, episode } = await request.json();
    
    await db.collection('watch_history').updateOne(
      { user_id: user.id, content_id: contentId },
      {
        $set: {
          progress,
          season,
          episode,
          last_watched: new Date()
        }
      },
      { upsert: true }
    );
    
    return {
      body: JSON.stringify({ success: true }),
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  return {
    body: JSON.stringify({ error: 'Invalid request' }),
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  };
}

// Helper functions
function formatMovie(movie) {
  return {
    id: movie._id,
    title: movie.title,
    overview: movie.details?.overview || '',
    posterPath: movie.details?.poster_path || '',
    backdropPath: movie.details?.backdrop_path || '',
    releaseDate: movie.details?.release_date || '',
    runtime: movie.details?.runtime || 0,
    genres: movie.details?.genres || [],
    language: movie.language,
    hasFile: !!movie.file_id
  };
}

function formatTVShow(show) {
  return {
    id: show._id,
    title: show.title,
    overview: show.details?.overview || '',
    posterPath: show.details?.poster_path || '',
    backdropPath: show.details?.backdrop_path || '',
    firstAirDate: show.details?.first_air_date || '',
    seasons: show.details?.seasons?.map(s => ({
      seasonNumber: s.season_number,
      episodeCount: s.episode_count,
      episodes: Object.values(s.episodes || {}).filter(e => e.file_id)
    })) || [],
    genres: show.details?.genres || [],
    language: show.language
  };
}
