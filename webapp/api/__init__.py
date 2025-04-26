from flask import Blueprint, jsonify, request
from database import movies_collection, tv_shows_collection
from bson.objectid import ObjectId
import os
import logging

api_blueprint = Blueprint('api', __name__)
STORAGE_CHANNEL_ID = int(os.getenv("STORAGE_CHANNEL_ID"))
BOT_USERNAME = os.getenv("BOT_USERNAME")


@api_blueprint.route('/movies', methods=['GET'])
def get_movies():
    """
    Gets a list of all movies with channel_message_id.
    """
    try:
        movies = list(movies_collection.find(
            {"channel_message_id": {"$exists": True}},
            {
                "_id": 1,
                "title": 1,
                "details.name": 1,
                "details.overview": 1,
                "details.poster_path": 1,
                "details.release_date": 1,
                "language": 1
            }
        ))

        # Convert ObjectId to string
        for movie in movies:
            movie["_id"] = str(movie["_id"])

        return jsonify(movies)
    except Exception as e:
        logging.error(f"Error fetching movies: {e}")
        return jsonify({"error": str(e)}), 500

# Add the other API endpoints here (from Step 9)
# ...