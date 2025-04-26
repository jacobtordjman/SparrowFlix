import os
import sys
import threading
import telebot
import logging
from flask import Flask, request, send_from_directory
from dotenv import load_dotenv
from add_title import register_add_title_handlers
from upload import register_upload_handlers
from fetch import register_fetch_handlers
from global_handlers import register_global_handlers
from miniapp import register_miniapp_handlers
from webapp.api import api_blueprint  # Import the blueprint from the correct location
# Load environment variables
load_dotenv()
# Environment variables
BOT_TOKEN = os.getenv("BOT_TOKEN")
ENV = os.getenv("ENV", "local")
WEBHOOK_URL = os.getenv("WEBHOOK_URL") if ENV == "production" else os.getenv("LOCAL_WEBHOOK_URL")
PORT = int(os.getenv("PORT", 5000))
# Flask app
app = Flask(__name__, static_folder='webapp')
# Initialize bot
bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")
# Register the API blueprint
app.register_blueprint(api_blueprint, url_prefix='/api')
# Add a route to serve the Mini App
@app.route('/app')
def serve_app():
    return send_from_directory('webapp', 'index.html')


# Logging Configuration
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG for detailed logs
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# Suppress MongoDB heartbeat and connection logs
logging.getLogger("pymongo").setLevel(logging.WARNING)


def main_menu():
    """
    Builds the main menu keyboard.
    """
    from telebot.types import ReplyKeyboardMarkup, KeyboardButton
    markup = ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    markup.row(KeyboardButton("Add New Title"))
    markup.row(KeyboardButton("Upload"), KeyboardButton("Fetch"))
    return markup


# === REGISTER HANDLERS === #
def register_handlers():
    """
    Register all handlers from other files.
    """
    register_add_title_handlers(bot)
    register_upload_handlers(bot)
    register_fetch_handlers(bot)
    register_global_handlers(bot)
    register_miniapp_handlers(bot)


# === FLASK ROUTE FOR WEBHOOK === #
@app.route("/webhook", methods=["POST"])
def webhook():
    """
    Flask endpoint to receive updates from Telegram webhook.
    """
    if request.method == "POST":
        json_str = request.stream.read().decode("utf-8")
        update = telebot.types.Update.de_json(json_str)
        bot.process_new_updates([update])
        return "Webhook received", 200


# === MAIN FUNCTION === #
if __name__ == "__main__":
    register_handlers()  # Register all handlers

    if ENV == "production":
        logging.info(f"Running in PRODUCTION mode with webhook: {WEBHOOK_URL}")
        bot.remove_webhook()
        bot.set_webhook(url=WEBHOOK_URL)
        app.run(host="0.0.0.0", port=PORT)
    else:
        logging.info("Running in LOCAL mode...")
        bot.remove_webhook()
        try:
            bot.polling(none_stop=True, interval=0, timeout=20)
        except Exception as e:
            logging.error(f"Error in polling: {e}")
            bot.stop_polling()
