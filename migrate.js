// migrate.js - Run this to migrate your existing data structure
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
    console.log('🚀 Starting SparrowFlix migration...');
    
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('sparrowflix');
        
        // 1. Update movies collection
        console.log('📽️ Migrating movies...');
        const movies = await db.collection('movies').find({}).toArray();
        
        for (const movie of movies) {
            const updates = {};
            
            // Add tmdb_id if missing
            if (movie.details?.id && !movie.tmdb_id) {
                updates.tmdb_id = movie.details.id;
            }
            
            // Ensure proper structure
            if (!movie.created_at) {
                updates.created_at = new Date(movie.created_at || Date.now());
            }
            
            // Add search-friendly fields
            if (!movie.search_title) {
                updates.search_title = movie.title.toLowerCase();
                updates.original_title = movie.details?.original_title || movie.title;
            }
            
            if (Object.keys(updates).length > 0) {
                await db.collection('movies').updateOne(
                    { _id: movie._id },
                    { $set: updates }
                );
                console.log(`✅ Updated movie: ${movie.title}`);
            }
        }
        
        // 2. Update TV shows collection
        console.log('📺 Migrating TV shows...');
        const shows = await db.collection('tv_shows').find({}).toArray();
        
        for (const show of shows) {
            const updates = {};
            
            // Add tmdb_id
            if (show.details?.id && !show.tmdb_id) {
                updates.tmdb_id = show.details.id;
            }
            
            // Fix episode structure
            if (show.details?.seasons) {
                const updatedSeasons = show.details.seasons.map(season => {
                    // Convert episodes array to object if needed
                    if (Array.isArray(season.episodes)) {
                        const episodesObj = {};
                        season.episodes.forEach(ep => {
                            episodesObj[ep.episode_number] = ep;
                        });
                        season.episodes = episodesObj;
                    }
                    return season;
                });
                
                if (JSON.stringify(updatedSeasons) !== JSON.stringify(show.details.seasons)) {
                    updates['details.seasons'] = updatedSeasons;
                }
            }
            
            if (Object.keys(updates).length > 0) {
                await db.collection('tv_shows').updateOne(
                    { _id: show._id },
                    { $set: updates }
                );
                console.log(`✅ Updated show: ${show.title}`);
            }
        }
        
        // 3. Create text indexes for search
        console.log('🔍 Creating search indexes...');
        
        try {
            await db.collection('movies').createIndex(
                { title: 'text', original_title: 'text', 'details.overview': 'text' },
                { name: 'text_search' }
            );
            console.log('✅ Created movies text index');
        } catch (e) {
            console.log('ℹ️ Movies text index already exists');
        }
        
        try {
            await db.collection('tv_shows').createIndex(
                { title: 'text', original_title: 'text', 'details.overview': 'text' },
                { name: 'text_search' }
            );
            console.log('✅ Created TV shows text index');
        } catch (e) {
            console.log('ℹ️ TV shows text index already exists');
        }
        
        // 4. Initialize collections if they don't exist
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('users')) {
            await db.createCollection('users');
            console.log('✅ Created users collection');
        }
        
        if (!collectionNames.includes('watch_history')) {
            await db.createCollection('watch_history');
            console.log('✅ Created watch_history collection');
        }
        
        if (!collectionNames.includes('channels')) {
            await db.createCollection('channels');
            console.log('✅ Created channels collection');
            
            // Add default channel
            await db.collection('channels').insertOne({
                name: 'SparrowFlix 24/7',
                description: 'Random movies and episodes playing all day',
                active: true,
                schedule: [],
                created_at: new Date()
            });
        }
        
        console.log('✨ Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

// Run migration
migrate();