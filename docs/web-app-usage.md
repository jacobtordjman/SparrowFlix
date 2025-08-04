# Web App Usage

1. Launch the web app inside Telegram or supply a JWT so requests include `X-Telegram-Init-Data` or `Authorization` headers.
2. Before starting playback, send a POST request to `/api/ticket/create` and set the returned `streamUrl` as the `<video>` source.
3. Ensure the worker is configured with `TICKETS` KV and `BOT_TOKEN` bindings before deployment.
