# handlers/upload.py
import os
import logging
import re
from datetime import datetime, timedelta
from collections import defaultdict
import threading
from database import movies_collection, tv_shows_collection
from utils import create_keyboard, handle_back, validate_input

STORAGE_CHANNEL_ID = int(os.getenv("STORAGE_CHANNEL_ID"))

# Global storage for media groups with timestamps
media_groups = defaultdict(lambda: {"messages": [], "timestamp": datetime.now()})
media_group_lock = threading.Lock()

# Cleanup old media groups every 5 minutes
def cleanup_media_groups():
    """Remove media groups older than 2 minutes"""
    with media_group_lock:
        current_time = datetime.now()
        expired_groups = [
            group_id for group_id, data in media_groups.items()
            if current_time - data["timestamp"] > timedelta(minutes=2)
        ]
        for group_id in expired_groups:
            del media_groups[group_id]

def register_upload_handlers(bot):
    # Start cleanup timer
    cleanup_timer = threading.Timer(300, cleanup_media_groups)  # 5 minutes
    cleanup_timer.daemon = True
    cleanup_timer.start()
    
    # Store upload context for users
    upload_context = {}
    
    @bot.message_handler(func=lambda message: message.text and message.text.lower() == "upload")
    def upload_handler(message):
        """Entry point for upload workflow"""
        languages = ["English", "Hebrew", "Japanese", "Back"]
        keyboard = create_keyboard(languages)
        bot.send_message(
            message.chat.id,
            "📤 Choose language for upload:",
            reply_markup=keyboard
        )
        bot.register_next_step_handler(message, process_language_selection)
    
    def process_language_selection(message):
        if handle_back(message, lambda m: bot.send_message(m.chat.id, "Cancelled upload.")):
            return
            
        language = message.text.strip()
        if not validate_input(["English", "Hebrew", "Japanese"], language):
            bot.send_message(message.chat.id, "❌ Invalid language. Try again.")
            upload_handler(message)
            return
            
        options = ["Movie", "TV Show", "Back"]
        keyboard = create_keyboard(options)
        bot.send_message(
            message.chat.id,
            "🎬 Is it a Movie or TV Show?",
            reply_markup=keyboard
        )
        bot.register_next_step_handler(message, process_type_selection, language)
    
    def process_type_selection(message, language):
        if handle_back(message, upload_handler):
            return
            
        item_type = message.text.strip()
        if not validate_input(["Movie", "TV Show"], item_type):
            bot.send_message(message.chat.id, "❌ Invalid type. Try again.")
            process_language_selection(message)
            return
            
        bot.send_message(
            message.chat.id,
            f"🔍 Search for the {item_type} by name:",
            reply_markup=types.ReplyKeyboardRemove()
        )
        bot.register_next_step_handler(message, search_content, language, item_type)
    
    def search_content(message, language, item_type):
        query = message.text.strip()
        collection = movies_collection if item_type.lower() == "movie" else tv_shows_collection
        
        try:
            # Search in database
            results = list(collection.find({
                "$or": [
                    {"title": {"$regex": query, "$options": "i"}},
                    {"original_title": {"$regex": query, "$options": "i"}}
                ],
                "language": language.lower()
            }).limit(10))
            
            if not results:
                bot.send_message(
                    message.chat.id,
                    f"❌ No matches found for '{query}'.\nPlease try again or type 'Back'."
                )
                bot.register_next_step_handler(message, search_content, language, item_type)
                return
            
            # Show results
            options = [f"{r['title']} ({r.get('year', 'N/A')})" for r in results] + ["Back"]
            keyboard = create_keyboard(options)
            bot.send_message(
                message.chat.id,
                "📋 Select a match:",
                reply_markup=keyboard
            )
            bot.register_next_step_handler(message, process_selection, language, item_type, results)
            
        except Exception as e:
            logging.error(f"Search error: {e}")
            bot.send_message(message.chat.id, "❌ Search failed. Please try again.")
            upload_handler(message)
    
    def process_selection(message, language, item_type, results):
        if handle_back(message, lambda m: search_content(m, language, item_type)):
            return
            
        selection = message.text.strip()
        
        # Find matching result
        selected = None
        for r in results:
            if f"{r['title']} ({r.get('year', 'N/A')})" == selection:
                selected = r
                break
        
        if not selected:
            bot.send_message(message.chat.id, "❌ Invalid selection.")
            return
        
        # Store upload context
        upload_context[message.chat.id] = {
            "content": selected,
            "type": item_type.lower(),
            "language": language.lower()
        }
        
        if item_type.lower() == "movie":
            bot.send_message(
                message.chat.id,
                f"📽️ Ready to upload: *{selected['title']}*\n\n"
                "Please send the movie file (you can also add a caption).",
                parse_mode="Markdown",
                reply_markup=types.ReplyKeyboardRemove()
            )
        else:
            # For TV shows, ask for season
            seasons = selected.get("details", {}).get("seasons", [])
            if not seasons:
                bot.send_message(message.chat.id, "❌ No seasons found for this show.")
                return
                
            options = [f"Season {s['season_number']}" for s in seasons] + ["Back"]
            keyboard = create_keyboard(options)
            bot.send_message(
                message.chat.id,
                "📺 Select season to upload:",
                reply_markup=keyboard
            )
            bot.register_next_step_handler(message, select_season, selected)
    
    def select_season(message, tv_show):
        if handle_back(message, upload_handler):
            return
            
        try:
            season_num = int(message.text.replace("Season ", ""))
            season = next(
                (s for s in tv_show.get("details", {}).get("seasons", []) 
                 if s["season_number"] == season_num),
                None
            )
            
            if not season:
                bot.send_message(message.chat.id, "❌ Invalid season.")
                return
            
            # Update context
            upload_context[message.chat.id]["season"] = season_num
            
            bot.send_message(
                message.chat.id,
                f"📺 *{tv_show['title']}* - Season {season_num}\n\n"
                "Upload episodes with captions in format: `E01`, `E02`, etc.\n"
                "You can upload multiple files at once.\n"
                "Send /done when finished.",
                parse_mode="Markdown",
                reply_markup=types.ReplyKeyboardRemove()
            )
            
        except ValueError:
            bot.send_message(message.chat.id, "❌ Invalid season format.")
    
    # Handle file uploads
    @bot.message_handler(content_types=['video', 'document'])
    def handle_file_upload(message):
        chat_id = message.chat.id
        
        # Check if user is in upload context
        if chat_id not in upload_context:
            return
        
        context = upload_context[chat_id]
        file = message.document if message.content_type == 'document' else message.video
        
        if not file:
            return
        
        # Handle media group
        if message.media_group_id:
            with media_group_lock:
                media_groups[message.media_group_id]["messages"].append(message)
                media_groups[message.media_group_id]["timestamp"] = datetime.now()
                
                # Process after a short delay to collect all files
                threading.Timer(
                    1.0, 
                    process_media_group, 
                    args=[bot, message.media_group_id, context]
                ).start()
        else:
            # Single file upload
            process_single_file(bot, message, context)
    
    @bot.message_handler(commands=['done'])
    def finish_upload(message):
        if message.chat.id in upload_context:
            del upload_context[message.chat.id]
            bot.send_message(
                message.chat.id,
                "✅ Upload session finished!",
                reply_markup=create_keyboard(["Add New Title", "Upload", "Fetch"])
            )

