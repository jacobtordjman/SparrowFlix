# Component Roles

## Telegram Bot
- **Primary Role**: Content ingestion & management interface
- **Responsibilities**:
  - Add new titles to the database
  - Upload content files
  - Manage metadata
  - Admin notifications
- **Should NOT**:
  - Handle user authentication
  - Stream content directly
  - Implement complex conversation flows

## Telegram Channel
- **Primary Role**: Backup storage only
- **Responsibilities**:
  - Store original files as backup
  - Provide file IDs for initial processing
- **Migration Plan**: Move to a free-tier CDN or self-hosted object store when possible

## Web App
- **Primary Role**: User-facing streaming platform
- **Responsibilities**:
  - Content browsing & discovery
  - Video playback
  - User profiles & preferences
  - Social features (ratings, lists)
