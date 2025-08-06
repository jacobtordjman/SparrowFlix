// functions/cache/cache-manager.js - Multi-Layer Caching System (Phase 6.1)

/**
 * Comprehensive Caching System for SparrowFlix
 * Implements multi-layer caching: Memory → KV → Database → CDN
 * Optimized for Cloudflare Workers free tier limitations
 */

export class CacheManager {
  constructor(env) {
    this.env = env;
    this.kv = env.FILEPATH_CACHE; // Reuse existing KV namespace
    this.memoryCache = new Map();
    this.maxMemoryCacheSize = 100; // Limit memory cache to prevent worker memory issues
    this.defaultTTL = 60 * 60; // 1 hour default TTL
    
    // Cache configuration by type
    this.cacheConfig = {
      movies: { ttl: 30 * 60, prefix: 'movie:' }, // 30 minutes
      shows: { ttl: 30 * 60, prefix: 'show:' }, // 30 minutes  
      episodes: { ttl: 60 * 60, prefix: 'episode:' }, // 1 hour
      tickets: { ttl: 5 * 60, prefix: 'ticket:' }, // 5 minutes
      user_data: { ttl: 10 * 60, prefix: 'user:' }, // 10 minutes
      streaming_urls: { ttl: 2 * 60, prefix: 'stream:' }, // 2 minutes
      search_results: { ttl: 15 * 60, prefix: 'search:' }, // 15 minutes
      cdn_metadata: { ttl: 24 * 60 * 60, prefix: 'cdn:' }, // 24 hours
      api_responses: { ttl: 5 * 60, prefix: 'api:' }, // 5 minutes
      bot_stats: { ttl: 60, prefix: 'bot:' } // 1 minute
    };
  }

  /**
   * Get cached data with multi-layer fallback
   * @param {string} key - Cache key
   * @param {string} type - Cache type (affects TTL and prefixing)
   * @param {Function} dataProvider - Function to fetch data if not cached
   */
  async get(key, type = 'api_responses', dataProvider = null) {
    const config = this.cacheConfig[type] || { ttl: this.defaultTTL, prefix: '' };
    const fullKey = `${config.prefix}${key}`;
    
    try {
      // Layer 1: Memory cache (fastest)
      const memoryResult = this.getFromMemory(fullKey);
      if (memoryResult !== null) {
        console.log(`Cache HIT (Memory): ${fullKey}`);
        return memoryResult;
      }
      
      // Layer 2: KV cache (fast, persistent)
      const kvResult = await this.getFromKV(fullKey);
      if (kvResult !== null) {
        console.log(`Cache HIT (KV): ${fullKey}`);
        // Store in memory cache for next time
        this.setInMemory(fullKey, kvResult, config.ttl);
        return kvResult;
      }
      
      // Layer 3: Data provider (database/API call)
      if (dataProvider && typeof dataProvider === 'function') {
        console.log(`Cache MISS: ${fullKey} - Fetching from source`);
        const freshData = await dataProvider();
        
        if (freshData !== null && freshData !== undefined) {
          // Store in all cache layers
          await this.set(key, freshData, type);
          return freshData;
        }
      }
      
      console.log(`Cache MISS: ${fullKey} - No data available`);
      return null;
      
    } catch (error) {
      console.error(`Cache GET error for ${fullKey}:`, error);
      // Fallback to data provider on cache error
      if (dataProvider && typeof dataProvider === 'function') {
        return await dataProvider();
      }
      return null;
    }
  }

  /**
   * Set data in all cache layers
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {string} type - Cache type
   */
  async set(key, data, type = 'api_responses') {
    const config = this.cacheConfig[type] || { ttl: this.defaultTTL, prefix: '' };
    const fullKey = `${config.prefix}${key}`;
    
    try {
      // Store in memory cache
      this.setInMemory(fullKey, data, config.ttl);
      
      // Store in KV cache with expiration
      await this.setInKV(fullKey, data, config.ttl);
      
      console.log(`Cache SET: ${fullKey} (TTL: ${config.ttl}s)`);
      
    } catch (error) {
      console.error(`Cache SET error for ${fullKey}:`, error);
    }
  }

