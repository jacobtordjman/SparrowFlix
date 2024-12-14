# Imports
import logging
import re
from telebot import TeleBot
from database import movies_collection, tv_shows_collection
from utils import (
    create_keyboard,
    create_keyboard_with_back,
    handle_back,
    validate_input
)

def register_upload_handlers(bot):
    @bot.message_handler(func=lambda message: message.text.lower() == "upload")
    def upload_handler(message):
        """
        Entry point for the upload workflow.
        """
        languages = ["English", "Hebrew", "Japanese"]
        keyboard = create_keyboard_with_back(languages)
        bot.send_message(message.chat.id, "Choose a language for the upload:", reply_markup=keyboard)
        bot.register_next_step_handler(message, process_language_selection_for_upload)

    def process_language_selection_for_upload(message):
        """
        Handles language selection for uploads.
        """
        if handle_back(message, upload_handler):
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

    def navigate_tv_show(bot, message, tv_show, back_callback):
        """
        Navigates seasons for a selected TV show.

        Args:
            bot: The bot instance.
            message: The message object from the user.
            tv_show: The selected TV show dictionary with details.
            back_callback: The function to call when the user selects 'Back'.
        """
        seasons = tv_show.get("details", {}).get("seasons", [])
        if not seasons:
            bot.send_message(message.chat.id, "No seasons found for this TV show.")
            back_callback(message)
            return

        # Create a list of seasons with a 'Back' option
        options = [f"Season {season['season_number']}" for season in seasons] + ["Back"]
        keyboard = create_keyboard(options)
        bot.send_message(message.chat.id, "Select a season:", reply_markup=keyboard)

        # Register the next step to handle season selection
        bot.register_next_step_handler(message, process_season_selection_for_upload, bot, tv_show, back_callback)

    def process_season_selection_for_upload(message, bot, tv_show, back_callback):
        """
        Processes the user's season selection for a TV show.

        Args:
            message: The message object from the user.
            bot: The bot instance.
            tv_show: The selected TV show dictionary with details.
            back_callback: The function to call when the user selects 'Back'.
        """
        if handle_back(message, navigate_tv_show, bot, tv_show, back_callback):
            return

        try:
            # Extract and validate the selected season number
            season_number = int(message.text.replace("Season ", "").strip())
            season = next((s for s in tv_show["details"]["seasons"] if s["season_number"] == season_number), None)
        except (ValueError, StopIteration):
            bot.send_message(message.chat.id, "Invalid season selection. Please try again.")
            navigate_tv_show(bot, message, tv_show, back_callback)
            return

        if not season:
            bot.send_message(message.chat.id, "Invalid season. Please try again.")
            navigate_tv_show(bot, message, tv_show, back_callback)
            return

        bot.send_message(message.chat.id, f"You selected Season {season_number}. Proceeding with the next step.")
        # Next steps for the selected season can be added here.

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
