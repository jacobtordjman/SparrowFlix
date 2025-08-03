#!/bin/bash

# Set secrets for production environment
echo "Setting up Cloudflare Worker secrets..."

# Set MongoDB API Key
echo "J44VVy9tQvPk2QBMHxRsAqOUScneOAfQTSS7XA6nqAfPPaT3oJRCo3B3Jjm9ElDP" | wrangler secret put MONGODB_API_KEY --env production

# Set Bot Token
echo "6533479070:AAE7Z2iBtdy8O54rqhoZc3H3Df-OkPdeG7U" | wrangler secret put BOT_TOKEN --env production

# Set Storage Channel ID
echo "-1002555400542" | wrangler secret put STORAGE_CHANNEL_ID --env production

# Set TMDB API Key
echo "82c4ac021cffd8e3693622ed848f33eb" | wrangler secret put TMDB_API_KEY --env production

# Generate and set webhook secret (optional - will be auto-generated if not set)
WEBHOOK_SECRET=$(openssl rand -hex 32)
echo $WEBHOOK_SECRET | wrangler secret put WEBHOOK_SECRET --env production
echo "Generated webhook secret: $WEBHOOK_SECRET"

echo "✅ All secrets set for production environment"

# Also set for development environment if needed
echo "Setting secrets for development environment..."

echo "J44VVy9tQvPk2QBMHxRsAqOUScneOAfQTSS7XA6nqAfPPaT3oJRCo3B3Jjm9ElDP" | wrangler secret put MONGODB_API_KEY --env development
echo "6533479070:AAE7Z2iBtdy8O54rqhoZc3H3Df-OkPdeG7U" | wrangler secret put BOT_TOKEN --env development
echo "-1002555400542" | wrangler secret put STORAGE_CHANNEL_ID --env development
echo "82c4ac021cffd8e3693622ed848f33eb" | wrangler secret put TMDB_API_KEY --env development
echo $WEBHOOK_SECRET | wrangler secret put WEBHOOK_SECRET --env development

echo "✅ All secrets set for development environment"