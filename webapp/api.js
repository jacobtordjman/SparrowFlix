// API interface for SparrowFlix
const API = {
    // Use window.location.origin to automatically get the current domain
    baseUrl: `${window.location.origin}/api`,
    
    // Get all movies
    async getMovies() {
        try {
            const response = await fetch(`${this.baseUrl}/movies`);
            if (!response.ok) throw new Error('Failed to fetch movies');
            return await response.json();
        } catch (error) {
            console.error('Error fetching movies:', error);
            return [];
        }
    },
    
    // Get all TV shows
    async getTVShows() {
        try {
            const response = await fetch(`${this.baseUrl}/tvshows`);
            if (!response.ok) throw new Error('Failed to fetch TV shows');
            return await response.json();
        } catch (error) {
            console.error('Error fetching TV shows:', error);
            return [];
        }
    },
    
    // Get streaming URL for a movie
    async getMovieStreamUrl(movieId) {
        try {
            const response = await fetch(`${this.baseUrl}/stream/movie/${movieId}`);
            if (!response.ok) throw new Error('Failed to get movie stream URL');
            return await response.json();
        } catch (error) {
            console.error('Error getting movie stream URL:', error);
            return null;
        }
    },
    
    // Get streaming URL for a TV show episode
    async getEpisodeStreamUrl(showId, seasonNumber, episodeNumber) {
        try {
            const response = await fetch(
                `${this.baseUrl}/stream/tvshow/${showId}/season/${seasonNumber}/episode/${episodeNumber}`
            );
            if (!response.ok) throw new Error('Failed to get episode stream URL');
            return await response.json();
        } catch (error) {
            console.error('Error getting episode stream URL:', error);
            return null;
        }
    },
    
    // Get TV show season details
    async getTVShowDetails(showId) {
        try {
            const response = await fetch(`${this.baseUrl}/tvshow/${showId}`);
            if (!response.ok) throw new Error('Failed to fetch TV show details');
            return await response.json();
        } catch (error) {
            console.error('Error fetching TV show details:', error);
            return null;
        }
    },
    
    // Search for content
    async searchContent(query) {
        try {
            const response = await fetch(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Failed to search content');
            return await response.json();
        } catch (error) {
            console.error('Error searching content:', error);
            return { movies: [], tvShows: [] };
        }
    }
};