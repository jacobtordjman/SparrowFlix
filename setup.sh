#!/bin/bash

# SparrowFlix Setup Script
echo "🎬 SparrowFlix Setup Script"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}Please edit .env and fill in your values, then run this script again.${NC}"
    exit 1
fi

# Load environment variables (compatible with Windows/MINGW)
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check required variables
if [ -z "$BOT_TOKEN" ] || [ -z "$MONGO_URI" ]; then
    echo -e "${RED}✗ Missing required environment variables in .env${NC}"
    echo "Please ensure BOT_TOKEN and MONGO_URI are set."
    
    # Debug: Show what we're reading
    echo -e "${YELLOW}Debug - Current values:${NC}"
    echo "BOT_TOKEN='$BOT_TOKEN'"
    echo "MONGO_URI='$MONGO_URI'"
    
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi

# Run migration
echo -e "${YELLOW}Running database migration...${NC}"
node migrate.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database migration completed${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    exit 1
fi

# Deploy to Cloudflare
echo -e "${YELLOW}Deploying to Cloudflare Workers...${NC}"
wrangler deploy
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Deployed successfully${NC}"
    
    # Get the deployment URL
    WORKER_URL=$(wrangler publish 2>&1 | grep -oP 'https://[^\s]+\.workers\.dev')
    
    if [ ! -z "$WORKER_URL" ]; then
        echo -e "${GREEN}Worker URL: $WORKER_URL${NC}"
        
        # Set up webhook
        echo -e "${YELLOW}Setting up Telegram webhook...${NC}"
        
        # Generate webhook secret if not exists
        if [ -z "$WEBHOOK_SECRET" ]; then
            WEBHOOK_SECRET=$(openssl rand -hex 32)
            echo "WEBHOOK_SECRET=$WEBHOOK_SECRET" >> .env
            echo -e "${GREEN}✓ Generated webhook secret${NC}"
        fi
        
        # Set webhook
        WEBHOOK_RESPONSE=$(curl -s -X POST \
            "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
            -F "url=${WORKER_URL}/webhook" \
            -F "secret_token=${WEBHOOK_SECRET}")
        
        if [[ $WEBHOOK_RESPONSE == *"\"ok\":true"* ]]; then
            echo -e "${GREEN}✓ Webhook set successfully${NC}"
        else
            echo -e "${RED}✗ Failed to set webhook${NC}"
            echo "Response: $WEBHOOK_RESPONSE"
        fi
        
        # Set bot commands
        echo -e "${YELLOW}Setting bot commands...${NC}"
        COMMANDS_RESPONSE=$(curl -s -X POST \
            "https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands" \
            -H "Content-Type: application/json" \
            -d '{
                "commands": [
                    {"command": "start", "description": "Start the bot"},
                    {"command": "app", "description": "Open streaming app"},
                    {"command": "stream", "description": "Open streaming app"},
                    {"command": "help", "description": "Show help"}
                ]
            }')
        
        if [[ $COMMANDS_RESPONSE == *"\"ok\":true"* ]]; then
            echo -e "${GREEN}✓ Bot commands set${NC}"
        else
            echo -e "${YELLOW}⚠ Failed to set bot commands (non-critical)${NC}"
        fi
        
        echo ""
        echo -e "${GREEN}🎉 SparrowFlix setup completed!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Open Telegram and message your bot: @${BOT_USERNAME}"
        echo "2. Send /start to begin"
        echo "3. Click '🎬 Open Streaming App' to access the web interface"
        echo ""
        echo "Your worker URL: ${WORKER_URL}"
        echo ""
        echo "To view logs: wrangler tail"
        
    else
        echo -e "${YELLOW}⚠ Could not extract worker URL. Check deployment manually.${NC}"
    fi
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi