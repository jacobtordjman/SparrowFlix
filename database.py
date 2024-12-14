from pymongo import MongoClient, errors
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()

# Fetch MONGO_URI from environment variables
MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise ValueError("MONGO_URI is missing or invalid.")

try:
    # Initialize MongoDB client and database
    client = MongoClient(MONGO_URI)
    db = client['sparrowflix']
    movies_collection = db['movies']
    tv_shows_collection = db['tv_shows']

    # Create unique indexes for the collections
    movies_collection.create_index("title", unique=True)
    tv_shows_collection.create_index("title", unique=True)
except errors.ConnectionError as e:
    raise ConnectionError(f"Failed to connect to MongoDB: {e}")