  /**
   * Memory cache operations
   */
  getFromMemory(key) {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    
    // Check expiration
    if (Date.now() > cached.expires) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setInMemory(key, data, ttl) {
    // Clean up old entries if cache is full
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      this.cleanupMemoryCache();
    }
    
    this.memoryCache.set(key, {
      data: data,
      expires: Date.now() + (ttl * 1000),
      created: Date.now()
    });
  }

  /**
   * KV cache operations
   */
  async getFromKV(key) {
    try {
      const cached = await this.kv.get(key, { type: 'json' });
      if (!cached) return null;
      
      // KV handles expiration automatically, so if we get data, it's valid
      return cached;
    } catch (error) {
      console.error(`KV GET error for ${key}:`, error);
      return null;
    }
  }

  async setInKV(key, data, ttl) {
    try {
      await this.kv.put(key, JSON.stringify(data), {
        expirationTtl: ttl
      });
    } catch (error) {
      console.error(`KV PUT error for ${key}:`, error);
    }
  }

  /**
   * Invalidate cache entries
   * @param {string} key - Cache key or pattern
   * @param {string} type - Cache type
   */
  async invalidate(key, type = 'api_responses') {
    const config = this.cacheConfig[type] || { ttl: this.defaultTTL, prefix: '' };
    const fullKey = `${config.prefix}${key}`;
    
    try {
      // Remove from memory cache
      this.memoryCache.delete(fullKey);
      
      // Remove from KV cache
      await this.kv.delete(fullKey);
      
      console.log(`Cache INVALIDATED: ${fullKey}`);
      
    } catch (error) {
      console.error(`Cache INVALIDATE error for ${fullKey}:`, error);
    }
  }

