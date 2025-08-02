// functions/api/channels.js
import { connectDB } from '../db/connection.js';

export async function handleChannelsApi(request, db, params, user) {
    const [action, channelId] = params;
    
    switch (action) {
        case 'list':
            return await getChannels(db);
            
        case 'current':
            return await getCurrentProgram(db, channelId);
            
        case 'schedule':
            return await getSchedule(db, channelId);
            
        case 'stream':
            return await getChannelStream(db, channelId, user);
            
        default:
            return {
                body: JSON.stringify({ error: 'Invalid channel action' }),
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            };
    }
}

async function getChannels(db) {
    const channels = await db.collection('channels')
        .find({ active: true })
        .toArray();
    
    // Get current program for each channel
    const channelsWithPrograms = await Promise.all(
        channels.map(async (channel) => {
            const current = await getCurrentProgramForChannel(db, channel._id);
            return {
                id: channel._id,
                name: channel.name,
                description: channel.description,
                currentProgram: current
            };
        })
    );
    
    return {
        body: JSON.stringify({ channels: channelsWithPrograms }),
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    };
}

async function getCurrentProgram(db, channelId) {
    const current = await getCurrentProgramForChannel(db, channelId);
    
    return {
        body: JSON.stringify({ program: current }),
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    };
}

async function getCurrentProgramForChannel(db, channelId) {
    const channel = await db.collection('channels').findOne({ _id: channelId });
    if (!channel) return null;
    
    // Get or generate schedule
    let schedule = channel.schedule || [];
    
    if (schedule.length === 0 || needsNewSchedule(schedule)) {
        schedule = await generateSchedule(db, channel);
        await db.collection('channels').updateOne(
            { _id: channelId },
            { $set: { schedule, schedule_updated: new Date() } }
        );
    }
    
    // Find current program
    const now = new Date();
    const currentProgram = schedule.find(item => 
        new Date(item.start_time) <= now && new Date(item.end_time) > now
    );
    
    if (!currentProgram) {
        // Generate new schedule if nothing is playing
        schedule = await generateSchedule(db, channel);
        await db.collection('channels').updateOne(
            { _id: channelId },
            { $set: { schedule, schedule_updated: new Date() } }
        );
        return schedule[0] || null;
    }
    
    // Calculate progress
    const start = new Date(currentProgram.start_time).getTime();
    const end = new Date(currentProgram.end_time).getTime();
    const progress = ((now.getTime() - start) / (end - start)) * 100;
    
    return {
        ...currentProgram,
        progress: Math.round(progress),
        time_remaining: Math.round((end - now.getTime()) / 1000)
    };
}

async function generateSchedule(db, channel) {
    const schedule = [];
    const now = new Date();
    let currentTime = new Date(now);
    currentTime.setHours(0, 0, 0, 0); // Start from midnight
    
    // Get random content
    const movies = await db.collection('movies')
        .find({ file_id: { $exists: true } })
        .toArray();
    
    const shows = await db.collection('tv_shows')
        .find({ 'details.seasons.episodes.file_id': { $exists: true } })
        .toArray();
    
    // Mix content for 24 hours
    while (currentTime < new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
        const useMovie = Math.random() > 0.3; // 70% movies, 30% TV
        
        if (useMovie && movies.length > 0) {
            const movie = movies[Math.floor(Math.random() * movies.length)];
            const duration = movie.details?.runtime || 120; // Default 2 hours
            
            schedule.push({
                type: 'movie',
                content_id: movie._id,
                title: movie.title,
                description: movie.details?.overview || '',
                poster: movie.details?.poster_path || '',
                duration: duration * 60, // Convert to seconds
                start_time: new Date(currentTime),
                end_time: new Date(currentTime.getTime() + duration * 60 * 1000)
            });
            
            currentTime = new Date(currentTime.getTime() + duration * 60 * 1000);
            
        } else if (shows.length > 0) {
            // Play 3-5 episodes of a show
            const show = shows[Math.floor(Math.random() * shows.length)];
            const episodeCount = 3 + Math.floor(Math.random() * 3);
            
            // Get available episodes
            const episodes = [];
            show.details?.seasons?.forEach(season => {
                Object.values(season.episodes || {}).forEach(ep => {
                    if (ep.file_id) {
                        episodes.push({
                            ...ep,
                            season_number: season.season_number,
                            show_title: show.title,
                            show_id: show._id
                        });
                    }
                });
            });
            
            if (episodes.length > 0) {
                for (let i = 0; i < Math.min(episodeCount, episodes.length); i++) {
                    const episode = episodes[i];
                    const duration = 45; // Default 45 minutes per episode
                    
                    schedule.push({
                        type: 'episode',
                        content_id: show._id,
                        season: episode.season_number,
                        episode: episode.episode_number,
                        title: `${show.title} - S${episode.season_number}E${episode.episode_number}`,
                        description: show.details?.overview || '',
                        poster: show.details?.poster_path || '',
                        duration: duration * 60,
                        start_time: new Date(currentTime),
                        end_time: new Date(currentTime.getTime() + duration * 60 * 1000)
                    });
                    
                    currentTime = new Date(currentTime.getTime() + duration * 60 * 1000);
                }
            }
        }
        
        // Add a short break between content
        currentTime = new Date(currentTime.getTime() + 5 * 60 * 1000); // 5 min break
    }
    
    return schedule;
}

async function getSchedule(db, channelId) {
    const channel = await db.collection('channels').findOne({ _id: channelId });
    if (!channel) {
        return {
            body: JSON.stringify({ error: 'Channel not found' }),
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        };
    }
    
    let schedule = channel.schedule || [];
    
    if (schedule.length === 0 || needsNewSchedule(schedule)) {
        schedule = await generateSchedule(db, channel);
        await db.collection('channels').updateOne(
            { _id: channelId },
            { $set: { schedule, schedule_updated: new Date() } }
        );
    }
    
    // Get next 12 hours of programming
    const now = new Date();
    const upcoming = schedule.filter(item => 
        new Date(item.end_time) > now && 
        new Date(item.start_time) < new Date(now.getTime() + 12 * 60 * 60 * 1000)
    );
    
    return {
        body: JSON.stringify({ 
            channel: {
                id: channel._id,
                name: channel.name,
                description: channel.description
            },
            schedule: upcoming 
        }),
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    };
}

async function getChannelStream(db, channelId, user) {
    const current = await getCurrentProgramForChannel(db, channelId);
    
    if (!current) {
        return {
            body: JSON.stringify({ error: 'No program currently playing' }),
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        };
    }
    
    // Create a streaming ticket for the current program
    const ticketData = {
        contentId: current.content_id,
        type: current.type,
        season: current.season,
        episode: current.episode,
        channelId: channelId,
        startOffset: Math.round((current.progress / 100) * current.duration),
        userId: user?.id || 'guest',
        expiresAt: new Date(current.end_time).getTime() + 300000, // 5 min buffer
        createdAt: Date.now()
    };
    
    return {
        body: JSON.stringify({
            program: current,
            streamData: ticketData
        }),
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    };
}

function needsNewSchedule(schedule) {
    if (!schedule || schedule.length === 0) return true;
    
    const lastProgram = schedule[schedule.length - 1];
    const endTime = new Date(lastProgram.end_time);
    const now = new Date();
    
    // Generate new schedule if less than 6 hours remaining
    return endTime < new Date(now.getTime() + 6 * 60 * 60 * 1000);
}