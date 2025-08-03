# Channel Streaming Flow

This flow describes how a client obtains and uses a live channel stream.

1. **List Channels**
   - `GET /api/channels/list`
   - Returns available channels and the current program for each.
2. **Request Stream**
   - `GET /api/channels/stream/{channelId}`
   - Response contains current program metadata and a time-limited `streamUrl`.
3. **Start Playback**
   - Load the returned `streamUrl` (`/stream/{ticketId}`) in the media player.
4. **Refresh When Needed**
   - When the ticket expires or the program changes, repeat step 2 to obtain a new `streamUrl`.
