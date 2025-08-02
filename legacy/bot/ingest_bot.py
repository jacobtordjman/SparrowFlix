import os, re, json, time, logging
from datetime import datetime
from telebot import TeleBot
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.environ["BOT_TOKEN"]
CHANNEL_ID = int(os.environ["STORAGE_CHANNEL_ID"])

MONGO_URI = os.environ["MONGO_URI"]
DB = os.environ.get("MONGODB_DATABASE", "sparrowflix")
COL_MOV = os.environ.get("MONGODB_COLLECTION_MOVIES", "movies")
COL_TV = os.environ.get("MONGODB_COLLECTION_TV", "tv_shows")

from pymongo import MongoClient
client = MongoClient(MONGO_URI)
db = client[DB]

def insert_one(collection, doc):
    return db[collection].insert_one(doc)

bot = TeleBot(BOT_TOKEN, parse_mode="HTML")

@bot.message_handler(commands=["start"])
def start(m): bot.reply_to(m, "Send me a video or document (movie/episode).")

@bot.message_handler(content_types=["video","document"])
def handle_upload(m):
    f = m.video or m.document
    file_id = f.file_id
    fname = getattr(f, "file_name", "unknown")
    title = re.sub(r"\.[^.]+$","", fname)
    year = None
    m2 = bot.copy_message(chat_id=CHANNEL_ID, from_chat_id=m.chat.id, message_id=m.message_id)
    message_id = m2.message_id

    is_tv = bool(re.search(r"S(\d{2})E(\d{2})", fname, re.I))
    base_doc = {
        "title": title, "year": year, "created_at": datetime.utcnow().isoformat()+"Z",
        "telegram": { "file_id": file_id, "channel_message_id": message_id,
            "message_link": f"https://t.me/c/CHANNEL_INTERNAL_ID/{message_id}" }
    }
    if is_tv:
        # Simplest: each upload = one "episode item" in tv collection
        insert_one(COL_TV, base_doc)
    else:
        insert_one(COL_MOV, base_doc)

    bot.reply_to(m, f"Indexed: {title}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    bot.infinity_polling()
