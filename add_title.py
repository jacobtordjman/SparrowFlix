# Imports
import logging
from telebot import TeleBot
from database import movies_collection, tv_shows_collection
from utils import (
    create_keyboard,
    create_keyboard_with_back,
    handle_back,
    validate_input,
    search_tmdb,
    get_tmdb_details
)

# Middleware to check for global commands (/stop and /start)
def check_global_commands(bot, message, next_step, *args):
    """
    Middleware to check for global commands before proceeding to the next handler step.
    """
    if message.text == "/stop":
        bot.send_message(message.chat.id, "Bot is stopping. Goodbye!")
        logging.info(f"Bot stopped by user: {message.chat.id}")
        import os
        os._exit(0)
    elif message.text == "/start":
        from bot import start_command  # Import start_command for reuse
        start_command(message)
    else:
        next_step(message, *args)

# Function to register handlers
def register_add_title_handlers(bot):
    """
    Registers all handlers related to the "Add New Title" workflow.
    """

    @bot.message_handler(func=lambda message: message.text.lower() == "add new title")
    def add_new_title_handler(message):
        """
        Entry point for adding a new title.
        """
        logging.debug(f"Add New Title selected by user: {message.chat.id}")
        languages = ["English", "Hebrew", "Japanese"]
        keyboard = create_keyboard_with_back(languages)
        bot.send_message(message.chat.id, "Choose a language for the title:", reply_markup=keyboard)
        bot.register_next_step_handler(message, lambda msg: check_global_commands(bot, msg, process_language_selection_for_add))

    def process_language_selection_for_add(message):
        """
        Handles language selection for the new title.
        """
        logging.debug(f"Language selection: {message.text}")
        if handle_back(message, add_new_title_handler):
            return
        language = message.text.strip().lower()
        if not validate_input(["English", "Hebrew", "Japanese"], language):
            bot.send_message(message.chat.id, "Invalid language. Try again.")
            add_new_title_handler(message)
            return
        options = ["Movie", "TV Show"]
        keyboard = create_keyboard_with_back(options)
        bot.send_message(message.chat.id, "Is it a Movie or TV Show?", reply_markup=keyboard)
        bot.register_next_step_handler(
            message, lambda msg: check_global_commands(bot, msg, process_type_selection_for_add, language)
        )

    def process_type_selection_for_add(message, language):
        """
        Handles type (Movie or TV Show) selection for the new title.
        """
        logging.debug(f"Type selection: {message.text}, Language: {language}")
        if handle_back(message, process_language_selection_for_add, language):
            return
        item_type = message.text.strip().lower()
        if not validate_input(["Movie", "TV Show"], item_type):
            bot.send_message(message.chat.id, "Invalid type. Try again.")
            process_language_selection_for_add(message)
            return
        msg = bot.send_message(message.chat.id, "Enter the title:")
        bot.register_next_step_handler(
            msg, lambda msg: check_global_commands(bot, msg, process_title_entry, language, item_type)
        )

    def process_title_entry(message, language, item_type):
        """
        Handles title entry and searches TMDB for matches.
        """
        logging.debug(f"Title entry: {message.text}, Language: {language}, Type: {item_type}")
        if handle_back(message, process_type_selection_for_add, language):
            return
        title = message.text.strip()
        results = search_tmdb(title, item_type)
        if not results:
            bot.send_message(message.chat.id, f"No matches found for '{title}'. Try again or type 'Back'.")
            bot.register_next_step_handler(
                message, lambda msg: check_global_commands(bot, msg, process_title_entry, language, item_type)
            )
            return
        options = [
            result.get('name', result.get('title'))
            for result in results[:5]
            if 'name' in result or 'title' in result
        ] + ["Back"]
        keyboard = create_keyboard(options)
        bot.send_message(message.chat.id, "Select the closest match:", reply_markup=keyboard)
        bot.register_next_step_handler(
            message, lambda msg: check_global_commands(bot, msg, process_tmdb_selection, language, item_type, results)
        )

    def process_tmdb_selection(message, language, item_type, results):
        """
        Handles TMDB selection and saves the selected title to the database.
        """
        logging.debug(f"TMDB selection: {message.text}, Language: {language}, Type: {item_type}")
        if handle_back(message, process_title_entry, language, item_type):
            return
        selected_title = message.text.strip()
        match = next(
            (result for result in results if (result.get('name') or result.get('title', '')).lower() == selected_title.lower()),
            None
        )
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
        except Exception as e:
            if isinstance(e, Exception) and hasattr(e, 'details') and 'key' in e.details:
                bot.send_message(message.chat.id, "This title already exists in the database.")
            else:
                bot.send_message(message.chat.id, "An error occurred while saving the title. Try again later.")
