import os
import re
import logging
import requests
from pymongo import MongoClient, errors
from dotenv import load_dotenv
from telebot import TeleBot
from telebot.types import ReplyKeyboardMarkup, KeyboardButton

# Load environment variables
load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
MONGO_URI = os.getenv("MONGO_URI")
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"

# Validate environment variables
if not BOT_TOKEN or not MONGO_URI or not TMDB_API_KEY:
    raise ValueError("One or more environment variables (BOT_TOKEN, MONGO_URI, TMDB_API_KEY) are missing or invalid.")

# Initialize bot and database
bot = TeleBot(BOT_TOKEN)
try:
    client = MongoClient(MONGO_URI)
    db = client['sparrowflix']
    movies_collection = db['movies']
    tv_shows_collection = db['tv_shows']
    movies_collection.create_index("title", unique=True)
    tv_shows_collection.create_index("title", unique=True)
except errors.ConnectionError as e:
    logging.critical(f"Failed to connect to MongoDB: {e}")
    raise

# Utility Functions
def create_keyboard(options):
    keyboard = ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    for option in options:
        keyboard.add(KeyboardButton(option))
    return keyboard

def create_keyboard_with_back(options):
    keyboard = create_keyboard(options)
    keyboard.add(KeyboardButton("Back"))
    return keyboard

def handle_back(message, callback_function, *args):
    if message.text.lower() == "back":
        logging.debug("User chose to go back.")
        callback_function(message, *args)
        return True
    return False

def validate_input(expected_values, user_input):
    return user_input.lower() in [value.lower() for value in expected_values]

def search_tmdb(title, item_type):
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

# Main Menu
@bot.message_handler(commands=['start'])
def start_handler(message):
    logging.debug(f"/start command received from user: {message.chat.id}")
    options = ["Add New Title", "Upload", "Fetch Movie/Episode"]
    keyboard = create_keyboard(options)
    bot.send_message(message.chat.id, "Welcome to SparrowFlix! Choose an option:", reply_markup=keyboard)

# Add New Title Workflow
@bot.message_handler(func=lambda message: message.text.lower() == "add new title")
def add_new_title_handler(message):
    logging.debug(f"Add New Title selected by user: {message.chat.id}")
    languages = ["English", "Hebrew", "Japanese"]
    keyboard = create_keyboard_with_back(languages)
    bot.send_message(message.chat.id, "Choose a language for the title:", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_language_selection_for_add)

def process_language_selection_for_add(message):
    logging.debug(f"Language selection: {message.text}")
    if handle_back(message, start_handler):
        return
    language = message.text.strip().lower()
    if not validate_input(["English", "Hebrew", "Japanese"], language):
        bot.send_message(message.chat.id, "Invalid language. Try again.")
        add_new_title_handler(message)
        return
    options = ["Movie", "TV Show"]
    keyboard = create_keyboard_with_back(options)
    bot.send_message(message.chat.id, "Is it a Movie or TV Show?", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_type_selection_for_add, language)

def process_type_selection_for_add(message, language):
    logging.debug(f"Type selection: {message.text}, Language: {language}")
    if handle_back(message, process_language_selection_for_add, language):
        return
    item_type = message.text.strip().lower()
    if not validate_input(["Movie", "TV Show"], item_type):
        bot.send_message(message.chat.id, "Invalid type. Try again.")
        process_language_selection_for_add(message)
        return
    msg = bot.send_message(message.chat.id, "Enter the title:")
    bot.register_next_step_handler(msg, process_title_entry, language, item_type)

def process_title_entry(message, language, item_type):
    logging.debug(f"Title entry: {message.text}, Language: {language}, Type: {item_type}")
    if handle_back(message, process_type_selection_for_add, language):
        return
    title = message.text.strip()
    results = search_tmdb(title, item_type)
    if not results:
        bot.send_message(message.chat.id, f"No matches found for '{title}'. Try again or type 'Back'.")
        bot.register_next_step_handler(message, process_title_entry, language, item_type)
        return
    options = [result.get('name', result.get('title')) for result in results[:5] if 'name' in result or 'title' in result] + ["Back"]
    keyboard = create_keyboard(options)
    bot.send_message(message.chat.id, "Select the closest match:", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_tmdb_selection, language, item_type, results)

