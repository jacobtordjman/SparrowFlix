// functions/api/index.js - Updated with access control (Phase 2.2)
import { D1Database } from '../db/d1-connection.js';
import { AuthSystem, verifyTelegramWebAppData, createOrUpdateUser } from '../utils/auth-unified.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { AccessControl } from '../utils/access-control.js';
import { handleChannelsApi } from './channels.js';
import { handleTicketApi } from './ticket.js';
import { HLSStreamer } from '../streaming/hls-streamer.js';
import { ContentMigrator } from '../migration/content-migrator.js';

export async function handleApiRequest(request, env, path) {
  const db = new D1Database(env.DB);
  const url = new URL(request.url);
  
  // Extract API path
  const apiPath = path.replace('/api/', '');
  const [resource, ...params] = apiPath.split('/');

  // Initialize security systems
  const authSystem = new AuthSystem(env.JWT_SECRET || 'fallback-secret', db);
  const rateLimiter = new RateLimiter(db);
  const accessControl = new AccessControl(db);
  
  // Extract client info for security
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   '127.0.0.1';
  
  // Check IP blacklist first
  const blacklistCheck = await rateLimiter.isBlacklisted(clientIP);
  if (blacklistCheck.blacklisted) {
    return {
      body: JSON.stringify({ 
        error: 'Access denied', 
        reason: blacklistCheck.reason 
      }),
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  // Determine rate limit type based on endpoint
  let limitType = 'api_general';
  switch (resource) {
    case 'content': limitType = 'api_content'; break;
    case 'search': limitType = 'api_search'; break;
    case 'ticket': limitType = 'api_ticket'; break;
    case 'auth': limitType = 'api_auth'; break;
    case 'upload': limitType = 'api_upload'; break;
  }

  // Pre-auth user extraction for rate limiting
  let userId = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = authSystem.verifyAccessToken(token);
    userId = payload?.userId;
  }

  // Check rate limits
  const rateLimitResult = await rateLimiter.checkRateLimit(request, limitType, userId);
  if (!rateLimitResult.allowed) {
    return {
      body: JSON.stringify({ 
        error: 'Rate limit exceeded', 
        reason: rateLimitResult.reason,
        retryAfter: rateLimitResult.retryAfter
      }),
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitResult.headers
      }
    };
  }
  
  // Define which routes require authentication
  const protectedRoutes = ['user', 'watch', 'profile'];
  const requiresAuth = protectedRoutes.includes(resource);
  
  let user = null;
  let authResponse = null;

  // Handle authentication for protected routes
  if (requiresAuth) {
    authResponse = await authSystem.authenticate(request);
    
    if (!authResponse.success) {
      return {
        body: JSON.stringify({ error: 'Unauthorized', details: authResponse.error }),
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    user = authResponse.user;
  }

  // Check for abuse patterns (async, don't block request)
  rateLimiter.checkAbusePatterns(clientIP, userId).catch(error => {
    console.error('Abuse detection error:', error);
  });

  let response;
  try {
    switch (resource) {
      case 'auth':
        response = await handleAuthApi(request, db, authSystem, params, env);
        break;
        
      case 'content':
        // Check content read permission
        const contentAccess = await accessControl.requirePermission(user?.id, 'content:read');
        if (!contentAccess.allowed) {
          return createAccessDeniedResponse(contentAccess);
        }
        response = await handleContentApi(request, db, params, user);
        break;
      
      case 'search':
        // Check search permission
        const searchAccess = await accessControl.requirePermission(user?.id, 'search:read');
        if (!searchAccess.allowed) {
          return createAccessDeniedResponse(searchAccess);
        }
        response = await handleSearchApi(request, db, url);
        break;
      
      case 'user':
        // Check profile access
        const profileAccess = await accessControl.requirePermission(user?.id, 'profile:read');
        if (!profileAccess.allowed) {
          return createAccessDeniedResponse(profileAccess);
        }
        response = await handleUserApi(request, db, user, accessControl);
        break;
      
      case 'watch':
        // Check watch history access
        const watchAccess = await accessControl.requirePermission(user?.id, 'watch:read');
        if (!watchAccess.allowed) {
          return createAccessDeniedResponse(watchAccess);
        }
        response = await handleWatchApi(request, db, params, user);
        break;

      case 'ticket':
        // Check ticket creation permission
        const ticketAccess = await accessControl.requirePermission(user?.id, 'ticket:create');
        if (!ticketAccess.allowed) {
          return createAccessDeniedResponse(ticketAccess);
        }
        response = await handleTicketApi(request, env, params, user);
        break;

      case 'channels':
        // Check content read permission for channels
        const channelAccess = await accessControl.requirePermission(user?.id, 'content:read');
        if (!channelAccess.allowed) {
          return createAccessDeniedResponse(channelAccess);
        }
        response = await handleChannelsApi(request, db, params, user, env);
        break;

      case 'admin':
        // Admin panel - requires admin permissions
        const adminAccess = await accessControl.requireAdminAccess(user?.id);
        if (!adminAccess.allowed) {
          return createAccessDeniedResponse(adminAccess);
        }
        response = await handleAdminApi(request, db, params, user, accessControl);
        break;

      case 'login':
        response = await handleLoginApi(request, db, env);
        break;

      case 'register':
        response = await handleRegisterApi(request, db, env);
        break;

      case 'stream':
        // Streaming endpoints - check stream permission
        const streamAccess = await accessControl.requirePermission(user?.id, 'stream:read');
        if (!streamAccess.allowed) {
          return createAccessDeniedResponse(streamAccess);
        }
        response = await handleStreamingApi(request, env, params, user);
        break;

      case 'bandwidth-test':
        // Bandwidth testing endpoint
        response = await handleBandwidthTest(request);
        break;

      case 'migration':
        // Content migration endpoints - admin only
        const migrationAccess = await accessControl.requireAdminAccess(user?.id);
        if (!migrationAccess.allowed) {
          return createAccessDeniedResponse(migrationAccess);
        }
        response = await handleMigrationApi(request, env, params, user);
        break;

      case 'cdn-status':
        // CDN health status - public endpoint
        response = await handleCDNStatusApi(request, env);
        break;

      default:
        response = {
          body: JSON.stringify({ error: 'Not found' }),
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        };
    }

    // Add rate limit headers to successful responses
    if (rateLimitResult.headers) {
      response.headers = {
        ...response.headers,
        ...rateLimitResult.headers
      };
    }

    return response;
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
    // Get all content using native D1 queries
    try {
      console.log('Fetching content with native D1...');
      
      // Get movies with files
      const movies = await db.getAllMovies();
      const moviesWithFiles = movies.filter(movie => movie.file_id && movie.file_id.trim() !== '');
      
      console.log(`Found ${moviesWithFiles.length} movies with files`);
      
      // Get TV shows
      const shows = await db.getAllShows();
      console.log(`Found ${shows.length} TV shows`);
      
      // Get episodes and group by show
      const showsWithEpisodes = await Promise.all(
        shows.map(async (show) => {
          const episodes = await db.getEpisodesByShow(show.id);
          return {
            ...show,
            episodes: episodes.filter(ep => ep.file_id && ep.file_id.trim() !== '')
          };
        })
      );
      
      const showsWithContent = showsWithEpisodes.filter(show => show.episodes.length > 0);
      console.log(`Found ${showsWithContent.length} shows with episodes`);
      
      return {
        body: JSON.stringify({
          movies: moviesWithFiles.slice(0, 50).map(formatMovie),
          shows: showsWithContent.slice(0, 50).map(formatTVShow)
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
    const movie = await db.getMovieById(id);
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
    const show = await db.getShowById(id);
    if (!show) {
      return {
        body: JSON.stringify({ error: 'Show not found' }),
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    // Get episodes for the show
    const episodes = await db.getEpisodesByShow(id);
    const showWithEpisodes = { ...show, episodes };
    
    return {
      body: JSON.stringify(formatTVShow(showWithEpisodes)),
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

  const filter = user.first_name ? { telegram_id: user.id } : { id: user.id };
  const update = {
    $set: {
      username: user.username,
      ...(user.first_name ? {
        first_name: user.first_name,
        last_name: user.last_name,
      } : {}),
      last_seen: new Date(),
    },
    $setOnInsert: {
      created_at: new Date(),
      preferences: {
        language: 'english',
        autoplay: true,
        quality: 'auto'
      }
    }
  };

  const userData = await db.collection('users').findOneAndUpdate(
    filter,
    update,
    { upsert: true, returnDocument: 'after' }
  );

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

// New Unified Authentication API (Phase 1.3)
async function handleAuthApi(request, db, authSystem, params, env) {
  const [action] = params;
  
  switch (action) {
    case 'login':
      return await handleAuthLogin(request, db, authSystem);
    case 'refresh':
      return await handleAuthRefresh(request, db, authSystem);
    case 'logout':
      return await handleAuthLogout(request, db, authSystem);
    case 'telegram':
      return await handleAuthTelegram(request, db, authSystem, env);
    default:
      return {
        body: JSON.stringify({ error: 'Invalid auth action' }),
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      };
  }
}

async function handleAuthTelegram(request, db, authSystem, env) {
  if (request.method !== 'POST') {
    return {
      body: JSON.stringify({ error: 'Method not allowed' }),
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const { initData } = await request.json();
  
  if (!initData) {
    return {
      body: JSON.stringify({ error: 'Missing initData' }),
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  // Verify Telegram data
  const telegramUser = verifyTelegramWebAppData(initData, env.BOT_TOKEN);
  
  if (!telegramUser) {
    return {
      body: JSON.stringify({ error: 'Invalid Telegram data' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  // Create or update user
  const userId = await createOrUpdateUser(db, telegramUser);
  
  // Generate tokens
  const userAgent = request.headers.get('User-Agent') || '';
  const accessToken = authSystem.generateAccessToken(userId, {
    username: telegramUser.username,
    firstName: telegramUser.first_name
  });
  const refreshToken = await authSystem.generateRefreshToken(userId, userAgent);

  // Set HTTP-only cookies
  const cookieHeaders = authSystem.generateCookieHeaders(accessToken, refreshToken);

  return {
    body: JSON.stringify({ 
      success: true,
      user: {
        id: userId,
        username: telegramUser.username,
        firstName: telegramUser.first_name
      }
    }),
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...cookieHeaders
    }
  };
}

async function handleAuthRefresh(request, db, authSystem) {
  if (request.method !== 'POST') {
    return {
      body: JSON.stringify({ error: 'Method not allowed' }),
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return {
      body: JSON.stringify({ error: 'No refresh token' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const cookies = authSystem.parseCookies(cookieHeader);
  const refreshTokenString = cookies.refresh_token;
  
  if (!refreshTokenString) {
    return {
      body: JSON.stringify({ error: 'No refresh token' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const [tokenId, token] = refreshTokenString.split(':', 2);
  const rotationResult = await authSystem.verifyAndRotateRefreshToken(tokenId, token);

  if (!rotationResult) {
    return {
      body: JSON.stringify({ error: 'Invalid refresh token' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const cookieHeaders = authSystem.generateCookieHeaders(
    rotationResult.accessToken, 
    rotationResult.refreshToken
  );

  return {
    body: JSON.stringify({ success: true }),
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...cookieHeaders
    }
  };
}

async function handleAuthLogout(request, db, authSystem) {
  if (request.method !== 'POST') {
    return {
      body: JSON.stringify({ error: 'Method not allowed' }),
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = authSystem.parseCookies(cookieHeader);
    const refreshTokenString = cookies.refresh_token;
    
    if (refreshTokenString) {
      const [tokenId] = refreshTokenString.split(':', 2);
      await authSystem.revokeRefreshToken(tokenId);
    }
  }

  return {
    body: JSON.stringify({ success: true }),
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': [
        'access_token=; HttpOnly; Path=/; Max-Age=0',
        'refresh_token=; HttpOnly; Path=/; Max-Age=0'
      ]
    }
  };
}

// Legacy handlers - to be removed
async function handleRegisterApi(request, db, env) {
  const { username, password, oauthToken } = await request.json();

  if (!username || (!password && !oauthToken)) {
    return {
      body: JSON.stringify({ error: 'Invalid request' }),
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const existing = await db.collection('users').findOne({ username });
  if (existing) {
    return {
      body: JSON.stringify({ error: 'User exists' }),
      status: 409,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const userData = { username, created_at: new Date() };
  if (password) {
    userData.password = hashPassword(password);
  }
  if (oauthToken) {
    userData.oauth_token = oauthToken;
  }

  const result = await db.collection('users').insertOne(userData);
  const token = generateWebToken({ id: result.insertedId, username }, env.JWT_SECRET);
  return {
    body: JSON.stringify({ token }),
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; HttpOnly; Path=/; Max-Age=604800`
    }
  };
}

async function handleLoginApi(request, db, env) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return {
      body: JSON.stringify({ error: 'Invalid request' }),
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const user = await db.collection('users').findOne({ username });
  if (!user || !user.password || !verifyPassword(password, user.password)) {
    return {
      body: JSON.stringify({ error: 'Invalid credentials' }),
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const token = generateWebToken({ id: user.id || user._id, username }, env.JWT_SECRET);
  return {
    body: JSON.stringify({ token }),
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; HttpOnly; Path=/; Max-Age=604800`
    }
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

// Helper function for access denied responses
function createAccessDeniedResponse(accessResult) {
  return {
    body: JSON.stringify({
      error: 'Access denied',
      message: accessResult.error,
      requiredPermission: accessResult.requiredPermission
    }),
    status: 403,
    headers: { 'Content-Type': 'application/json' }
  };
}

// Admin API handler (new for RBAC)
async function handleAdminApi(request, db, params, user, accessControl) {
  const [action, ...subParams] = params;
  
  switch (action) {
    case 'users':
      return await handleAdminUsers(request, db, user, accessControl, subParams);
    case 'permissions':
      return await handleAdminPermissions(request, db, user, accessControl, subParams);
    case 'security':
      return await handleAdminSecurity(request, db, user, accessControl, subParams);
    case 'analytics':
      return await handleAdminAnalytics(request, db, user, accessControl);
    default:
      return {
        body: JSON.stringify({ error: 'Invalid admin action' }),
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      };
  }
}

// Admin user management
async function handleAdminUsers(request, db, user, accessControl, params) {
  const [userId] = params;
  
  if (request.method === 'GET') {
    // Get all users with roles
    const users = await accessControl.getAllUsersWithRoles();
    return {
      body: JSON.stringify({ users }),
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  if (request.method === 'PUT' && userId) {
    // Update user role
    const { role } = await request.json();
    
    if (!role) {
      return {
        body: JSON.stringify({ error: 'Role required' }),
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    try {
      await accessControl.updateUserRole(userId, role, user.id);
      return {
        body: JSON.stringify({ success: true, message: 'Role updated' }),
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      };
    } catch (error) {
      return {
        body: JSON.stringify({ error: error.message }),
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      };
    }
  }
  
  return {
    body: JSON.stringify({ error: 'Method not allowed' }),
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  };
}

// Admin security monitoring
async function handleAdminSecurity(request, db, user, accessControl, params) {
  const [action] = params;
  
  if (action === 'audit') {
    // Get security audit log
    const url = new URL(request.url);
    const filters = {
      eventType: url.searchParams.get('type'),
      severity: url.searchParams.get('severity'),
      since: url.searchParams.get('since') ? parseInt(url.searchParams.get('since')) : undefined
    };
    
    const auditLog = await accessControl.getSecurityAuditLog(filters);
    
    return {
      body: JSON.stringify({ auditLog }),
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  return {
    body: JSON.stringify({ error: 'Invalid security action' }),
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  };
}

// Handle streaming API requests (Phase 4.2)
async function handleStreamingApi(request, env, params, user) {
  const streamer = new HLSStreamer(env);
  const [action, movieId, quality, segment] = params;

  try {
    switch (action) {
      case 'playlist':
        // Get HLS playlist for a movie
        if (!movieId) {
          return {
            body: JSON.stringify({ error: 'Movie ID required' }),
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          };
        }

        const userAgent = {
          isMobile: request.headers.get('User-Agent')?.includes('Mobile') || false,
          connectionType: request.headers.get('Network-Information') || 'unknown'
        };

        return await streamer.getStreamingResponse(movieId, quality, userAgent);

      case 'segment':
        // Get specific HLS segment
        if (!movieId || !quality || segment === undefined) {
          return {
            body: JSON.stringify({ error: 'Missing parameters' }),
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          };
        }

        return await streamer.getHLSSegment(movieId, quality, parseInt(segment));

      case 'stats':
        // Get streaming statistics
        const stats = await streamer.getStreamingStats();
        return {
          body: JSON.stringify(stats),
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        };

      default:
        return {
          body: JSON.stringify({ error: 'Invalid streaming action' }),
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        };
    }
  } catch (error) {
    console.error('Streaming API error:', error);
    return {
      body: JSON.stringify({ error: 'Streaming error', details: error.message }),
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

// Handle bandwidth test requests (Phase 4.2)
async function handleBandwidthTest(request) {
  const streamer = new HLSStreamer({});
  return await streamer.handleBandwidthTest(request);
}

// Handle content migration API requests (Phase 4.1)
async function handleMigrationApi(request, env, params, user) {
  const migrator = new ContentMigrator(env);
  const [action] = params;

  try {
    switch (action) {
      case 'start':
        // Start migration process
        const body = await request.json();
        const result = await migrator.startMigration(body);
        return {
          body: JSON.stringify(result),
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        };

      case 'status':
        // Get migration statistics
        const stats = await migrator.getMigrationStats();
        return {
          body: JSON.stringify(stats),
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        };

      case 'item':
        // Get migration status for specific movie  
        const movieId = new URL(request.url).searchParams.get('movieId');
        if (!movieId) {
          return {
            body: JSON.stringify({ error: 'Movie ID required' }),
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          };
        }

        const itemStatus = await migrator.getMigrationStatus(movieId);
        return {
          body: JSON.stringify(itemStatus),
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        };

      case 'rollback':
        // Rollback migration for a movie
        const rollbackBody = await request.json();
        const rollbackResult = await migrator.rollbackMigration(rollbackBody.movieId);
        return {
          body: JSON.stringify(rollbackResult),
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        };

      default:
        return {
          body: JSON.stringify({ error: 'Invalid migration action' }),
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        };
    }
  } catch (error) {
    console.error('Migration API error:', error);
    return {
      body: JSON.stringify({ error: 'Migration error', details: error.message }),
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

// Handle CDN status API requests (Phase 4.1)
async function handleCDNStatusApi(request, env) {
  const streamer = new HLSStreamer(env);
  
  try {
    const healthStatus = await streamer.healthCheck();
    return {
      body: JSON.stringify(healthStatus),
      status: healthStatus.status === 'healthy' ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('CDN status error:', error);
    return {
      body: JSON.stringify({ 
        status: 'error', 
        error: error.message,
        timestamp: Date.now()
      }),
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    };
  }
}
