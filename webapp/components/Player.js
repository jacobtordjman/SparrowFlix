class Player {
    constructor() {
        this.container = document.getElementById('player-container');
        this.titleElement = document.getElementById('player-title');
        this.playerElement = document.getElementById('video-player');
        this.episodeSelector = document.getElementById('episode-selector');
        this.backButton = document.getElementById('back-btn');

        this.currentItem = null;
        this.currentType = null;
        this.currentSeason = null;
        this.currentEpisode = null;

        this.backButton.addEventListener('click', () => this.close());
    }

    async playMovie(movie) {
        this.currentItem = movie;
        this.currentType = 'movie';
        this.titleElement.textContent = movie.details?.name || movie.title;

        // Show loading
        this.playerElement.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const streamData = await API.getMovieStreamUrl(movie._id);
            if (!streamData || !streamData.url) {
                throw new Error('Stream URL not available');
            }

            this.playerElement.innerHTML = `
                <video controls autoplay>
                    <source src="${streamData.url}" type="video/mp4">
                    Your browser does not support video playback.
                </video>
            `;

            this.episodeSelector.classList.add('hidden');
            this.container.classList.remove('hidden');
        } catch (error) {
            console.error('Error playing movie:', error);
            this.playerElement.innerHTML = `
                <div class="error">Error: Could not load video.</div>
            `;
        }
    }

    async playTVShow(show, seasonNumber = 1, episodeNumber = 1) {
        this.currentItem = show;
        this.currentType = 'tvshow';
        this.currentSeason = seasonNumber;
        this.currentEpisode = episodeNumber;

        const title = show.details?.name || show.title;
        this.titleElement.textContent = `${title} - S${seasonNumber}:E${episodeNumber}`;

        // Show loading
        this.playerElement.innerHTML = '<div class="loading">Loading...</div>';

        try {
            // Load TV show details if not already loaded
            if (!show.details?.seasons) {
                const showDetails = await API.getTVShowDetails(show._id);
                if (showDetails) {
                    this.currentItem = showDetails;
                    show = showDetails;
                }
            }

            // Get stream URL
            const streamData = await API.getEpisodeStreamUrl(show._id, seasonNumber, episodeNumber);
            if (!streamData || !streamData.url) {
                throw new Error('Stream URL not available');
            }

            this.playerElement.innerHTML = `
                <video controls autoplay>
                    <source src="${streamData.url}" type="video/mp4">
                    Your browser does not support video playback.
                </video>
            `;

            // Set up episode selector
            this.renderEpisodeSelector(show, seasonNumber);
            this.episodeSelector.classList.remove('hidden');
            this.container.classList.remove('hidden');
        } catch (error) {
            console.error('Error playing TV show:', error);
            this.playerElement.innerHTML = `
                <div class="error">Error: Could not load video.</div>
            `;
        }
    }

    renderEpisodeSelector(show, seasonNumber) {
        const season = show.details?.seasons?.find(s => s.season_number === parseInt(seasonNumber));
        if (!season || !season.episodes) {
            this.episodeSelector.innerHTML = '<div class="no-episodes">No episodes available</div>';
            return;
        }

        this.episodeSelector.innerHTML = '';

        // Add season selector
        const seasonSelectorDiv = document.createElement('div');
        seasonSelectorDiv.className = 'season-selector';

        const seasonSelector = document.createElement('select');
        show.details.seasons.forEach(s => {
            const option = document.createElement('option');
            option.value = s.season_number;
            option.textContent = `Season ${s.season_number}`;
            option.selected = s.season_number === parseInt(seasonNumber);
            seasonSelector.appendChild(option);
        });

        seasonSelector.addEventListener('change', (e) => {
            this.playTVShow(show, e.target.value, 1);
        });

        seasonSelectorDiv.appendChild(seasonSelector);
        this.episodeSelector.appendChild(seasonSelectorDiv);

        // Add episode buttons
        const episodesDiv = document.createElement('div');
        episodesDiv.className = 'episodes';

        season.episodes.forEach(ep => {
            const episodeBtn = document.createElement('button');
            episodeBtn.className = 'episode-btn';
            episodeBtn.textContent = `Episode ${ep.episode_number}`;

            if (ep.episode_number === this.currentEpisode) {
                episodeBtn.classList.add('active');
            }

            episodeBtn.addEventListener('click', () => {
                this.playTVShow(show, seasonNumber, ep.episode_number);
            });

            episodesDiv.appendChild(episodeBtn);
        });

        this.episodeSelector.appendChild(episodesDiv);
    }

    close() {
        this.container.classList.add('hidden');
        this.playerElement.innerHTML = '';
        this.currentItem = null;
        this.currentType = null;
    }
}