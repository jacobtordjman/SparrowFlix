# Imports
import json
import logging
from database import movies_collection, tv_shows_collection
from utils import (
    create_keyboard,
    create_keyboard_with_back,
    handle_back,
    validate_input
)

def register_fetch_handlers(bot):
    @bot.message_handler(func=lambda message: message.text.lower() == "fetch")
    def fetch_handler(message):
        """
        Entry point for fetching a movie or episode.
        """
        # If global commands like /stop or /start are detected
        if check_global_commands(message):
            return

        # Define available languages
        languages = ["English", "Hebrew", "Japanese"]

        # Send message with a keyboard for language selection
        keyboard = create_keyboard_with_back(languages)
        bot.send_message(
            message.chat.id,
            "Choose a language to fetch titles:",
            reply_markup=keyboard
        )

        # Move to the next step to handle language selection
        bot.register_next_step_handler(message, process_language_selection_for_fetch)

    def process_language_selection_for_fetch(message):
        """
        Handles language selection for fetching.
        """
        if check_global_commands(message): return
        if handle_back(message, fetch_handler):
            return
        language = message.text.strip().lower()
        if not validate_input(["English", "Hebrew", "Japanese"], language):
            bot.send_message(message.chat.id, "Invalid language selection. Try again.")
            fetch_handler(message)
            return
        options = ["Movies", "TV Shows", "Back"]
        keyboard = create_keyboard(options)
        bot.send_message(message.chat.id, "Do you want to fetch Movies or TV Shows?", reply_markup=keyboard)
        bot.register_next_step_handler(message, process_fetch_content_type, language)

    def process_fetch_content_type(message, language):
        """
        Handles content type selection for fetching.
        """
        if check_global_commands(message): return
        if handle_back(message, process_language_selection_for_fetch, language):
            return
        content_type = message.text.strip().lower()
        if content_type not in ["movies", "tv shows"]:
            bot.send_message(message.chat.id, "Invalid selection. Please choose Movies or TV Shows.")
            process_language_selection_for_fetch(message)
            return
        process_fetch_filter_method(message, language, content_type)

    def process_fetch_filter_method(message, language, content_type):
        """
        Fetches movies or TV shows based on the selected language and content type.
        """
        if check_global_commands(message): return
        try:
            collection = movies_collection if content_type == "movies" else tv_shows_collection
            titles = list(collection.find({"language": language.lower()}))

            if not titles:
                bot.send_message(message.chat.id, f"No {content_type} found in the selected language.")
                fetch_handler(message)
                return

            options = [title["title"] for title in titles] + ["Back"]
            keyboard = create_keyboard(options)
            bot.send_message(message.chat.id, f"Select a {content_type[:-1]}:", reply_markup=keyboard)
            bot.register_next_step_handler(message, process_fetch_selection, titles)
        except Exception as e:
            logging.error(f"Error during fetching titles: {e}")
            bot.send_message(message.chat.id, "An error occurred while fetching titles. Please try again.")

    def process_fetch_selection(message, titles):
        """
        Handles the selection of a fetched movie or TV show.
        """
        if check_global_commands(message): return
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
        """
        Sends details of the selected movie and file if available.
        """
        if check_global_commands(message): return
        details = movie.get("details", {})
        response = (
            f"Title: {details.get('name', 'N/A')}\n"
            f"Overview: {details.get('overview', 'N/A')}\n"
            f"Release Date: {details.get('release_date', 'N/A')}"
        )
        bot.send_message(message.chat.id, response)

        file_id = movie.get("file_id")
        if file_id:
            bot.send_message(message.chat.id, "Here is the movie file:")
            bot.send_document(message.chat.id, file_id)
        else:
            bot.send_message(message.chat.id, "No file has been uploaded for this movie yet.")

    def navigate_tv_show_for_fetch(message, tv_show):
        """
        Handles navigation of TV show seasons.
        """
        if check_global_commands(message): return
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

        # Handle back navigation
        if handle_back(message, navigate_tv_show_for_fetch, tv_show):
            return

        try:
            # Extract the season number and find the matching season
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

        # Add `tv_show` data to the season dictionary
        season["tv_show"] = tv_show

        # Display the episode selection menu
        episodes = season.get("episodes", [])
        options = [f"Episode {ep['episode_number']}" for ep in episodes if ep.get("file_id")] + ["Back"]
        keyboard = create_keyboard(options)
        bot.send_message(message.chat.id, "Select an episode or press 'Back':", reply_markup=keyboard)
        bot.register_next_step_handler(message, process_episode_fetch, season)

    def process_episode_fetch(message, season):
        logging.debug(f"Episode selection for fetch: {message.text}")

        # Handle back navigation
        if handle_back(message, process_season_selection_for_fetch, season["tv_show"]):
            return

        try:
            # Extract episode number and find the matching episode
            episode_number = int(message.text.replace("Episode ", "").strip())
            episode = next((ep for ep in season["episodes"] if ep["episode_number"] == episode_number), None)
        except ValueError:
            bot.send_message(message.chat.id, "Invalid episode format. Try again.")
            process_season_selection_for_fetch(message, season["tv_show"])
            return

        if not episode or not episode.get("file_id"):
            bot.send_message(message.chat.id, "Invalid episode or not uploaded. Try again.")
            process_season_selection_for_fetch(message, season["tv_show"])
            return

        # Fetch and send the episode file
        bot.send_message(message.chat.id, f"Fetching episode {episode_number}.")
        bot.send_document(message.chat.id, episode["file_id"])

        # Redisplay the episode selection menu
        options = [f"Episode {ep['episode_number']}" for ep in season["episodes"] if ep.get("file_id")] + ["Back"]
        keyboard = create_keyboard(options)
        bot.send_message(message.chat.id, "Select another episode or press 'Back':", reply_markup=keyboard)
        bot.register_next_step_handler(message, process_episode_fetch, season)

    def check_global_commands(message):
        if message.text.strip().lower() == "/stop":
            bot.send_message(message.chat.id, "Bot stopping. Goodbye!")
            # replit change
            import os
            os._exit(0)
            # replit change
        if message.text.strip().lower() == "/start":
            bot.send_message(message.chat.id, "Restarting the bot...")
            return True  # Stop further handlers
        return False
