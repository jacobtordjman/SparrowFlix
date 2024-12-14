import logging
import requests
from telebot.types import ReplyKeyboardMarkup, KeyboardButton
import os

# TMDB API Base URL and API Key
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

if not TMDB_API_KEY:
    raise ValueError("TMDB_API_KEY is missing or invalid.")

# Utility Functions
def create_keyboard(options):
    """
    Creates a Telegram reply keyboard with given options.
    """
    keyboard = ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    for option in options:
        keyboard.add(KeyboardButton(option))
    return keyboard

def create_keyboard_with_back(options):
    """
    Creates a Telegram reply keyboard with given options and adds a 'Back' button.
    """
    keyboard = create_keyboard(options)
    keyboard.add(KeyboardButton("Back"))
    return keyboard

def handle_back(message, callback_function, *args):
    """
    Handles 'Back' navigation for user workflows.
    """
    if message.text.lower() == "back":
        logging.debug("User chose to go back.")
        callback_function(message, *args)
        return True
    return False

def validate_input(expected_values, user_input):
    """
    Validates if user input matches any of the expected values (case-insensitive).
    """
    return user_input.lower() in [value.lower() for value in expected_values]

def search_tmdb(title, item_type):
    """
    Searches TMDB for a given title and item type (movie or tv).
    Returns a list of results.
    """
    try:
        logging.debug(f"Searching TMDB for title: {title}, type: {item_type}")
        endpoint = f"{TMDB_BASE_URL}/search/{'movie' if item_type == 'movie' else 'tv'}"
        params = {"api_key": TMDB_API_KEY, "query": title, "language": "en-US"}
        response = requests.get(endpoint, params=params)
        response.raise_for_status()
        results = response.json().get("results", [])
        logging.debug(f"TMDB search results: {results}")
        return results
    except requests.RequestException as e:
        logging.error(f"TMDB API request failed: {e}")
        return []

def get_tmdb_details(item_id, item_type):
    """
    Fetches detailed information from TMDB for a given item ID and type (movie or tv).
    """
    try:
        logging.debug(f"Fetching TMDB details for ID: {item_id}, type: {item_type}")
        endpoint = f"{TMDB_BASE_URL}/{'movie' if item_type == 'movie' else 'tv'}/{item_id}"
        params = {"api_key": TMDB_API_KEY, "language": "en-US", "append_to_response": "episodes"}
        response = requests.get(endpoint, params=params)
        response.raise_for_status()
        details = response.json()
        logging.debug(f"TMDB details fetched: {details}")
        return details
    except requests.RequestException as e:
        logging.error(f"TMDB details request failed: {e}")
        return {}
