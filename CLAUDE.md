# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SparrowFlix is a Netflix-style streaming service built on Cloudflare Workers that uses Telegram for content storage and management. The project consists of a React web application, Cloudflare Worker backend, and Telegram bot integration.

## Development Commands

### Core Development
- `npm run dev` - Start Cloudflare Worker development server with live reload
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run tail` - View Cloudflare Worker logs in real-time

### Frontend Development (React App)
- `npm run docs:dev` - Start Vite development server for React frontend (runs on `docs/` directory)
- `npm run docs:build` - Build React frontend for production

### Testing & Code Quality
- `npm test` - Run all tests (Vitest for React components + Node.js tests for Telegram functions)
- `npm run lint` - Lint JavaScript/JSX files in `functions/` and `docs/src/` directories

### Database & Migration
- `node migrate.js` - Run database migration scripts
- `node migrate-mongodb-to-d1.js` - Migrate from MongoDB to Cloudflare D1
- `./setup.sh` - Complete project setup including dependencies, migration, and deployment

## Architecture

### Multi-Environment Structure
The project uses Cloudflare Workers with distinct development and production environments:
- **Development**: `sparrowflix-dev` with `DEV_NO_AUTH=true` for easier testing
- **Production**: `sparrowflix` with full authentication

### Core Components

#### Backend (Cloudflare Workers)
- **Entry Point**: `functions/index.js` - Main worker that routes requests
- **API Layer**: `functions/api/` - REST API handlers (content, channels, tickets, streaming)
- **Telegram Integration**: `functions/telegram/` - Bot webhook handlers and bot logic
- **Database**: `functions/db/connection.js` - MongoDB Atlas connection via Data API
- **Authentication**: `functions/utils/auth.js` - Telegram WebApp data verification and JWT handling

#### Frontend (React + Vite)
- **Location**: `docs/src/` directory (served as Telegram Mini App)
- **Build Config**: Vite with React, builds to `docs/dist/`
- **Base Path**: `/SparrowFlix/` for GitHub Pages deployment
- **Telegram Integration**: Uses Telegram WebApp API for authentication

#### Data Storage
- **Cloudflare D1**: Primary database (SQLite)
- **MongoDB Atlas**: Legacy database (being migrated from)
- **Cloudflare KV**: 
  - `FILEPATH_CACHE` - Caches Telegram file paths
  - `TICKETS` - Stores time-limited streaming tickets
- **Telegram**: Unlimited file storage via bot uploads

### Request Flow
1. Telegram WebApp loads React frontend
2. Frontend authenticates via Telegram WebApp init data
3. API requests routed through Cloudflare Worker (`/api/*`)
4. Streaming requests use time-limited tickets (`/stream/*`)
5. Bot handles file uploads and management via webhook (`/webhook`)

## Key Architectural Patterns

### Authentication Flow
- Telegram WebApp provides init data for user authentication
- JWT tokens supported for web-based access
- Protected routes: `user`, `watch` endpoints
- Development environment bypasses auth with `DEV_NO_AUTH=true`

### Streaming Architecture
- Files stored in Telegram channels via bot
- Time-limited access tickets generated for secure streaming
- Direct streaming from Telegram CDN with range request support
- No file downloads or local buffering

### Bot Integration
- Webhook-based Telegram bot (`/webhook` endpoint)
- Handles file uploads, content management, and user commands
- State management via Cloudflare KV storage
- Admin features for content library management

## Environment Configuration

### Required Environment Variables (wrangler.toml)
- `BOT_TOKEN` - Telegram bot token
- `MONGODB_APP_ID`, `MONGODB_DATA_SOURCE`, `MONGODB_DATABASE` - MongoDB Atlas Data API
- `BOT_USERNAME` - Telegram bot username
- `MINI_APP_URL` - Telegram Mini App URL
- `STORAGE_CHANNEL_ID` - Telegram channel for file storage

### Cloudflare Bindings
- `DB` - D1 database binding
- `FILEPATH_CACHE` - KV namespace for file path caching
- `TICKETS` - KV namespace for streaming tickets

## Testing Structure

### Frontend Tests
- Located in `docs/src/__tests__/`
- Uses Vitest + Testing Library for React components
- Tests for Header, Hero, ContentRow components

### Backend Tests
- Located in `tests/` and `functions/telegram/`
- Node.js native test runner for authentication and ticket functionality
- Telegram bot tests in `functions/telegram/bot.test.js`

## Development Notes

### File Structure Conventions
- `functions/` - All Cloudflare Worker backend code
- `docs/src/` - React frontend application
- `legacy/` - Legacy Python bot code (deprecated)
- `tests/` - Backend unit tests

### Key APIs
- `/api/content` - Content library and metadata
- `/api/channels` - Live TV channel management  
- `/api/ticket` - Streaming ticket generation
- `/stream/{file_id}` - Actual video streaming endpoint
- `/webhook` - Telegram bot webhook handler

### Development vs Production
- Development uses `workers_dev = true` for easy testing
- Production requires custom domain setup in wrangler.toml
- Environment-specific database and KV namespace bindings