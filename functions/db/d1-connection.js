// functions/db/d1-connection.js - Native D1 Database Connection (Phase 1.2)
// Replaces MongoDB wrapper with native SQLite prepared statements

export class D1Database {
  constructor(d1Binding) {
    this.db = d1Binding;
  }

  // Movies Operations
  async getAllMovies(limit = 50, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT id, title, year, poster_url, tmdb_id, file_id, 
             details, created_at, updated_at 
      FROM movies 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const result = await stmt.bind(limit, offset).all();
    if (!result.success) {
      throw new Error(`Failed to fetch movies: ${result.error}`);
    }
    
    return result.results.map(this.parseMovieRow);
  }

  async getMovieById(id) {
    const stmt = this.db.prepare(`
      SELECT id, title, year, poster_url, tmdb_id, file_id, 
             details, created_at, updated_at 
      FROM movies 
      WHERE id = ?
    `);
    
    const result = await stmt.bind(id).first();
    return result ? this.parseMovieRow(result) : null;
  }

  async searchMovies(searchTerm) {
    const stmt = this.db.prepare(`
      SELECT id, title, year, poster_url, tmdb_id, file_id, 
             details, created_at, updated_at 
      FROM movies 
      WHERE title LIKE ? OR details LIKE ?
      ORDER BY title ASC
    `);
    
    const term = `%${searchTerm}%`;
    const result = await stmt.bind(term, term).all();
    if (!result.success) {
      throw new Error(`Failed to search movies: ${result.error}`);
    }
    
    return result.results.map(this.parseMovieRow);
  }

  async createMovie(movieData) {
    const { title, year, poster_url, tmdb_id, file_id, details } = movieData;
    const id = `movie_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO movies (id, title, year, poster_url, tmdb_id, file_id, details, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = await stmt.bind(
      id, title, year, poster_url, tmdb_id, file_id, 
      JSON.stringify(details || {}), now, now
    ).run();
    
    if (!result.success) {
      throw new Error(`Failed to create movie: ${result.error}`);
    }
    
    return { id, insertedId: id };
  }

  async updateMovie(id, updateData) {
    const { title, year, poster_url, tmdb_id, file_id, details } = updateData;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      UPDATE movies 
      SET title = ?, year = ?, poster_url = ?, tmdb_id = ?, file_id = ?, 
          details = ?, updated_at = ?
      WHERE id = ?
    `);
    
    const result = await stmt.bind(
      title, year, poster_url, tmdb_id, file_id, 
      JSON.stringify(details || {}), now, id
    ).run();
    
    if (!result.success) {
      throw new Error(`Failed to update movie: ${result.error}`);
    }
    
    return { modifiedCount: result.changes };
  }

  // TV Shows Operations
  async getAllShows(limit = 50, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT id, title, year, poster_url, tmdb_id, total_seasons,
             details, created_at, updated_at 
      FROM tv_shows 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const result = await stmt.bind(limit, offset).all();
    if (!result.success) {
      throw new Error(`Failed to fetch TV shows: ${result.error}`);
    }
    
    return result.results.map(this.parseShowRow);
  }

  async getShowById(id) {
    const stmt = this.db.prepare(`
      SELECT id, title, year, poster_url, tmdb_id, total_seasons,
             details, created_at, updated_at 
      FROM tv_shows 
      WHERE id = ?
    `);
    
    const result = await stmt.bind(id).first();
    return result ? this.parseShowRow(result) : null;
  }

  async createShow(showData) {
    const { title, year, poster_url, tmdb_id, total_seasons, details } = showData;
    const id = `show_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO tv_shows (id, title, year, poster_url, tmdb_id, total_seasons, details, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = await stmt.bind(
      id, title, year, poster_url, tmdb_id, total_seasons,
      JSON.stringify(details || {}), now, now
    ).run();
    
    if (!result.success) {
      throw new Error(`Failed to create TV show: ${result.error}`);
    }
    
    return { id, insertedId: id };
  }

  // Episodes Operations
  async getEpisodesByShow(showId, seasonNumber = null) {
    let query = `
      SELECT id, show_id, season_number, episode_number, title, file_id,
             file_info, created_at, updated_at 
      FROM episodes 
      WHERE show_id = ?
    `;
    let params = [showId];
    
    if (seasonNumber !== null) {
      query += ` AND season_number = ?`;
      params.push(seasonNumber);
    }
    
    query += ` ORDER BY season_number ASC, episode_number ASC`;
    
    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).all();
    
    if (!result.success) {
      throw new Error(`Failed to fetch episodes: ${result.error}`);
    }
    
    return result.results.map(this.parseEpisodeRow);
  }

  async createEpisode(episodeData) {
    const { show_id, season_number, episode_number, title, file_id, file_info } = episodeData;
    const id = `episode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO episodes (id, show_id, season_number, episode_number, title, file_id, file_info, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = await stmt.bind(
      id, show_id, season_number, episode_number, title, file_id,
      JSON.stringify(file_info || {}), now, now
    ).run();
    
    if (!result.success) {
      throw new Error(`Failed to create episode: ${result.error}`);
    }
    
    return { id, insertedId: id };
  }

  // Statistics
  async getStats() {
    const moviesStmt = this.db.prepare(`SELECT COUNT(*) as count FROM movies`);
    const showsStmt = this.db.prepare(`SELECT COUNT(*) as count FROM tv_shows`);
    const episodesStmt = this.db.prepare(`SELECT COUNT(*) as count FROM episodes`);
    
    const [moviesResult, showsResult, episodesResult] = await Promise.all([
      moviesStmt.first(),
      showsStmt.first(),
      episodesStmt.first()
    ]);
    
    return {
      movies: moviesResult?.count || 0,
      shows: showsResult?.count || 0,
      episodes: episodesResult?.count || 0
    };
  }

  // Utility Methods
  parseMovieRow(row) {
    return {
      ...row,
      _id: row.id, // Compatibility with existing code
      details: row.details ? JSON.parse(row.details) : {}
    };
  }

  parseShowRow(row) {
    return {
      ...row,
      _id: row.id, // Compatibility with existing code
      details: row.details ? JSON.parse(row.details) : {}
    };
  }

  parseEpisodeRow(row) {
    return {
      ...row,
      _id: row.id, // Compatibility with existing code
      file_info: row.file_info ? JSON.parse(row.file_info) : {}
    };
  }

  // Connection method for compatibility
  static async connect(env) {
    return new D1Database(env.DB);
  }
}

// Legacy compatibility wrapper
export async function connectDB(env) {
  return D1Database.connect(env);
}