from utils import create_keyboard

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
