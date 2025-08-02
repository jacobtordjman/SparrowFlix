// SparrowFlix Web App
class SparrowFlix {
    constructor() {
        this.tg = window.Telegram.WebApp;
        this.apiUrl = 'https://sparrowflix.jaketur.workers.dev/api';
        this.content = { movies: [], shows: [] };
        this.watchHistory = [];
        this.currentUser = null;
        
        this.init();
    }

    async init() {
        // Initialize Telegram Web App
        this.tg.ready();
        this.tg.expand();
        
        // Set theme
        if (this.tg.colorScheme === 'dark') {
            document.body.classList.add('dark');
        }
        
        // Get auth data
        const initData = this.tg.initData;
        if (initData) {
            localStorage.setItem('tg-auth', initData);
        }
        
        // Load content
        await this.loadContent();
        await this.loadUserData();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Handle scroll effects
        this.handleScroll();
    }

    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.search(e.target.value), 300);
        });
        
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(e.target.getAttribute('href').substring(1));
            });
        });
        
        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Video player close
        document.getElementById('closePlayer').addEventListener('click', () => {
            this.closePlayer();
        });
        
        // Click outside modal
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('contentModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    handleScroll() {
        window.addEventListener('scroll', () => {
            const header = document.querySelector('.header');
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    async loadContent() {
        try {
            const response = await this.apiRequest('/content');
            this.content = response;
            
            this.renderMovies(response.movies);
            this.renderShows(response.shows);
        } catch (error) {
            console.error('Failed to load content:', error);
            this.showError('Failed to load content');
        }
    }

    async loadUserData() {
        try {
            const response = await this.apiRequest('/user');
            this.currentUser = response.user;
            this.watchHistory = response.watchHistory;
            
            this.renderContinueWatching();
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    renderMovies(movies) {
        const container = document.getElementById('moviesRow');
        container.innerHTML = '';
        
        movies.forEach(movie => {
            const card = this.createContentCard(movie, 'movie');
            container.appendChild(card);
        });
    }

    renderShows(shows) {
        const container = document.getElementById('showsRow');
        container.innerHTML = '';
        
        shows.forEach(show => {
            const card = this.createContentCard(show, 'show');
            container.appendChild(card);
        });
    }

    renderContinueWatching() {
        if (this.watchHistory.length === 0) return;
        
        const section = document.getElementById('continueWatching');
        const container = document.getElementById('continueWatchingRow');
        
        section.style.display = 'block';
        container.innerHTML = '';
        
        this.watchHistory.forEach(item => {
            const content = this.findContent(item.content_id, item.content_type);
            if (content) {
                const card = this.createContentCard(content, item.content_type, item);
                container.appendChild(card);
            }
        });
    }

    createContentCard(content, type, watchData = null) {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.onclick = () => this.showContentDetails(content, type);
        
        const posterUrl = content.posterPath 
            ? `https://image.tmdb.org/t/p/w342${content.posterPath}`
            : null;
        
        if (posterUrl) {
            const img = document.createElement('img');
            img.src = posterUrl;
            img.alt = content.title;
            img.loading = 'lazy';
            card.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'content-card-placeholder';
            placeholder.textContent = '🎬';
            card.appendChild(placeholder);
        }
        
        const info = document.createElement('div');
        info.className = 'content-info';
        
        const title = document.createElement('div');
        title.className = 'content-title';
        title.textContent = content.title;
        
        const meta = document.createElement('div');
        meta.className = 'content-meta';
        
        if (watchData && watchData.progress > 0) {
            const progress = document.createElement('div');
            progress.style.cssText = `
                height: 3px;
                background: var(--accent);
                width: ${watchData.progress}%;
                margin-top: 5px;
            `;
            meta.appendChild(progress);
        }
        
        meta.innerHTML += type === 'movie' 
            ? content.releaseDate?.substring(0, 4) || ''
            : `${content.seasons?.length || 0} Seasons`;
        
        info.appendChild(title);
        info.appendChild(meta);
        card.appendChild(info);
        
        return card;
    }

    async showContentDetails(content, type) {
        const modal = document.getElementById('contentModal');
        const modalBody = document.getElementById('modalBody');
        
        const backdropUrl = content.backdropPath
            ? `https://image.tmdb.org/t/p/original${content.backdropPath}`
            : '';
        
        modalBody.innerHTML = `
            <div class="modal-hero" style="background-image: url('${backdropUrl}')">
                <div class="modal-hero-gradient"></div>
            </div>
            <div class="modal-info">
                <h2 class="modal-title">${content.title}</h2>
                <div class="modal-meta">
                    ${type === 'movie' 
                        ? `${content.releaseDate?.substring(0, 4) || ''} • ${content.runtime || '?'} min`
                        : `${content.seasons?.length || 0} Seasons`}
                    • ${content.language?.toUpperCase() || 'EN'}
                </div>
                <p class="modal-overview">${content.overview || 'No description available.'}</p>
                ${type === 'movie'
                    ? `<button class="play-button" onclick="app.playContent('${content.id}', 'movie')">
                        ▶ Play Movie
                       </button>`
                    : this.renderSeasonSelector(content)}
            </div>
        `;
        
        modal.style.display = 'block';
    }

    renderSeasonSelector(show) {
        const seasons = show.seasons || [];
        if (seasons.length === 0) return '<p>No episodes available</p>';
        
        let html = '<div class="season-selector"><div class="season-tabs">';
        
        seasons.forEach((season, index) => {
            html += `<button class="season-tab ${index === 0 ? 'active' : ''}" 
                     onclick="app.selectSeason('${show.id}', ${season.seasonNumber}, this)">
                     Season ${season.seasonNumber}
                     </button>`;
        });
        
        html += '</div><div id="episodeList">';
        html += this.renderEpisodes(show.id, seasons[0]);
        html += '</div></div>';
        
        return html;
    }

    renderEpisodes(showId, season) {
        const episodes = season.episodes || [];
        if (episodes.length === 0) return '<p>No episodes uploaded</p>';
        
        let html = '<div class="episode-grid">';
        
        episodes.forEach(episode => {
            html += `
                <div class="episode-card" 
                     onclick="app.playContent('${showId}', 'show', ${season.seasonNumber}, ${episode.episode_number})">
                    <div>Episode ${episode.episode_number}</div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    selectSeason(showId, seasonNumber, button) {
        // Update active tab
        document.querySelectorAll('.season-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        button.classList.add('active');
        
        // Find season data
        const show = this.findContent(showId, 'show');
        const season = show.seasons.find(s => s.seasonNumber === seasonNumber);
        
        // Update episode list
        document.getElementById('episodeList').innerHTML = this.renderEpisodes(showId, season);
    }

    async playContent(contentId, type, season = null, episode = null) {
        try {
            // Request streaming ticket
            const ticketResponse = await this.apiRequest('/ticket/create', {
                method: 'POST',
                body: JSON.stringify({
                    contentId,
                    type,
                    season,
                    episode
                })
            });
            
            const { streamUrl } = ticketResponse;
            
            // Close modal
            this.closeModal();
            
            // Open video player
            const player = document.getElementById('videoPlayer');
            const video = document.getElementById('video');
            
            video.src = streamUrl;
            player.style.display = 'flex';
            
            // Start playback
            video.play();
            
            // Track progress
            this.trackProgress(video, contentId, type, season, episode);
            
        } catch (error) {
            console.error('Playback failed:', error);
            this.showError('Failed to start playback');
        }
    }

    trackProgress(video, contentId, type, season, episode) {
        let lastUpdate = 0;
        
        video.addEventListener('timeupdate', async () => {
            const progress = (video.currentTime / video.duration) * 100;
            
            // Update every 10 seconds
            if (Date.now() - lastUpdate > 10000) {
                lastUpdate = Date.now();
                
                try {
                    await this.apiRequest('/watch/progress', {
                        method: 'POST',
                        body: JSON.stringify({
                            contentId,
                            progress,
                            season,
                            episode
                        })
                    });
                } catch (error) {
                    console.error('Failed to update progress:', error);
                }
            }
        });
    }

    async search(query) {
        if (!query) {
            document.getElementById('searchResults').style.display = 'none';
            return;
        }
        
        try {
            const response = await this.apiRequest(`/search?q=${encodeURIComponent(query)}`);
            this.renderSearchResults(response.results);
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    renderSearchResults(results) {
        const section = document.getElementById('searchResults');
        const container = document.getElementById('searchResultsRow');
        
        if (results.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        container.innerHTML = '';
        
        results.forEach(item => {
            const card = this.createContentCard(item, item.type);
            container.appendChild(card);
        });
    }

    closeModal() {
        document.getElementById('contentModal').style.display = 'none';
    }

    closePlayer() {
        const player = document.getElementById('videoPlayer');
        const video = document.getElementById('video');
        
        video.pause();
        video.src = '';
        player.style.display = 'none';
    }

    findContent(id, type) {
        const collection = type === 'movie' ? this.content.movies : this.content.shows;
        return collection.find(item => item.id === id);
    }

    navigate(section) {
        // Update active nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${section}`) {
                link.classList.add('active');
            }
        });
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.style.display = 'none';
        });
        
        // Show requested section
        switch (section) {
            case 'home':
                document.getElementById('continueWatching').style.display = 'block';
                document.getElementById('moviesSection').style.display = 'block';
                document.getElementById('showsSection').style.display = 'block';
                break;
            case 'movies':
                document.getElementById('moviesSection').style.display = 'block';
                break;
            case 'shows':
                document.getElementById('showsSection').style.display = 'block';
                break;
            case 'live':
                document.getElementById('liveTVSection').style.display = 'block';
                this.loadLiveTV();
                break;
        }
    }

    async loadLiveTV() {
        try {
            const response = await this.apiRequest('/channels/list');
            this.renderChannels(response.channels);
            
            // Update channels every 30 seconds
            if (this.channelInterval) {
                clearInterval(this.channelInterval);
            }
            this.channelInterval = setInterval(() => {
                this.updateChannels();
            }, 30000);
        } catch (error) {
            console.error('Failed to load channels:', error);
            this.showError('Failed to load live TV channels');
        }
    }

    renderChannels(channels) {
        const container = document.getElementById('channelsGrid');
        container.innerHTML = '';
        
        channels.forEach(channel => {
            const card = document.createElement('div');
            card.className = 'channel-card';
            card.setAttribute('data-channel-id', channel.id);
            card.onclick = () => this.showChannelSchedule(channel.id);
            
            const program = channel.currentProgram;
            
            card.innerHTML = `
                <div class="channel-header">
                    <div class="channel-name">${channel.name}</div>
                    <div class="channel-status">
                        <span class="live-indicator"></span>
                        LIVE
                    </div>
                </div>
                <div class="channel-program">
                    ${program ? `
                        <div class="program-title">${program.title}</div>
                        <div class="program-progress">
                            <div class="program-progress-bar" style="width: ${program.progress}%"></div>
                        </div>
                        <div class="program-time">
                            <span>Now Playing</span>
                            <span>${this.formatTime(program.time_remaining)} left</span>
                        </div>
                    ` : '<div class="program-title">No program scheduled</div>'}
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    async updateChannels() {
        // Silently update channel info without re-rendering
        try {
            const response = await this.apiRequest('/channels/list');
            response.channels.forEach(channel => {
                const card = document.querySelector(`[data-channel-id="${channel.id}"]`);
                if (card && channel.currentProgram) {
                    const progressBar = card.querySelector('.program-progress-bar');
                    if (progressBar) {
                        progressBar.style.width = `${channel.currentProgram.progress}%`;
                    }
                }
            });
        } catch (error) {
            console.error('Failed to update channels:', error);
        }
    }

    async showChannelSchedule(channelId) {
        try {
            const response = await this.apiRequest(`/channels/schedule/${channelId}`);
            const { channel, schedule } = response;
            
            const modal = document.getElementById('contentModal');
            const modalBody = document.getElementById('modalBody');
            
            modalBody.innerHTML = `
                <div class="modal-info">
                    <h2 class="modal-title">${channel.name}</h2>
                    <p class="modal-meta">${channel.description}</p>
                    
                    <button class="play-button" onclick="app.watchChannel('${channelId}')">
                        ▶ Watch Live
                    </button>
                    
                    <h3 style="margin-top: 2rem; margin-bottom: 1rem;">Schedule</h3>
                    <div class="schedule-list">
                        ${schedule.map(item => {
                            const startTime = new Date(item.start_time);
                            const isNow = startTime <= new Date() && new Date(item.end_time) > new Date();
                            
                            return `
                                <div class="schedule-item ${isNow ? 'schedule-current' : ''}">
                                    <div class="schedule-time">
                                        ${startTime.toLocaleTimeString([], { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </div>
                                    <div class="schedule-content">
                                        <div class="schedule-title">${item.title}</div>
                                        <div class="schedule-duration">
                                            ${Math.round(item.duration / 60)} min
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            
            modal.style.display = 'block';
        } catch (error) {
            console.error('Failed to load schedule:', error);
            this.showError('Failed to load channel schedule');
        }
    }

    async watchChannel(channelId) {
        try {
            const response = await this.apiRequest(`/channels/stream/${channelId}`);
            const { program, streamData } = response;
            
            // Create a special ticket for live TV
            const ticketResponse = await this.apiRequest('/ticket/create', {
                method: 'POST',
                body: JSON.stringify({
                    ...streamData,
                    isLive: true
                })
            });
            
            const { streamUrl } = ticketResponse;
            
            // Open video player
            const player = document.getElementById('videoPlayer');
            const video = document.getElementById('video');
            
            video.src = streamUrl;
            player.style.display = 'flex';
            
            // Start playback
            video.play();
            
            // Track progress
            this.trackProgress(video, program.content_id, program.content_type, program.season, program.episode);
            
        } catch (error) {
            console.error('Failed to watch channel:', error);
            this.showError('Failed to start live stream');
        }
    }

    showError(message) {
        // Show error using Telegram's native popup
        if (this.tg.showPopup) {
            this.tg.showPopup({
                title: 'Error',
                message: message,
                buttons: [{ type: 'ok' }]
            });
        } else {
            alert(message);
        }
    }

    async apiRequest(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Add Telegram auth data
        const authData = localStorage.getItem('tg-auth');
        if (authData) {
            headers['X-Telegram-Init-Data'] = authData;
        }

        const response = await fetch(`${this.apiUrl}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        return await response.json();
    }
}

// Initialize app
const app = new SparrowFlix();