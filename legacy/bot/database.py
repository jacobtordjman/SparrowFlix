import logging
import os
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ServerSelectionTimeoutError, OperationFailure
from functools import wraps
import time
from dotenv import load_dotenv

load_dotenv()

# Configuration
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "sparrowflix"
CONNECTION_TIMEOUT = 5000  # 5 seconds
MAX_POOL_SIZE = 10
RETRY_ATTEMPTS = 3
RETRY_DELAY = 2

# Global variables
client = None
db = None
movies_collection = None
tv_shows_collection = None
users_collection = None
watch_history_collection = None

def with_retry(func):
    """Decorator to retry database operations"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        for attempt in range(RETRY_ATTEMPTS):
            try:
                return func(*args, **kwargs)
            except ServerSelectionTimeoutError as e:
                if attempt < RETRY_ATTEMPTS - 1:
                    logging.warning(f"Database connection failed, retrying in {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY)
                else:
                    logging.error(f"Database connection failed after {RETRY_ATTEMPTS} attempts")
                    raise
            except Exception as e:
                logging.error(f"Database operation failed: {e}")
                raise
    return wrapper

@with_retry
def init_database():
    """Initialize database connection with retry logic"""
    global client, db, movies_collection, tv_shows_collection, users_collection, watch_history_collection
    
    try:
        # Create client with connection pooling
        client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=CONNECTION_TIMEOUT,
            maxPoolSize=MAX_POOL_SIZE,
            retryWrites=True
        )
        
        # Test connection
        client.admin.command('ping')
        logging.info("Connected to MongoDB successfully")
        
        # Initialize database and collections
        db = client[DB_NAME]
        movies_collection = db["movies"]
        tv_shows_collection = db["tv_shows"]
        users_collection = db["users"]
        watch_history_collection = db["watch_history"]
        
        # Create indexes if they don't exist
        create_indexes()
        
        return True
        
    except Exception as e:
        logging.error(f"Failed to initialize database: {e}")
        raise

def create_indexes():
    """Create necessary indexes only if they don't exist"""
    try:
        # Movies indexes
        existing_movie_indexes = {idx["name"] for idx in movies_collection.list_indexes()}
        
        if "title_text_language_1" not in existing_movie_indexes:
            movies_collection.create_index([("title", "text"), ("language", 1)])
            
        if "channel_message_id_1" not in existing_movie_indexes:
            movies_collection.create_index("channel_message_id", sparse=True)
            
        if "tmdb_id_1" not in existing_movie_indexes:
            movies_collection.create_index("tmdb_id", unique=True, sparse=True)
        
        # TV Shows indexes
        existing_tv_indexes = {idx["name"] for idx in tv_shows_collection.list_indexes()}
        
        if "title_text_language_1" not in existing_tv_indexes:
            tv_shows_collection.create_index([("title", "text"), ("language", 1)])
            
        if "channel_message_id_1" not in existing_tv_indexes:
            tv_shows_collection.create_index("channel_message_id", sparse=True)
            
        if "tmdb_id_1" not in existing_tv_indexes:
            tv_shows_collection.create_index("tmdb_id", unique=True, sparse=True)
        
        # Users indexes
        existing_user_indexes = {idx["name"] for idx in users_collection.list_indexes()}
        
        if "telegram_id_1" not in existing_user_indexes:
            users_collection.create_index("telegram_id", unique=True)
        
        # Watch history indexes
        existing_history_indexes = {idx["name"] for idx in watch_history_collection.list_indexes()}
        
        if "user_id_1_content_id_1" not in existing_history_indexes:
            watch_history_collection.create_index([("user_id", 1), ("content_id", 1)])
            
        if "last_watched_-1" not in existing_history_indexes:
            watch_history_collection.create_index([("last_watched", -1)])
        
        logging.info("Database indexes created/verified successfully")
        
    except OperationFailure as e:
        # Index already exists, ignore
        if "already exists" not in str(e):
            logging.error(f"Failed to create indexes: {e}")

@with_retry
def get_movie(movie_id=None, title=None, tmdb_id=None):
    """Get movie by various identifiers"""
    query = {}
    if movie_id:
        query["_id"] = movie_id
    elif title:
        query["title"] = {"$regex": title, "$options": "i"}
    elif tmdb_id:
        query["tmdb_id"] = tmdb_id
    
    return movies_collection.find_one(query) if query else None

@with_retry
def get_tv_show(show_id=None, title=None, tmdb_id=None):
    """Get TV show by various identifiers"""
    query = {}
    if show_id:
        query["_id"] = show_id
    elif title:
        query["title"] = {"$regex": title, "$options": "i"}
    elif tmdb_id:
        query["tmdb_id"] = tmdb_id
    
    return tv_shows_collection.find_one(query) if query else None

@with_retry
def search_content(query, content_type=None, language=None, limit=20):
    """Search for content across movies and TV shows"""
    search_filter = {
        "$text": {"$search": query}
    }
    
    if language:
        search_filter["language"] = language.lower()
    
    results = []
    
    if content_type in [None, "movie"]:
        movies = list(movies_collection.find(
            search_filter,
            {"score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).limit(limit))
        
        for movie in movies:
            movie["type"] = "movie"
            results.append(movie)
    
    if content_type in [None, "tv"]:
        shows = list(tv_shows_collection.find(
            search_filter,
            {"score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).limit(limit))
        
        for show in shows:
            show["type"] = "tv"
            results.append(show)
    
    # Sort combined results by score
    results.sort(key=lambda x: x.get("score", 0), reverse=True)
    return results[:limit]

@with_retry
def update_watch_progress(user_id, content_id, content_type, progress, season=None, episode=None):
    """Update user's watch progress"""
    watch_data = {
        "user_id": user_id,
        "content_id": content_id,
        "content_type": content_type,
        "progress": progress,
        "last_watched": time.datetime.utcnow()
    }
    
    if content_type == "tv" and season and episode:
        watch_data["season"] = season
        watch_data["episode"] = episode
    
    watch_history_collection.update_one(
        {"user_id": user_id, "content_id": content_id},
        {"$set": watch_data},
        upsert=True
    )

@with_retry
def get_continue_watching(user_id, limit=10):
    """Get user's continue watching list"""
    return list(watch_history_collection.find(
        {"user_id": user_id, "progress": {"$gt": 0, "$lt": 100}}
    ).sort("last_watched", -1).limit(limit))

def close_connection():
    """Close database connection gracefully"""
    global client
    if client:
        client.close()
        logging.info("Database connection closed")