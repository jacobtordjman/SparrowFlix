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
        """
        Handles the selection of a search result for upload.
        """
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
            navigate_tv_show(message, match, process_upload_search)  # Updated call

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

        # For movies, we don't need to extract an episode number
        if item_type == "movie":
            try:
                # Update movie document with file_id
                result = movies_collection.update_one(
                    {"_id": tv_show["_id"]},
                    {"$set": {"file_id": file_id}}
                )

                # Forward to storage channel
                metadata = {
                    "_id": tv_show["_id"],
                    "title": tv_show["title"],
                    "type": "movie",
                    "language": tv_show["language"]
                }
                channel_msg_id = forward_to_storage_channel(bot, file_id, metadata)

                if channel_msg_id:
                    bot.send_message(chat_id,
                                     f"Movie file ({file_name}) uploaded and forwarded to channel successfully.")
                else:
                    bot.send_message(chat_id,
                                     f"Movie file ({file_name}) uploaded successfully, but forwarding to channel failed.")
                return
            except Exception as e:
                logging.error(f"Error updating database: {e}")
                bot.send_message(chat_id, "An error occurred while updating the database.")
                return

        # For TV shows, extract episode number from filename
        match = re.match(r"(\d+)", file_name)
        if not match:
            bot.send_message(chat_id,
                             f"Caption '{file_name}' does not follow the expected format. It should start with the episode number (e.g., '1.mp4'). Skipping.")
            return

        episode_number = int(match.group(1))
        logging.debug(f"Processing file: {file_name}, Episode: {episode_number}, File ID: {file_id}")

        # TV show handling
        if item_type == "tv show" and season:
            try:
                # Check if this episode already exists
                existing_episode = tv_shows_collection.find_one(
                    {
                        "_id": tv_show["_id"],
                        "details.seasons.season_number": season["season_number"],
                        "details.seasons.episodes.episode_number": episode_number
                    }
                )

                # If episode exists, update it
                if existing_episode:
                    result = tv_shows_collection.update_one(
                        {
                            "_id": tv_show["_id"],
                            "details.seasons.season_number": season["season_number"],
                            "details.seasons.episodes.episode_number": episode_number
                        },
                        {"$set": {"details.seasons.$.episodes.$[ep].file_id": file_id}},
                        array_filters=[{"ep.episode_number": episode_number}]
                    )
                # If not, add it
                else:
                    result = tv_shows_collection.update_one(
                        {"_id": tv_show["_id"], "details.seasons.season_number": season["season_number"]},
                        {"$push": {
                            "details.seasons.$.episodes": {"episode_number": episode_number, "file_id": file_id}}}
                    )

                # Forward to storage channel
                metadata = {
                    "_id": tv_show["_id"],
                    "title": tv_show["title"],
                    "type": "tv show",
                    "language": tv_show["language"],
                    "season_number": season["season_number"],
                    "episode_number": episode_number
                }
                channel_msg_id = forward_to_storage_channel(bot, file_id, metadata)

                if channel_msg_id:
                    bot.send_message(chat_id,
                                     f"Episode {episode_number} ({file_name}) uploaded and forwarded to channel successfully.")
                else:
                    bot.send_message(chat_id,
                                     f"Episode {episode_number} ({file_name}) uploaded successfully, but forwarding to channel failed.")
            except Exception as e:
                logging.error(f"Error updating database: {e}")
                bot.send_message(chat_id, "An error occurred while updating the database.")
        else:
            bot.send_message(chat_id, "Invalid context for file upload. Please try again.")

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
        """
        Handles the upload process for a movie.
        """
        logging.debug(f"Preparing movie upload for: {movie['title']}")
        bot.send_message(
            message.chat.id,
            f"Uploading files for the movie: {movie['title']}. Please upload the file(s)."
        )
        bot.register_next_step_handler(message, process_file_upload_batch, movie, "movie")
    def navigate_tv_show(message, tv_show, back_callback):
        """
        Navigates seasons for a selected TV show.

        Args:
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
        bot.register_next_step_handler(message, process_season_selection_for_upload, tv_show, back_callback)

    def process_season_selection_for_upload(message, tv_show, back_callback):
        """
        Handles the selection of a season for upload.
        """
        logging.debug(f"Season selection for upload: {message.text}")

        if handle_back(message, back_callback, tv_show):
            return

        try:
            season_text = message.text.strip()
            season_number = int(season_text.replace("Season ", ""))

            # Find the selected season in the TV show details
            seasons = tv_show.get("details", {}).get("seasons", [])
            season = next((s for s in seasons if s["season_number"] == season_number), None)

            if not season:
                bot.send_message(message.chat.id, "Season not found. Please try again.")
                navigate_tv_show(message, tv_show, back_callback)
                return

            # Prompt user to upload files
            bot.send_message(
                message.chat.id,
                f"You selected {tv_show['title']} - Season {season_number}.\n\n"
                f"Please upload episode files with captions indicating the episode number.\n"
                f"For example, upload a file with caption '1' for Episode 1."
            )

            # Set up state for multiple file uploads
            context = {
                "tv_show": tv_show,
                "season_number": season_number,
                "season": season
            }

            # Register for the next file upload
            bot.register_next_step_handler(
                message,
                process_file_upload_batch,
                tv_show,
                "tv show",
                season
            )

        except ValueError:
            bot.send_message(message.chat.id, "Invalid season selection. Please try again.")
            navigate_tv_show(message, tv_show, back_callback)
            return


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

    def forward_to_storage_channel(bot, file_id, metadata, caption=None):
        """
        Forwards a file to the storage channel and saves the message ID.
        """
        try:
            # Prepare caption if not provided
            if not caption:
                caption = f"Title: {metadata['title']}\nType: {metadata['type'].capitalize()}\nLanguage: {metadata['language'].capitalize()}"

                # Add season and episode info for TV shows
                if metadata.get('season_number') and metadata.get('episode_number'):
                    caption += f"\nSeason: {metadata['season_number']}\nEpisode: {metadata['episode_number']}"

            # Send the file to the storage channel
            message = bot.send_document(
                STORAGE_CHANNEL_ID,
                file_id,
                caption=caption
            )

            logging.debug(f"File forwarded to channel. Message ID: {message.message_id}")

            # Store the message ID in the database
            if metadata.get('type') == 'movie':
                movies_collection.update_one(
                    {"_id": metadata["_id"]},
                    {"$set": {"channel_message_id": message.message_id}}
                )
            elif metadata.get('type') == 'tv show' and metadata.get('season_number') and metadata.get('episode_number'):
                # For TV shows, we need to update the specific episode
                tv_shows_collection.update_one(
                    {
                        "_id": metadata["_id"],
                        "details.seasons.season_number": metadata["season_number"],
                        "details.seasons.episodes.episode_number": metadata["episode_number"]
                    },
                    {"$set": {"details.seasons.$[s].episodes.$[e].channel_message_id": message.message_id}},
                    array_filters=[
                        {"s.season_number": metadata["season_number"]},
                        {"e.episode_number": metadata["episode_number"]}
                    ]
                )

            return message.message_id
        except Exception as e:
            logging.error(f"Error forwarding to storage channel: {e}")
            return None