  /**
   * Invalidate multiple cache entries by pattern
   * @param {string} pattern - Key pattern to match
   * @param {string} type - Cache type
   */
  async invalidatePattern(pattern, type = 'api_responses') {
    const config = this.cacheConfig[type] || { ttl: this.defaultTTL, prefix: '' };
    const fullPattern = `${config.prefix}${pattern}`;
    
    try {
      // Clear memory cache entries matching pattern
      for (const [key] of this.memoryCache) {
        if (key.includes(fullPattern)) {
          this.memoryCache.delete(key);
        }
      }
      
      // Note: KV doesn't support pattern deletion efficiently
      // For now, we'll rely on TTL expiration
      console.log(`Cache PATTERN INVALIDATED: ${fullPattern}`);
      
    } catch (error) {
      console.error(`Cache PATTERN INVALIDATE error for ${fullPattern}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memoryStats = {
      size: this.memoryCache.size,
      maxSize: this.maxMemoryCacheSize,
      keys: Array.from(this.memoryCache.keys())
    };
    
    return {
      memory: memoryStats,
      config: this.cacheConfig
    };
  }

  /**
   * Clean up expired entries from memory cache
   */
  cleanupMemoryCache() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, value] of this.memoryCache) {
      if (now > value.expires) {
        toDelete.push(key);
      }
    }
    
    // If we still need space after removing expired items, remove oldest items
    if (toDelete.length === 0 && this.memoryCache.size >= this.maxMemoryCacheSize) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].created - b[1].created);
      
      // Remove oldest 25% of entries
      const removeCount = Math.floor(this.maxMemoryCacheSize * 0.25);
      for (let i = 0; i < removeCount; i++) {
        toDelete.push(entries[i][0]);
      }
    }
    
    toDelete.forEach(key => this.memoryCache.delete(key));
    
    if (toDelete.length > 0) {
      console.log(`Memory cache cleanup: removed ${toDelete.length} entries`);
    }
  }

  /**
   * Preload frequently accessed data
   * @param {Array} preloadConfigs - Array of {key, type, dataProvider} objects
   */
  async preload(preloadConfigs) {
    const preloadPromises = preloadConfigs.map(async ({ key, type, dataProvider }) => {
      try {
        await this.get(key, type, dataProvider);
      } catch (error) {
        console.error(`Preload error for ${key}:`, error);
      }
    });
    
    await Promise.allSettled(preloadPromises);
    console.log(`Preloaded ${preloadConfigs.length} cache entries`);
  }

  /**
   * Cache warming for popular content
   * @param {Function} getPopularContent - Function that returns popular content IDs
   * @param {Function} getContentData - Function that fetches content data by ID
   */
  async warmCache(getPopularContent, getContentData) {
    try {
      const popularItems = await getPopularContent();
      
      const warmingPromises = popularItems.map(async (item) => {
        const cacheKey = `${item.type}_${item.id}`;
        await this.get(cacheKey, item.type, () => getContentData(item.id, item.type));
      });
      
      await Promise.allSettled(warmingPromises);
      console.log(`Cache warmed with ${popularItems.length} popular items`);
      
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  /**
   * Generate cache key for complex queries
   * @param {string} baseKey - Base cache key
   * @param {Object} params - Query parameters
   */
  generateKey(baseKey, params = {}) {
    if (Object.keys(params).length === 0) {
      return baseKey;
    }
    
    // Sort parameters for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return `${baseKey}?${sortedParams}`;
  }

  /**
   * Cache-aside pattern helper
   * @param {string} key - Cache key
   * @param {string} type - Cache type
   * @param {Function} dataProvider - Function to fetch data
   * @param {Object} options - Additional options
   */
  async cacheAside(key, type, dataProvider, options = {}) {
    const { 
      forceRefresh = false, 
      onCacheHit = null,
      onCacheMiss = null 
    } = options;
    
    if (!forceRefresh) {
      const cached = await this.get(key, type);
      if (cached !== null) {
        if (onCacheHit) onCacheHit(key, cached);
        return cached;
      }
    }
    
    // Cache miss or force refresh
    if (onCacheMiss) onCacheMiss(key);
    
    const freshData = await dataProvider();
    if (freshData !== null && freshData !== undefined) {
      await this.set(key, freshData, type);
    }
    
    return freshData;
  }
}

/**
 * Content-specific caching helpers
 */
export class ContentCache {
  constructor(cacheManager) {
    this.cache = cacheManager;
  }

  /**
   * Cache movie data with related metadata
   */
  async getMovie(movieId, dataProvider) {
    return await this.cache.get(`movie_${movieId}`, 'movies', dataProvider);
  }

  async setMovie(movieId, movieData) {
    await this.cache.set(`movie_${movieId}`, movieData, 'movies');
    // Also cache in search results if it has searchable content
    if (movieData.title) {
      const searchKey = this.cache.generateKey('search', { 
        q: movieData.title.toLowerCase().substring(0, 20),
        type: 'movie' 
      });
      await this.cache.invalidatePattern(searchKey, 'search_results');
    }
  }

  /**
   * Cache TV show data with episodes
   */
  async getShow(showId, dataProvider) {
    return await this.cache.get(`show_${showId}`, 'shows', dataProvider);
  }

  async setShow(showId, showData) {
    await this.cache.set(`show_${showId}`, showData, 'shows');
    // Invalidate related episode caches
    await this.cache.invalidatePattern(`episode_${showId}_`, 'episodes');
  }

  /**
   * Cache episode data
   */
  async getEpisode(showId, season, episode, dataProvider) {
    const key = `episode_${showId}_${season}_${episode}`;
    return await this.cache.get(key, 'episodes', dataProvider);
  }

  /**
   * Cache streaming ticket
   */
  async getTicket(ticketId, dataProvider) {
    return await this.cache.get(`ticket_${ticketId}`, 'tickets', dataProvider);
  }

  async setTicket(ticketId, ticketData) {
    await this.cache.set(`ticket_${ticketId}`, ticketData, 'tickets');
  }

  /**
   * Cache search results
   */
  async getSearchResults(query, filters, dataProvider) {
    const searchKey = this.cache.generateKey('search', { q: query, ...filters });
    return await this.cache.get(searchKey, 'search_results', dataProvider);
  }

  /**
   * Cache user-specific data
   */
  async getUserData(userId, dataType, dataProvider) {
    const key = `user_${userId}_${dataType}`;
    return await this.cache.get(key, 'user_data', dataProvider);
  }

  /**
   * Invalidate user-related caches when user data changes
   */
  async invalidateUserCache(userId) {
    await this.cache.invalidatePattern(`user_${userId}_`, 'user_data');
  }
}