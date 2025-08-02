import os
import sys
import logging
import signal
from flask import Flask, request
from dotenv import load_dotenv
import telebot
from telebot import types
import time
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

# Configuration
BOT_TOKEN = os.getenv("BOT_TOKEN")
ENV = os.getenv("ENV", "local")
WEBHOOK_URL = os.getenv("PROD_WEBHOOK_URL") if ENV == "production" else os.getenv("LOCAL_WEBHOOK_URL")
PORT = int(os.getenv("PROD_PORT" if ENV == "production" else "LOCAL_PORT", 5000))
STORAGE_CHANNEL_ID = int(os.getenv("STORAGE_CHANNEL_ID"))

# Logging setup - less verbose
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logging.getLogger("pymongo").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# Initialize bot with better error handling
bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML", threaded=False)

# Import handlers after bot initialization
from database import init_database
from handlers.main_menu import register_main_menu_handlers
from handlers.add_title import register_add_title_handlers
from handlers.upload import register_upload_handlers
from handlers.fetch import register_fetch_handlers
from handlers.miniapp import register_miniapp_handlers

# Flask app for webhook mode only
app = Flask(__name__, static_folder='webapp') if ENV == "production" else None

def setup_bot():
    """Initialize bot with all handlers"""
    try:
        # Initialize database with retry logic
        init_database()
        
        # Register all handlers
        register_main_menu_handlers(bot)
        register_add_title_handlers(bot)
        register_upload_handlers(bot)
        register_fetch_handlers(bot)
        register_miniapp_handlers(bot)
        
        logging.info("Bot setup completed successfully")
        return True
    except Exception as e:
        logging.error(f"Failed to setup bot: {e}")
        return False

# === WEBHOOK MODE (Production) ===
if ENV == "production" and app:
    @app.route("/webhook", methods=["POST"])
    def webhook():
        """Handle webhook requests from Telegram"""
        try:
            json_str = request.stream.read().decode("utf-8")
            update = telebot.types.Update.de_json(json_str)
            bot.process_new_updates([update])
            return "", 200
        except Exception as e:
            logging.error(f"Webhook error: {e}")
            return "", 500
    
    @app.route("/health", methods=["GET"])
    def health():
        """Health check endpoint"""
        return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}, 200
    
    # API routes for Mini App
    @app.route("/api/<path:path>", methods=["GET", "POST"])
    def api_proxy(path):
        """Proxy API requests to appropriate handlers"""
        from webapp.api import handle_api_request
        return handle_api_request(path, request)

# === POLLING MODE (Local Development) ===
def run_polling():
    """Run bot in polling mode with proper error handling"""
    retry_count = 0
    max_retries = 5
    
    while retry_count < max_retries:
        try:
            logging.info(f"Starting polling mode (attempt {retry_count + 1})")
            bot.remove_webhook()
            bot.infinity_polling(timeout=30, long_polling_timeout=30)
        except KeyboardInterrupt:
            logging.info("Polling stopped by user")
            break
        except Exception as e:
            retry_count += 1
            logging.error(f"Polling error: {e}")
            if retry_count < max_retries:
                wait_time = min(retry_count * 5, 30)
                logging.info(f"Restarting in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                logging.error("Max retries reached. Exiting.")
                sys.exit(1)

# === MAIN ENTRY POINT ===
if __name__ == "__main__":
    if not setup_bot():
        logging.error("Bot setup failed. Exiting.")
        sys.exit(1)
    
    if ENV == "production" and app:
        logging.info(f"Starting in PRODUCTION mode with webhook: {WEBHOOK_URL}")
        try:
            bot.remove_webhook()
            time.sleep(1)
            bot.set_webhook(url=WEBHOOK_URL)
            app.run(host="0.0.0.0", port=PORT)
        except Exception as e:
            logging.error(f"Failed to start webhook server: {e}")
            sys.exit(1)
    else:
        logging.info("Starting in LOCAL mode with polling")
        run_polling()