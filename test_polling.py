from telebot import TeleBot
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()

# Fetch BOT_TOKEN from the environment
BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN is missing or invalid. Please check your .env file.")

bot = TeleBot(BOT_TOKEN)

@bot.message_handler(commands=["start"])
def start_handler(message):
    bot.send_message(message.chat.id, "Hello! Bot is working.")

if __name__ == "__main__":
    bot.infinity_polling()
