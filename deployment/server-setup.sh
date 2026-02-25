#!/bin/bash

# Server Initial Setup Script
# Run this ONCE on a fresh Ubuntu/Debian server
# Usage: sudo ./server-setup.sh

set -e

echo "========================================"
echo "  Klever Support - Server Setup"
echo "  Setting up dev + prod environments"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

# ============================================
# 1. SYSTEM UPDATE
# ============================================
echo -e "${YELLOW}[1/9] Updating system packages...${NC}"
apt update && apt upgrade -y

# ============================================
# 2. INSTALL NODE.JS 20.x
# ============================================
echo -e "${YELLOW}[2/9] Installing Node.js 20.x...${NC}"
if command -v node &> /dev/null; then
    echo "Node.js already installed: $(node -v)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
node -v
npm -v

# ============================================
# 3. INSTALL POSTGRESQL
# ============================================
echo -e "${YELLOW}[3/9] Installing PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    echo "PostgreSQL already installed"
else
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# Create databases (ignore errors if they exist)
echo -e "${YELLOW}Creating databases...${NC}"
sudo -u postgres psql -c "CREATE DATABASE ticket_system_dev;" 2>/dev/null || echo "ticket_system_dev already exists"
sudo -u postgres psql -c "CREATE DATABASE ticket_system_prod;" 2>/dev/null || echo "ticket_system_prod already exists"

echo -e "${GREEN}Databases ready: ticket_system_dev, ticket_system_prod${NC}"

# ============================================
# 4. CONFIGURE APACHE
# ============================================
echo -e "${YELLOW}[4/9] Configuring Apache...${NC}"
if command -v apache2 &> /dev/null; then
    echo "Apache already installed, enabling required modules..."
else
    apt install -y apache2
    systemctl start apache2
    systemctl enable apache2
fi

# Enable required modules for reverse proxy
a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl
systemctl restart apache2

# ============================================
# 5. INSTALL PM2
# ============================================
echo -e "${YELLOW}[5/9] Installing PM2...${NC}"
if command -v pm2 &> /dev/null; then
    echo "PM2 already installed"
else
    npm install -g pm2
fi

# Setup PM2 startup (get the actual user)
ACTUAL_USER=${SUDO_USER:-$USER}
if [ "$ACTUAL_USER" != "root" ]; then
    pm2 startup systemd -u $ACTUAL_USER --hp /home/$ACTUAL_USER
fi

# ============================================
# 6. INSTALL CERTBOT (SSL)
# ============================================
echo -e "${YELLOW}[6/9] Installing Certbot for SSL...${NC}"
apt install -y certbot python3-certbot-apache

# ============================================
# 7. CREATE DIRECTORY STRUCTURE
# ============================================
echo -e "${YELLOW}[7/9] Creating directory structure...${NC}"
mkdir -p /var/www/ticket-system-dev
mkdir -p /var/www/ticket-system-prod
mkdir -p /var/log/pm2

# Set ownership
ACTUAL_USER=${SUDO_USER:-$USER}
if [ "$ACTUAL_USER" != "root" ]; then
    chown -R $ACTUAL_USER:$ACTUAL_USER /var/www/ticket-system-dev
    chown -R $ACTUAL_USER:$ACTUAL_USER /var/www/ticket-system-prod
    chown -R $ACTUAL_USER:$ACTUAL_USER /var/log/pm2
fi

# ============================================
# 8. INSTALL GIT
# ============================================
echo -e "${YELLOW}[8/9] Installing Git...${NC}"
apt install -y git

# ============================================
# 9. CONFIGURE FIREWALL (if ufw is available)
# ============================================
echo -e "${YELLOW}[9/9] Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 'Apache Full'
    ufw allow OpenSSH
    ufw --force enable
else
    echo "UFW not found, skipping firewall configuration"
fi

# ============================================
# FINAL INSTRUCTIONS
# ============================================
echo ""
echo -e "${GREEN}========================================"
echo "  Server setup complete!"
echo "========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Set PostgreSQL password (if needed):"
echo "   sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'your_secure_password';\""
echo ""
echo "2. Clone your repository:"
echo "   cd /var/www/ticket-system-dev"
echo "   git clone git@github.com:klever-io/ticket-system.git ."
echo "   git checkout develop"
echo ""
echo "   cd /var/www/ticket-system-prod"
echo "   git clone git@github.com:klever-io/ticket-system.git ."
echo "   git checkout main"
echo ""
echo "3. Copy and configure .env files:"
echo "   cp deployment/env-templates/backend.env.development /var/www/ticket-system-dev/backend/.env"
echo "   cp deployment/env-templates/frontend.env.development /var/www/ticket-system-dev/frontend/.env"
echo "   cp deployment/env-templates/backend.env.production /var/www/ticket-system-prod/backend/.env"
echo "   cp deployment/env-templates/frontend.env.production /var/www/ticket-system-prod/frontend/.env"
echo ""
echo "4. Install dependencies and build:"
echo "   cd /var/www/ticket-system-dev/backend && npm install && npm run build && npm run db:migrate"
echo "   cd /var/www/ticket-system-dev/frontend && npm install"
echo "   cd /var/www/ticket-system-prod/backend && npm ci && npm run build && npm run db:migrate"
echo "   cd /var/www/ticket-system-prod/frontend && npm ci && npm run build"
echo ""
echo "5. Setup Apache:"
echo "   sudo cp deployment/apache-ticket-dev.conf /etc/apache2/sites-available/ticket-dev.conf"
echo "   sudo cp deployment/apache-ticket-prod.conf /etc/apache2/sites-available/ticket-prod.conf"
echo "   sudo a2ensite ticket-dev.conf ticket-prod.conf"
echo "   sudo apache2ctl configtest"
echo "   sudo systemctl reload apache2"
echo ""
echo "6. Get SSL certificates:"
echo "   sudo certbot --apache -d dev.kleverchain.cloud -d support.kleverchain.cloud"
echo ""
echo "7. Start PM2:"
echo "   cp deployment/ecosystem.config.js /var/www/"
echo "   cd /var/www && pm2 start ecosystem.config.js"
echo "   pm2 save"
echo ""
echo "Done! Your apps will be available at:"
echo "  - https://dev.kleverchain.cloud (Development)"
echo "  - https://support.kleverchain.cloud (Production)"