def process_tmdb_selection(message, language, item_type, results):
    logging.debug(f"TMDB selection: {message.text}, Language: {language}, Type: {item_type}")
    if handle_back(message, process_title_entry, language, item_type):
        return
    selected_title = message.text.strip()
    match = next((result for result in results if (result.get('name') or result.get('title', '')).lower() == selected_title.lower()), None)
    if not match:
        bot.send_message(message.chat.id, "Invalid selection. Try again.")
        process_title_entry(message, language, item_type)
        return
    try:
        details = get_tmdb_details(match.get("id"), item_type)
        data = {
            "title": match.get("name", match.get("title")),
            "language": language,
            "type": item_type,
            "details": details,
            "created_at": message.date
        }
        collection = movies_collection if item_type == "movie" else tv_shows_collection
        inserted = collection.insert_one(data)
        logging.debug(f"Title inserted into DB with ID: {inserted.inserted_id}")

        bot.send_message(message.chat.id, f"Title '{data['title']}' added successfully.")
    except errors.DuplicateKeyError:
        bot.send_message(message.chat.id, "This title already exists in the database.")
    except Exception as e:
        logging.error(f"Error adding title to database: {e}")
        bot.send_message(message.chat.id, "An error occurred while saving.")
    start_handler(message)

# Upload Workflow
@bot.message_handler(func=lambda message: message.text.lower() == "upload")
def upload_handler(message):
    logging.debug(f"Upload workflow initiated by user: {message.chat.id}")
    languages = ["English", "Hebrew", "Japanese"]
    keyboard = create_keyboard_with_back(languages)
    bot.send_message(message.chat.id, "Choose a language for the upload:", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_language_selection_for_upload)

def process_language_selection_for_upload(message):
    logging.debug(f"Language selection for upload: {message.text}")
    if handle_back(message, start_handler):
        return
    language = message.text.strip().lower()
    if not validate_input(["English", "Hebrew", "Japanese"], language):
        bot.send_message(message.chat.id, "Invalid language selection. Try again.")
        upload_handler(message)
        return
    options = ["Movie", "TV Show"]
    keyboard = create_keyboard_with_back(options)
    bot.send_message(message.chat.id, "Is it a Movie or TV Show?", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_type_selection_for_upload, language)

def process_type_selection_for_upload(message, language):
    logging.debug(f"Type selection for upload: {message.text}, Language: {language}")
    if handle_back(message, process_language_selection_for_upload, language):
        return
    item_type = message.text.strip().lower()
    if not validate_input(["Movie", "TV Show"], item_type):
        bot.send_message(message.chat.id, "Invalid type. Try again.")
        process_language_selection_for_upload(message)
        return
    msg = bot.send_message(message.chat.id, f"Search for the {item_type} by name:")
    bot.register_next_step_handler(msg, process_upload_search, language, item_type)

def process_upload_search(message, language, item_type):
    logging.debug(f"Search query for upload: {message.text}, Type: {item_type}, Language: {language}")
    if handle_back(message, process_type_selection_for_upload, language):
        return
    query = message.text.strip()
    collection = movies_collection if item_type == "movie" else tv_shows_collection
    try:
        results = list(collection.find({"title": re.compile(f".*{re.escape(query)}.*", re.IGNORECASE)}))
    except Exception as e:
        logging.error(f"Database query error during upload search: {e}")
        bot.send_message(message.chat.id, "An error occurred while searching the database. Please try again.")
        return
    if not results:
        bot.send_message(message.chat.id, f"No matches found for '{query}'. Try again or type 'Back'.")
        bot.register_next_step_handler(message, process_upload_search, language, item_type)
        return
    options = [result["title"] for result in results[:5]] + ["Back"]
    keyboard = create_keyboard(options)
    bot.send_message(message.chat.id, "Select a match or type 'Back':", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_upload_selection, language, item_type, results)

def process_upload_selection(message, language, item_type, results):
    logging.debug(f"Selection for upload: {message.text}, Type: {item_type}, Language: {language}")
    if handle_back(message, process_upload_search, language, item_type):
        return
    selected_title = message.text.strip()
    match = next((result for result in results if result["title"].lower() == selected_title.lower()), None)
    if not match:
        bot.send_message(message.chat.id, "Invalid selection. Try again.")
        process_upload_search(message, language, item_type)
        return
    if item_type == "movie":
        handle_movie_upload(message, match)
    elif item_type == "tv show":
        navigate_tv_show(message, match)


