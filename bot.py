from telebot import TeleBot
import logging
from add_title import register_add_title_handlers
from fetch import register_fetch_handlers
from upload import register_upload_handlers
from global_handlers import register_global_handlers  # Import the global handlers
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN is missing or invalid.")

# Initialize the bot
bot = TeleBot(BOT_TOKEN)

# Register all handlers
register_global_handlers(bot)  # Register global handlers first
register_add_title_handlers(bot)
register_fetch_handlers(bot)
register_upload_handlers(bot)

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
    bot.infinity_polling()
