# Imports
import os
from dotenv import load_dotenv
import tempfile
import logging
import re
import time
from telebot import TeleBot
from database import movies_collection, tv_shows_collection
from utils import (
    create_keyboard,
    create_keyboard_with_back,
    handle_back,
    validate_input
)

load_dotenv()
STORAGE_CHANNEL_ID = int(os.getenv("STORAGE_CHANNEL_ID"))


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
            navigate_tv_show(bot, message, match, process_upload_search)  # Pass required arguments

    def process_file_upload_batch(message, tv_show=None, item_type=None, season=None):
        """
        Processes uploaded files for a TV show or movie, relying on captions for filenames.
        """
        chat_id = message.chat.id
        logging.debug(
            f"Processing file upload: chat_id={chat_id}, tv_show={tv_show}, item_type={item_type}, season={season}")
        if message.content_type not in ['document', 'video']:
            bot.send_message(chat_id, "Please upload a valid file (video or document).")
            return
        file = message.document if message.content_type == 'document' else message.video
        file_id = file.file_id
        caption = message.caption  # Extract caption provided during file upload
        if not caption:
            bot.send_message(chat_id, "Filename missing. Please upload the file again with a caption (e.g., '1.mp4').")
            return
        file_name = caption.strip()
        logging.debug(f"File ID: {file_id}, Filename from caption: {file_name}")
        # Extract episode number from caption
        match = re.match(r"(\d+)", file_name)
        if not match:
            bot.send_message(chat_id, f"Caption '{file_name}' does not follow the expected format. Skipping.")
            return
        episode_number = int(match.group(1))
        logging.debug(f"Processing file: {file_name}, Episode: {episode_number}, File ID: {file_id}")
        # Prepare a descriptive caption for the channel
        if item_type == "tv show" and season:
            channel_caption = f"TV: {tv_show['title']} - S{season['season_number']}E{episode_number} ({tv_show.get('language', 'Unknown')})"
        elif item_type == "movie":
            channel_caption = f"Movie: {tv_show['title']} ({tv_show.get('language', 'Unknown')})"
        else:
            channel_caption = file_name
        try:
            # Forward the file to the storage channel
            if message.content_type == 'document':
                forwarded = bot.send_document(STORAGE_CHANNEL_ID, file_id, caption=channel_caption)
            else:  # video
                forwarded = bot.send_video(STORAGE_CHANNEL_ID, file_id, caption=channel_caption)

            # Generate a permanent message link
            # For a private channel, we need to use the numeric ID format
            channel_id_str = str(STORAGE_CHANNEL_ID).replace('-100', '')
            message_link = f"https://t.me/c/{channel_id_str}/{forwarded.message_id}"

            logging.debug(f"File forwarded to channel. Message link: {message_link}")

            # Store both file_id and message_link in database
            if item_type == "tv show" and season:
                result = tv_shows_collection.update_one(
                    {"_id": tv_show["_id"], "details.seasons.season_number": season["season_number"]},
                    {"$push": {"details.seasons.$.episodes": {
                        "episode_number": episode_number,
                        "file_id": file_id,
                        "message_link": message_link
                    }}}
                )
                bot.send_message(chat_id, f"Episode {episode_number} ({file_name}) uploaded successfully.")
            elif item_type == "movie":
                result = movies_collection.update_one(
                    {"_id": tv_show["_id"]},
                    {"$set": {
                        "file_id": file_id,
                        "message_link": message_link
                    }}
                )
                bot.send_message(chat_id, f"Movie file ({file_name}) uploaded successfully.")

        except Exception as e:
            logging.error(f"Error in file upload process: {e}")
            bot.send_message(chat_id, "An error occurred while processing your upload. Please try again.")

    # Temporary dictionary to store media group messages
    media_groups = {}

    @bot.message_handler(content_types=['video', 'document'], func=lambda message: message.media_group_id is not None)
    def handle_media_group(message):
        """
        Handles incoming media group files (batch uploads).
        """
        media_group_id = message.media_group_id
        chat_id = message.chat.id

        # Log the received message
        logging.debug(f"Received message type: {type(message)}, media_group_id: {media_group_id}")

        # Collect messages belonging to the same media group
        if media_group_id not in media_groups:
            media_groups[media_group_id] = []
            logging.debug(f"New media group started: {media_group_id}")

        media_groups[media_group_id].append(message)
        logging.debug(f"File added to media group {media_group_id}: {message}")

        # If we already collected multiple files, process them
        if len(media_groups[media_group_id]) > 1:
            logging.debug(f"Processing media group {media_group_id}")
            process_file_upload_batch(media_groups[media_group_id], chat_id)
            del media_groups[media_group_id]  # Cleanup

    def process_files(messages, chat_id):
        """
        Processes the collected files from a media group.
        """
        for msg in messages:
            if msg.content_type == 'document':
                file = msg.document
            elif msg.content_type == 'video':
                file = msg.video
            else:
                continue

            file_id = file.file_id
            file_name = getattr(file, "file_name", "unknown_file")
            logging.debug(f"Processing file: {file_name}, ID: {file_id}")

            # Extract episode number (assumes filename starts with a number)
            match = re.match(r"(\d+)", file_name)
            if not match:
                bot.send_message(chat_id, f"File {file_name} does not follow the expected format. Skipping.")
                continue

            episode_number = int(match.group(1))
            logging.debug(f"Extracted episode number: {episode_number}")

            # Simulate processing/upload logic (replace with your DB logic)
            bot.send_message(chat_id, f"Episode {episode_number} ({file_name}) uploaded successfully.")

    def handle_movie_upload(message, movie):
        logging.debug(f"Preparing movie upload for: {movie['title']}")
        bot.send_message(message.chat.id,
                         f"Uploading files for the movie: {movie['title']}. Please upload the file(s).")
        bot.register_next_step_handler(message, process_file_upload_batch, movie, "movie")

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
        Handles the user's selection of a season and initiates batch uploads.
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

        # Prompt for batch upload
        bot.send_message(
            message.chat.id,
            f"Uploading files for Season {season_number}. Please upload all episodes (e.g., 1.mp4, 2.avi)."
        )
        bot.register_next_step_handler(message, process_file_upload_batch, tv_show, "tv show", season)

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