def process_file_upload(message, item):
    logging.debug(f"File upload handler triggered for item: {item}")
    file_id = None
    if message.document:
        file_id = message.document.file_id
        logging.debug(f"Document file ID received: {file_id}")
    elif message.video:
        file_id = message.video.file_id
        logging.debug(f"Video file ID received: {file_id}")

    if not file_id:
        logging.warning(f"Invalid file upload attempt: {message}")
        bot.send_message(message.chat.id, "Invalid file. Please try again.")
        return

    try:
        if "tv_show_id" in item:  # For TV shows
            result = tv_shows_collection.update_one(
                {"_id": item["tv_show_id"], "details.seasons.season_number": item["season_number"]},
                {"$push": {"details.seasons.$.episodes": {"episode_number": item["episode_number"], "file_id": file_id}}}
            )
            logging.debug(f"Update result for TV show: {result.modified_count} document(s) updated.")
            bot.send_message(message.chat.id, f"Episode {item['episode_number']} uploaded successfully.")
        else:  # For movies
            result = movies_collection.update_one(
                {"_id": item["_id"]},
                {"$set": {"file_id": file_id}}
            )
            logging.debug(f"Update result for movie: {result.modified_count} document(s) updated.")
            bot.send_message(message.chat.id, f"Movie uploaded successfully.")
    except Exception as e:
        logging.error(f"Error during file upload update: {e}")
        bot.send_message(message.chat.id, "An error occurred while uploading.")
def handle_movie_upload(message, movie):
    logging.debug(f"Preparing movie upload for: {movie['title']}")
    bot.send_message(message.chat.id, f"Uploading for the movie: {movie['title']}. Please upload the file.")
    bot.register_next_step_handler(message, process_file_upload, movie)

def navigate_tv_show(message, tv_show):
    seasons = tv_show.get("details", {}).get("seasons", [])
    if not seasons:
        bot.send_message(message.chat.id, "No seasons found for this TV show.")
        start_handler(message)
        return
    options = [f"Season {season['season_number']}" for season in seasons] + ["Back"]
    keyboard = create_keyboard(options)
    bot.send_message(message.chat.id, "Select a season:", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_season_selection_for_upload, tv_show)

def process_season_selection_for_upload(message, tv_show):
    logging.debug(f"Season selection for upload: {message.text}, TV Show: {tv_show['title']}")
    if handle_back(message, navigate_tv_show, tv_show):
        return
    try:
        season_number = int(message.text.replace("Season ", "").strip())
        season = next((s for s in tv_show["details"]["seasons"] if s["season_number"] == season_number), None)
    except ValueError:
        bot.send_message(message.chat.id, "Invalid season format. Try again.")
        navigate_tv_show(message, tv_show)
        return
    if not season:
        bot.send_message(message.chat.id, "Invalid season. Try again.")
        navigate_tv_show(message, tv_show)
        return
    bot.send_message(message.chat.id, f"Uploading for Season {season_number}. Please upload episode 1.")
    bot.register_next_step_handler(message, process_episode_upload, tv_show, season_number, 1)

def process_episode_upload(message, tv_show, season_number, episode_number):
    logging.debug(f"File upload handler triggered for Season {season_number}, Episode {episode_number} of TV Show: {tv_show['title']}")
    file_id = None
    if message.document:
        file_id = message.document.file_id
        logging.debug(f"Document file ID received: {file_id}")
    elif message.video:
        file_id = message.video.file_id
        logging.debug(f"Video file ID received: {file_id}")

    if not file_id:
        logging.warning(f"Invalid file upload attempt: {message}")
        bot.send_message(message.chat.id, "Invalid file. Please try again.")
        return

    try:
        result = tv_shows_collection.update_one(
            {"_id": tv_show["_id"], "details.seasons.season_number": season_number},
            {"$push": {"details.seasons.$.episodes": {"episode_number": episode_number, "file_id": file_id}}}
        )
        logging.debug(f"Update result for TV show: {result.modified_count} document(s) updated.")
        bot.send_message(message.chat.id, f"Episode {episode_number} uploaded successfully.")
        bot.send_message(message.chat.id, f"Please upload episode {episode_number + 1} or type 'Back' to return.")
        bot.register_next_step_handler(message, process_episode_upload, tv_show, season_number, episode_number + 1)
    except Exception as e:
        logging.error(f"Error during file upload update: {e}")
        bot.send_message(message.chat.id, "An error occurred while uploading.")

# Fetch Workflow
@bot.message_handler(func=lambda message: message.text.lower() == "fetch movie/episode")
def fetch_handler(message):
    logging.debug(f"Fetch workflow initiated by user: {message.chat.id}")
    languages = ["English", "Hebrew", "Japanese"]
    keyboard = create_keyboard_with_back(languages)
    bot.send_message(message.chat.id, "Choose a language to fetch titles:", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_language_selection_for_fetch)

def process_language_selection_for_fetch(message):
    logging.debug(f"Language selection for fetch: {message.text}")
    if handle_back(message, start_handler):
        return
    language = message.text.strip().lower()
    if not validate_input(["English", "Hebrew", "Japanese"], language):
        bot.send_message(message.chat.id, "Invalid language selection. Try again.")
        fetch_handler(message)
        return

