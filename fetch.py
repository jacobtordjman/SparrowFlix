# Imports
import logging
from database import movies_collection, tv_shows_collection
from utils import (
    create_keyboard,
    create_keyboard_with_back,
    handle_back,
    validate_input
)


def register_fetch_handlers(bot):
    @bot.message_handler(func=lambda message: message.text.lower() == "fetch movie/episode")
    def fetch_handler(message):
        """
        Entry point for fetching a movie or episode.
        """
        languages = ["English", "Hebrew", "Japanese"]
        keyboard = create_keyboard_with_back(languages)
        bot.send_message(message.chat.id, "Choose a language to fetch titles:", reply_markup=keyboard)
        bot.register_next_step_handler(message, process_language_selection_for_fetch)

    def process_fetch_content_type(message, language):
        logging.debug(f"Content type selection for fetch: {message.text}")
        if handle_back(message, process_language_selection_for_fetch):
            return
        content_type = message.text.strip().lower()
        if content_type not in ["movies", "tv shows"]:
            bot.send_message(message.chat.id, "Invalid selection. Please choose Movies or TV Shows.")
            process_language_selection_for_fetch(message)
            return
        # Call the method to fetch the appropriate content
        process_fetch_filter_method(message, language, content_type)

    def process_language_selection_for_fetch(message):
        """
        Handles language selection for fetching.
        """
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

    def process_fetch_filter_method(message, language, content_type):
        logging.debug(f"Processing fetch filter for language: {language}, content type: {content_type}")
        try:
            # Fetch based on content type
            if content_type == "movies":
                titles = list(movies_collection.find({"language": language.lower()}))
            elif content_type == "tv shows":
                titles = list(tv_shows_collection.find({"language": language.lower()}))
            else:
                bot.send_message(message.chat.id, "Unknown content type selected. Please try again.")
                return

            logging.debug(f"Fetched titles: {titles}")  # Log fetched titles for debugging

            if not titles:
                bot.send_message(message.chat.id, f"No {content_type} found in the selected language.")
                fetch_handler(message)  # Restart fetch workflow
                return

            # Prepare options for user
            options = [title["title"] for title in titles] + ["Back"]
            keyboard = create_keyboard(options)
            bot.send_message(message.chat.id, f"Select a {content_type[:-1]}:", reply_markup=keyboard)
            bot.register_next_step_handler(message, process_fetch_selection, titles)
        except Exception as e:
            logging.error(f"Error during fetching titles: {e}")
            bot.send_message(message.chat.id, "An error occurred while fetching titles. Please try again.")

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
        else:
            bot.send_message(message.chat.id, "Unknown type. Please try again.")
            fetch_handler(message)

    def send_movie_details(message, movie):
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

        # Redisplay the movie menu
        titles = list(movies_collection.find({"language": movie["language"]}))
        options = [title["title"] for title in titles] + ["Back"]
        keyboard = create_keyboard(options)
        bot.send_message(message.chat.id, "Select another movie or press 'Back':", reply_markup=keyboard)
        bot.register_next_step_handler(message, process_fetch_selection, titles)

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

        # Add `tv_show` to the season dictionary
        season["tv_show"] = tv_show

        # Display episode selection menu
        episodes = season.get("episodes", [])
        options = [f"Episode {ep['episode_number']}" for ep in episodes if ep.get("file_id")] + ["Back"]
        keyboard = create_keyboard(options)
        bot.send_message(message.chat.id, "Select an episode or press 'Back':", reply_markup=keyboard)
        bot.register_next_step_handler(message, process_episode_fetch, season)

    def process_episode_fetch(message, season):
        logging.debug(f"Episode selection for fetch: {message.text}")
        if handle_back(message, process_season_selection_for_fetch, season["tv_show"]):
            return
        try:
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

        # Fetch the episode file
        bot.send_message(message.chat.id, f"Fetching episode {episode_number}.")
        bot.send_document(message.chat.id, episode["file_id"])

        # Redisplay the same menu
        options = [f"Episode {ep['episode_number']}" for ep in season["episodes"] if ep.get("file_id")] + ["Back"]
        keyboard = create_keyboard(options)
        bot.send_message(message.chat.id, "Select another episode or press 'Back':", reply_markup=keyboard)
        bot.register_next_step_handler(message, process_episode_fetch, season)