def process_single_file(bot, message, context):
    """Process a single uploaded file"""
    file = message.document if message.content_type == 'document' else message.video
    file_id = file.file_id
    caption = message.caption or ""
    
    try:
        if context["type"] == "movie":
            # Update movie with file
            result = movies_collection.update_one(
                {"_id": context["content"]["_id"]},
                {
                    "$set": {
                        "file_id": file_id,
                        "uploaded_at": datetime.utcnow()
                    }
                }
            )
            
            # Forward to storage channel
            forward_to_channel(bot, message, context["content"], "movie")
            
            bot.send_message(
                message.chat.id,
                f"✅ Movie uploaded successfully!"
            )
            
        else:  # TV Show
            # Extract episode number from caption
            episode_match = re.search(r'[Ee](\d+)', caption)
            if not episode_match:
                bot.send_message(
                    message.chat.id,
                    "❌ Please include episode number in caption (e.g., E01)"
                )
                return
            
            episode_num = int(episode_match.group(1))
            season_num = context.get("season", 1)
            
            # Update episode
            tv_shows_collection.update_one(
                {
                    "_id": context["content"]["_id"],
                    "details.seasons.season_number": season_num
                },
                {
                    "$set": {
                        f"details.seasons.$.episodes.{episode_num}": {
                            "episode_number": episode_num,
                            "file_id": file_id,
                            "uploaded_at": datetime.utcnow()
                        }
                    }
                }
            )
            
            # Forward to storage channel
            forward_to_channel(
                bot, message, context["content"], "tv",
                season_num, episode_num
            )
            
            bot.send_message(
                message.chat.id,
                f"✅ Episode {episode_num} uploaded!"
            )
            
    except Exception as e:
        logging.error(f"Upload error: {e}")
        bot.send_message(message.chat.id, "❌ Upload failed. Please try again.")

def process_media_group(bot, media_group_id, context):
    """Process all files in a media group"""
    with media_group_lock:
        if media_group_id not in media_groups:
            return
            
        messages = media_groups[media_group_id]["messages"]
        del media_groups[media_group_id]
    
    # Process each file
    for msg in messages:
        process_single_file(bot, msg, context)

def forward_to_channel(bot, message, content, content_type, season=None, episode=None):
    """Forward file to storage channel with metadata"""
    try:
        caption = f"🎬 {content['title']}\n"
        caption += f"📁 Type: {content_type.capitalize()}\n"
        caption += f"🌐 Language: {content.get('language', 'Unknown').capitalize()}\n"
        
        if content_type == "tv" and season and episode:
            caption += f"📺 Season {season}, Episode {episode}\n"
        
        caption += f"#️⃣ ID: {str(content['_id'])}"
        
        # Forward the message
        forwarded = bot.forward_message(
            STORAGE_CHANNEL_ID,
            message.chat.id,
            message.message_id
        )
        
        # Store channel message ID
        if content_type == "movie":
            movies_collection.update_one(
                {"_id": content["_id"]},
                {"$set": {"channel_message_id": forwarded.message_id}}
            )
        else:
            tv_shows_collection.update_one(
                {
                    "_id": content["_id"],
                    "details.seasons.season_number": season
                },
                {
                    "$set": {
                        f"details.seasons.$.episodes.{episode}.channel_message_id": forwarded.message_id
                    }
                }
            )
            
        return forwarded.message_id
        
    except Exception as e:
        logging.error(f"Channel forward error: {e}")
        return None