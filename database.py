import logging
import logging
import os
from pymongo import MongoClient, IndexModel, ASCENDING
from pymongo import errors
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "sparrowflix")

try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    # Collections
    movies_collection = db["movies"]
    tv_shows_collection = db["tv_shows"]

    # Create indexes only if they don't exist
    try:
        # Use create_indexes with explicit index options
        existing_movie_indexes = [idx["name"] for idx in movies_collection.list_indexes()]
        existing_tv_indexes = [idx["name"] for idx in tv_shows_collection.list_indexes()]

        if "title_1" not in existing_movie_indexes:
            movies_collection.create_index("title")
            logging.info("Created index on movies.title")

        if "title_1" not in existing_tv_indexes:
            tv_shows_collection.create_index("title")
            logging.info("Created index on tv_shows.title")

    except Exception as e:
        logging.warning(f"Index creation warning (can be ignored if indexes already exist): {e}")

    logging.info("Connected to MongoDB successfully.")

except Exception as e:
    logging.error(f"MongoDB Connection Error: {e}")
    raise

# Add to database.py after existing indexes
# Create indexes for channel message IDs
movies_collection.create_index("channel_message_id", sparse=True)
tv_shows_collection.create_index("channel_message_id", sparse=True)

# Create index for scheduled streaming (will be used later)
movies_collection.create_index("last_played", sparse=True)
tv_shows_collection.create_index("last_played", sparse=True)
