// migrate-fixed.js - Migration with deduplication and UPSERT
import { MongoClient } from 'mongodb';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function migrateData() {
    console.log('🚀 Starting MongoDB to D1 migration (with deduplication)...');
    
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('sparrowflix');
        
        console.log('📊 Exporting data from MongoDB...');
        
        // Export movies with deduplication
        const moviesRaw = await db.collection('movies').find({}).toArray();
        const movies = deduplicateById(moviesRaw);
        console.log(`Found ${moviesRaw.length} movies, deduplicated to ${movies.length}`);
        
        // Export TV shows with deduplication
        const tvShowsRaw = await db.collection('tv_shows').find({}).toArray();
        const tvShows = deduplicateById(tvShowsRaw);
        console.log(`Found ${tvShowsRaw.length} TV shows, deduplicated to ${tvShows.length}`);
        
        // Export users
        const users = await db.collection('users').find({}).toArray();
        console.log(`Found ${users.length} users`);
        
        // Export watch history
        const watchHistory = await db.collection('watch_history').find({}).toArray();
        console.log(`Found ${watchHistory.length} watch history entries`);
        
        // Generate D1 SQL with INSERT OR REPLACE
        let sqlInserts = '-- SparrowFlix Data Migration to D1 (Fixed)\n\n';
        
        // Movies
        if (movies.length > 0) {
            sqlInserts += '-- Movies\n';
            for (const movie of movies) {
                const id = sanitizeString(movie._id.toString());
                const title = sanitizeString(movie.title || 'Unknown');
                const originalTitle = sanitizeString(movie.original_title || movie.title || 'Unknown');
                const details = movie.details ? sanitizeString(JSON.stringify(movie.details)) : null;
                const language = movie.language || 'english';
                const fileId = movie.file_id || null;
                const channelId = movie.storage_channel_id || movie.channel_id || null;
                const messageId = movie.storage_message_id || movie.channel_message_id || null;
                const fileInfo = movie.file_info ? sanitizeString(JSON.stringify(movie.file_info)) : null;
                const createdAt = movie.created_at ? new Date(movie.created_at).toISOString() : new Date().toISOString();
                const uploadedAt = movie.uploaded_at ? new Date(movie.uploaded_at).toISOString() : null;
                
                sqlInserts += `INSERT OR REPLACE INTO movies (id, title, original_title, file_id, storage_channel_id, storage_message_id, details, language, created_at, uploaded_at, file_info) VALUES ('${id}', '${title}', '${originalTitle}', ${fileId ? `'${fileId}'` : 'NULL'}, ${channelId ? `'${channelId}'` : 'NULL'}, ${messageId || 'NULL'}, ${details ? `'${details}'` : 'NULL'}, '${language}', '${createdAt}', ${uploadedAt ? `'${uploadedAt}'` : 'NULL'}, ${fileInfo ? `'${fileInfo}'` : 'NULL'});\n`;
            }
            sqlInserts += '\n';
        }
        
        // TV Shows and Episodes
        const processedEpisodes = new Set(); // Track episodes to avoid duplicates - moved outside
        if (tvShows.length > 0) {
            sqlInserts += '-- TV Shows\n';
            
            for (const show of tvShows) {
                const id = sanitizeString(show._id.toString());
                const title = sanitizeString(show.title || 'Unknown');
                const originalTitle = sanitizeString(show.original_title || show.title || 'Unknown');
                const details = show.details ? sanitizeString(JSON.stringify(show.details)) : null;
                const language = show.language || 'english';
                const createdAt = show.created_at ? new Date(show.created_at).toISOString() : new Date().toISOString();
                
                sqlInserts += `INSERT OR REPLACE INTO tv_shows (id, title, original_title, details, language, created_at) VALUES ('${id}', '${title}', '${originalTitle}', ${details ? `'${details}'` : 'NULL'}, '${language}', '${createdAt}');\n`;
                
                // Extract episodes from show details
                if (show.details && show.details.seasons) {
                    sqlInserts += `-- Episodes for ${title}\n`;
                    for (const season of show.details.seasons) {
                        if (season.episodes) {
                            // Handle both array and object format
                            const episodes = Array.isArray(season.episodes) ? season.episodes : Object.values(season.episodes);
                            for (const episode of episodes) {
                                if (episode.file_id) {
                                    const episodeKey = `${id}-${season.season_number}-${episode.episode_number}`;
                                    if (processedEpisodes.has(episodeKey)) {
                                        console.log(`Skipping duplicate episode: ${episodeKey}`);
                                        continue;
                                    }
                                    processedEpisodes.add(episodeKey);
                                    
                                    const fileInfo = sanitizeString(JSON.stringify({
                                        name: episode.file_name || `S${season.season_number}E${episode.episode_number}`,
                                        size: episode.file_size,
                                        mime_type: episode.mime_type
                                    }));
                                    
                                    const channelId = episode.storage_channel_id || episode.channel_id || null;
                                    const messageId = episode.storage_message_id || episode.channel_message_id || null;
                                    const uploadedAt = episode.uploaded_at ? new Date(episode.uploaded_at).toISOString() : new Date().toISOString();
                                    
                                    sqlInserts += `INSERT OR REPLACE INTO episodes (show_id, season_number, episode_number, file_id, storage_channel_id, storage_message_id, file_info, uploaded_at) VALUES ('${id}', ${season.season_number}, ${episode.episode_number}, '${episode.file_id}', ${channelId ? `'${channelId}'` : 'NULL'}, ${messageId || 'NULL'}, '${fileInfo}', '${uploadedAt}');\n`;
                                }
                            }
                        }
                    }
                }
            }
            sqlInserts += '\n';
        }
        
        // Users
        if (users.length > 0) {
            sqlInserts += '-- Users\n';
            const processedUsers = new Set();
            
            for (const user of users) {
                const telegramId = user.telegram_id || user.id;
                if (processedUsers.has(telegramId)) {
                    console.log(`Skipping duplicate user: ${telegramId}`);
                    continue;
                }
                processedUsers.add(telegramId);
                
                const username = user.username ? sanitizeString(user.username) : null;
                const firstName = user.first_name ? sanitizeString(user.first_name) : null;
                const lastName = user.last_name ? sanitizeString(user.last_name) : null;
                const preferences = user.preferences ? sanitizeString(JSON.stringify(user.preferences)) : null;
                const createdAt = user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString();
                const lastSeen = user.last_seen ? new Date(user.last_seen).toISOString() : createdAt;
                
                sqlInserts += `INSERT OR REPLACE INTO users (telegram_id, username, first_name, last_name, preferences, created_at, last_seen) VALUES ('${telegramId}', ${username ? `'${username}'` : 'NULL'}, ${firstName ? `'${firstName}'` : 'NULL'}, ${lastName ? `'${lastName}'` : 'NULL'}, ${preferences ? `'${preferences}'` : 'NULL'}, '${createdAt}', '${lastSeen}');\n`;
            }
            sqlInserts += '\n';
        }
        
        // Watch History
        if (watchHistory.length > 0) {
            sqlInserts += '-- Watch History\n';
            const processedHistory = new Set();
            
            for (const entry of watchHistory) {
                const historyKey = `${entry.user_id}-${entry.content_id}-${entry.season || 'null'}-${entry.episode || 'null'}`;
                if (processedHistory.has(historyKey)) {
                    console.log(`Skipping duplicate watch history: ${historyKey}`);
                    continue;
                }
                processedHistory.add(historyKey);
                
                const userId = entry.user_id;
                const contentId = entry.content_id;
                const contentType = entry.content_type || 'movie';
                const progress = entry.progress || 0;
                const season = entry.season || null;
                const episode = entry.episode || null;
                const lastWatched = entry.last_watched ? new Date(entry.last_watched).toISOString() : new Date().toISOString();
                
                sqlInserts += `INSERT OR REPLACE INTO watch_history (user_id, content_id, content_type, progress, season, episode, last_watched) VALUES ('${userId}', '${contentId}', '${contentType}', ${progress}, ${season || 'NULL'}, ${episode || 'NULL'}, '${lastWatched}');\n`;
            }
            sqlInserts += '\n';
        }
        
        // Add default channel
        sqlInserts += '-- Default Channel\n';
        sqlInserts += `INSERT OR REPLACE INTO channels (id, name, description, active, created_at) VALUES (1, 'SparrowFlix 24/7', 'Random movies and episodes playing all day', 1, '${new Date().toISOString()}');\n`;
        
        // Save to file
        fs.writeFileSync('migration_data_fixed.sql', sqlInserts);
        console.log('✅ Fixed migration SQL saved to migration_data_fixed.sql');
        
        console.log('\n📊 Migration Summary:');
        console.log(`- Movies: ${movies.length} (deduplicated from ${moviesRaw.length})`);
        console.log(`- TV Shows: ${tvShows.length} (deduplicated from ${tvShowsRaw.length})`);
        console.log(`- Users: ${users.length}`);
        console.log(`- Watch History: ${watchHistory.length}`);
        console.log(`- Episodes: ${processedEpisodes.size}`);
        
        console.log('\nNext steps:');
        console.log('1. Run: wrangler d1 execute sparrowflix --file=migration_data_fixed.sql --env development');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await client.close();
    }
}

function deduplicateById(items) {
    const seen = new Set();
    return items.filter(item => {
        const id = item._id.toString();
        if (seen.has(id)) {
            return false;
        }
        seen.add(id);
        return true;
    });
}

function sanitizeString(str) {
    if (!str) return '';
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// Run migration
migrateData();