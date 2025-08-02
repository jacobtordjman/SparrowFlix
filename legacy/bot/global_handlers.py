import logging
import os
import sys

from utils import create_keyboard

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")

def register_global_handlers(bot):
    @bot.message_handler(commands=["start"])
    def start_handler(message):
        """
        Handles the /start command and displays the main menu.
        """
        options = ["Add New Title", "Upload", "Fetch Movie/Episode"]
        keyboard = create_keyboard(options)
        bot.send_message(
            message.chat.id,
            "Welcome to SparrowFlix! Please choose an option:",
            reply_markup=keyboard
        )

    @bot.message_handler(commands=["stop"])
    def stop_handler(message):
        """
        Handles the /stop command and stops the bot instance.
        """
        authorized_users = [199675749]  # Replace with your Telegram user ID(s)
        if message.from_user.id not in authorized_users:
            bot.send_message(message.chat.id, "You are not authorized to stop the bot.")
            return

        bot.send_message(message.chat.id, "Stopping the bot. Goodbye!")
        logging.info(f"Bot stopped by user: {message.from_user.id}")
        sys.exit(0)  # Immediately terminates the script
