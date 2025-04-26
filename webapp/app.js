// Initialize Telegram Mini App
let tg = window.Telegram.WebApp;
tg.expand();  // Expand to full screen

// Initialize components
const player = new Player();
let movies = [];
let tvShows = [];
let filteredContent = [];
let currentCategory = 'all';
let searchQuery = '';

// DOM elements
const contentGrid = document.getElementById('content-grid');
const searchInput = document.getElementById('search-input');
const categoryButtons = document.querySelectorAll('.category-btn');

// Function to render content in grid
function renderContent() {
    contentGrid.innerHTML = '';

    if (filteredContent.length === 0) {
        contentGrid.innerHTML = '<div class="no-content">No content available</div>';
        return;
    }

    filteredContent.forEach(item => {
        const type = item.details?.seasons ? 'tvshow' : 'movie';
        const card = new MovieCard(item, type, (item, type) => {
            if (type === 'movie') {
                player.playMovie(item);
            } else {
                player.playTVShow(item);
            }
        });

        contentGrid.appendChild(card.render());
    });
}

// Function to filter content based on category and search
function filterContent() {
    if (currentCategory === 'all') {
        filteredContent = [...movies, ...tvShows];
    } else if (currentCategory === 'movies') {
        filteredContent = [...movies];
    } else if (currentCategory === 'tvshows') {
        filteredContent = [...tvShows];
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredContent = filteredContent.filter(item => {
            const title = (item.details?.name || item.title || '').toLowerCase();
            return title.includes(query);
        });
    }

    renderContent();
}

// Event listeners for category buttons
categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons
        categoryButtons.forEach(btn => btn.classList.remove('active'));

        // Add active class to clicked button
        button.classList.add('active');

        // Update current category
        currentCategory = button.dataset.category;

        // Filter and render content
        filterContent();
    });
});

// Event listener for search input
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    filterContent();
});

// Function to load initial data
async function loadData() {
    // Show loading state
    contentGrid.innerHTML = '<div class="loading">Loading content...</div>';

    try {
        const [moviesData, tvShowsData] = await Promise.all([
            API.getMovies(),
            API.getTVShows()
        ]);

        movies = moviesData || [];
        tvShows = tvShowsData || [];

        // Filter and render content
        filterContent();
    } catch (error) {
        console.error('Error loading data:', error);
        contentGrid.innerHTML = '<div class="error">Error loading content. Please try again.</div>';
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});