def process_fetch_filter_method(message, language):
    logging.debug(f"Fetch filter method selection: {message.text}")
    if handle_back(message, process_language_selection_for_fetch, language):
        return
    choice = message.text.lower()
    if choice == "categories":
        bot.send_message(message.chat.id, "Fetching by categories is not implemented yet.")
        fetch_handler(message)
    elif choice == "all titles":
        try:
            titles = list(
                tv_shows_collection.find({"language": language}) +
                movies_collection.find({"language": language})
            )
            if not titles:
                bot.send_message(message.chat.id, "No titles found. Please try another method.")
                fetch_handler(message)
                return
            options = [title["title"] for title in titles] + ["Back"]
            keyboard = create_keyboard(options)
            bot.send_message(message.chat.id, "Select a title:", reply_markup=keyboard)
            bot.register_next_step_handler(message, process_fetch_selection, titles)
        except Exception as e:
            logging.error(f"Error during fetching titles: {e}")
            bot.send_message(message.chat.id, "An error occurred while fetching titles.")

def process_fetch_selection(message, titles):
    logging.debug(f"Fetch title selection: {message.text}")
    if handle_back(message, fetch_handler):
        return
    selected_title = message.text.strip()
    match = next((title for title in titles if title["title"].lower() == selected_title.lower()), None)
    if not match:
        bot.send_message(message.chat.id, "Invalid selection. Please try again.")
        fetch_handler(message)
        return
    if match.get("type") == "movie":
        send_movie_details(message, match)
    elif match.get("type") == "tv show":
        navigate_tv_show_for_fetch(message, match)

def send_movie_details(message, movie):
    details = movie.get("details", {})
    response = f"Title: {details.get('name', 'N/A')}\nOverview: {details.get('overview', 'N/A')}\nRelease Date: {details.get('release_date', 'N/A')}"
    bot.send_message(message.chat.id, response)
    file_id = movie.get("file_id")
    if file_id:
        bot.send_message(message.chat.id, "Here is the movie file:")
        bot.send_document(message.chat.id, file_id)
    else:
        bot.send_message(message.chat.id, "No file has been uploaded for this movie yet.")

def navigate_tv_show_for_fetch(message, tv_show):
    seasons = tv_show.get("details", {}).get("seasons", [])
    if not seasons:
        bot.send_message(message.chat.id, "No seasons found for this TV show.")
        fetch_handler(message)
        return
    options = [f"Season {season['season_number']}" for season in seasons] + ["Back"]
    keyboard = create_keyboard(options)
    bot.send_message(message.chat.id, "Select a season:", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_season_selection_for_fetch, tv_show)

def process_season_selection_for_fetch(message, tv_show):
    logging.debug(f"Season selection for fetch: {message.text}")
    if handle_back(message, navigate_tv_show_for_fetch, tv_show):
        return
    try:
        season_number = int(message.text.replace("Season ", "").strip())
        season = next((s for s in tv_show["details"]["seasons"] if s["season_number"] == season_number), None)
    except ValueError:
        bot.send_message(message.chat.id, "Invalid season format. Try again.")
        navigate_tv_show_for_fetch(message, tv_show)
        return
    if not season:
        bot.send_message(message.chat.id, "Invalid season. Try again.")
        navigate_tv_show_for_fetch(message, tv_show)
        return
    episodes = season.get("episodes", [])
    options = [f"Episode {ep['episode_number']}" for ep in episodes if ep.get("file_id")] + ["Back"]
    keyboard = create_keyboard(options)
    bot.send_message(message.chat.id, "Select an episode:", reply_markup=keyboard)
    bot.register_next_step_handler(message, process_episode_fetch, season)

def process_episode_fetch(message, season):
    logging.debug(f"Episode selection for fetch: {message.text}")
    if handle_back(message, process_season_selection_for_fetch, season):
        return
    try:
        episode_number = int(message.text.replace("Episode ", "").strip())
        episode = next((ep for ep in season["episodes"] if ep["episode_number"] == episode_number), None)
    except ValueError:
        bot.send_message(message.chat.id, "Invalid episode format. Try again.")
        process_season_selection_for_fetch(message, season)
        return
    if not episode or not episode.get("file_id"):
        bot.send_message(message.chat.id, "Invalid episode or not uploaded. Try again.")
        process_season_selection_for_fetch(message, season)
        return
    bot.send_message(message.chat.id, f"Fetching episode {episode_number}.")
    bot.send_document(message.chat.id, episode["file_id"])

# Start Polling
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
    bot.infinity_polling()
