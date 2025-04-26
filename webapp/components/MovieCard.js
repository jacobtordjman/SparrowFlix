class MovieCard {
    constructor(item, type, onClick) {
        this.item = item;
        this.type = type; // 'movie' or 'tvshow'
        this.onClick = onClick;
    }

    render() {
        const element = document.createElement('div');
        element.className = 'movie-card';

        const imageUrl = this.item.details?.poster_path
            ? `https://image.tmdb.org/t/p/w300${this.item.details.poster_path}`
            : 'placeholder.jpg';

        const title = this.item.details?.name || this.item.title || 'Unknown Title';
        const year = this.type === 'movie'
            ? (this.item.details?.release_date || '').substring(0, 4)
            : (this.item.details?.first_air_date || '').substring(0, 4);

        element.innerHTML = `
            <img src="${imageUrl}" alt="${title}">
            <div class="movie-info">
                <div class="movie-title">${title}</div>
                <div class="movie-year">${year}</div>
            </div>
        `;

        element.addEventListener('click', () => {
            this.onClick(this.item, this.type);
        });

        return element;
    }
}