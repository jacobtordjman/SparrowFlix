import os
import logging
from telebot import types
from database import movies_collection, tv_shows_collection


def register_miniapp_handlers(bot):
    @bot.message_handler(commands=["app", "stream", "watch"])
    def launch_app(message):
        """
        Launches the streaming Mini App.
        """
        keyboard = types.InlineKeyboardMarkup()
        keyboard.add(
            types.InlineKeyboardButton(
                text="🍿 Open SparrowFlix 🍿",
                web_app=types.WebAppInfo(url=f"https://t.me/{bot.get_me().username}/app")
            )
        )
        bot.send_message(
            message.chat.id,
            "Click the button below to open the SparrowFlix streaming app:",
            reply_markup=keyboard
        )

    @bot.message_handler(commands=["fileID"])
    def handle_file_request(message):
        """
        Handles direct file requests from the Mini App.
        """
        try:
            # Extract the message ID from the command
            parts = message.text.split('_')
            if len(parts) != 2:
                bot.send_message(message.chat.id, "Invalid file request.")
                return

            message_id = int(parts[1])

            # Forward the file from the channel to the user
            bot.forward_message(
                message.chat.id,
                os.getenv("STORAGE_CHANNEL_ID"),
                message_id
            )
        except Exception as e:
            logging.error(f"Error handling file request: {e}")
            bot.send_message(message.chat.id, "Error retrieving file.")