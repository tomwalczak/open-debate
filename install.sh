#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

INSTALL_DIR="$HOME/Desktop/open-debate"

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Open Debate - Installation${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check for macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${YELLOW}Warning: This script is designed for macOS.${NC}"
    echo "For other systems, manually install Node.js and clone the repo."
    echo ""
fi

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}Homebrew not found. Installing...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing via Homebrew...${NC}"
    brew install node
else
    echo -e "${GREEN}✓${NC} Node.js found: $(node --version)"
fi

# Check for git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Git not found. Installing via Homebrew...${NC}"
    brew install git
else
    echo -e "${GREEN}✓${NC} Git found"
fi

# Clone or update repo
if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "${YELLOW}Open Debate already installed at $INSTALL_DIR${NC}"
    echo "Updating..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "Cloning Open Debate to $INSTALL_DIR..."
    git clone https://github.com/tomwalczak/open-debate.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env if it doesn't exist
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    echo ""
    echo -e "${YELLOW}No .env file found.${NC}"
    echo -e "You'll need an API key from ${BLUE}https://openrouter.ai${NC}"
    echo ""
    read -p "Enter your OpenRouter API key (or press Enter to skip): " api_key

    if [[ -n "$api_key" ]]; then
        echo "OPENROUTER_API_KEY=$api_key" > "$INSTALL_DIR/.env"
        echo -e "${GREEN}✓${NC} API key saved"
    else
        cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
        echo -e "${YELLOW}Skipped. Edit ~/Desktop/open-debate/.env later to add your key.${NC}"
    fi
fi

# Done
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "To run Open Debate:"
echo ""
echo -e "  ${BLUE}cd ~/Desktop/open-debate && npm start${NC}"
echo ""
echo "Or with arguments:"
echo ""
echo -e "  ${BLUE}cd ~/Desktop/open-debate && npm start -- --speaker1 \"Elon Musk\" --speaker2 \"Sam Altman\" --autopilot${NC}"
echo ""
echo "For all options, run:"
echo ""
echo -e "  ${BLUE}cd ~/Desktop/open-debate && npm start -- --help${NC}"
echo ""
