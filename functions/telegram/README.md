# Telegram Bot

This directory contains the Telegram bot code used by SparrowFlix.

## Start/Stop behaviour

The bot responds to `/start` and `/stop` for operational control:

- **Node.js deployments** – `/stop` updates the bot status in `FILEPATH_CACHE` and then terminates the process using `process.exit(0)`. A supervisor (PM2, Docker, systemd, etc.) should restart the bot. After restart, `/start` clears the stopped flag and processing resumes.
- **Serverless environments (e.g., Cloudflare Workers)** – These platforms don't support direct process management. In this mode the commands only toggle the flag in `FILEPATH_CACHE`. When stopped, all messages except `/start` receive a message that the bot is stopped and no updates are processed.

Logs are emitted when the bot stops or starts to aid debugging.
