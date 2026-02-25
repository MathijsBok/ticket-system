# Deployment Configuration

This folder contains all configuration files needed to deploy the ticket system to your server.

## Server Details

| Environment | URL | Branch |
|-------------|-----|--------|
| Development | https://dev.kleverchain.cloud | `develop` |
| Production | https://support.kleverchain.cloud | `main` |

Server IP: `51.89.41.154`

## Files Overview

```
deployment/
├── README.md                    # This file
├── apache-ticket-dev.conf       # Apache config for development
├── apache-ticket-prod.conf      # Apache config for production
├── ecosystem.config.js          # PM2 process manager configuration
├── server-setup.sh              # One-time server setup script
├── deploy-dev.sh                # Deploy to development
├── deploy-prod.sh               # Deploy to production
└── env-templates/
    ├── backend.env.development  # Backend .env for dev
    ├── backend.env.production   # Backend .env for prod
    ├── frontend.env.development # Frontend .env for dev
    └── frontend.env.production  # Frontend .env for prod
```

## Quick Start

### 1. Initial Server Setup (One Time)

SSH into your server and run:

```bash
# Upload the deployment folder to your server first, then:
chmod +x server-setup.sh
sudo ./server-setup.sh
```

### 2. Clone Repository

```bash
# Development
cd /var/www/ticket-system-dev
git clone git@github.com:klever-io/ticket-system.git .
git checkout develop

# Production
cd /var/www/ticket-system-prod
git clone git@github.com:klever-io/ticket-system.git .
git checkout main
```

### 3. Configure Environment Files

```bash
# Development
cp deployment/env-templates/backend.env.development /var/www/ticket-system-dev/backend/.env
cp deployment/env-templates/frontend.env.development /var/www/ticket-system-dev/frontend/.env

# Production
cp deployment/env-templates/backend.env.production /var/www/ticket-system-prod/backend/.env
cp deployment/env-templates/frontend.env.production /var/www/ticket-system-prod/frontend/.env
```

**Important:** Edit each `.env` file and fill in:
- Database password
- Clerk API keys (test keys for dev, live keys for prod)
- SendGrid API key (if using email)

### 4. Build and Migrate

```bash
# Development
cd /var/www/ticket-system-dev/backend
npm install && npm run build && npm run db:migrate
cd ../frontend
npm install

# Production
cd /var/www/ticket-system-prod/backend
npm ci && npm run build && npm run db:migrate
cd ../frontend
npm ci && npm run build
```

### 5. Setup Apache

```bash
# Enable required Apache modules
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl

# Copy configuration files
sudo cp deployment/apache-ticket-dev.conf /etc/apache2/sites-available/ticket-dev.conf
sudo cp deployment/apache-ticket-prod.conf /etc/apache2/sites-available/ticket-prod.conf

# Enable sites
sudo a2ensite ticket-dev.conf
sudo a2ensite ticket-prod.conf

# Test and reload
sudo apache2ctl configtest
sudo systemctl reload apache2
```

### 6. Get SSL Certificates

```bash
sudo certbot --apache -d dev.kleverchain.cloud -d support.kleverchain.cloud
```

### 7. Start PM2

```bash
cp deployment/ecosystem.config.js /var/www/
cd /var/www
pm2 start ecosystem.config.js
pm2 save
```

## Deploying Updates

### Deploy to Development

```bash
cd /var/www/ticket-system-dev
./deployment/deploy-dev.sh
```

### Deploy to Production

```bash
cd /var/www/ticket-system-prod
./deployment/deploy-prod.sh
```

## Git Workflow

```
feature-branch ──► develop ──► main
                      │          │
                      ▼          ▼
                   DEV ENV    PROD ENV
```

1. Create feature branches from `develop`
2. Merge to `develop` and test on dev.kleverchain.cloud
3. When ready, merge `develop` to `main`
4. Deploy to support.kleverchain.cloud

## Useful Commands

### PM2

```bash
pm2 status                    # View all processes
pm2 logs                      # View logs
pm2 logs ticket-prod-backend  # View specific logs
pm2 restart all               # Restart all
pm2 restart ticket-dev-backend # Restart specific
```

### Apache

```bash
sudo apache2ctl configtest    # Test configuration
sudo systemctl reload apache2 # Reload config
sudo systemctl restart apache2 # Full restart
sudo a2ensite ticket-dev.conf # Enable a site
sudo a2dissite ticket-dev.conf # Disable a site
```

### Database

```bash
# Connect to dev database
psql -U postgres -d ticket_system_dev

# Connect to prod database
psql -U postgres -d ticket_system_prod

# Backup
pg_dump ticket_system_prod > backup_$(date +%Y%m%d).sql

# Restore
psql ticket_system_prod < backup.sql
```

### SSL Certificate Renewal

Certbot auto-renews, but you can test with:
```bash
sudo certbot renew --dry-run
```

## Troubleshooting

### App not loading
1. Check PM2: `pm2 status`
2. Check logs: `pm2 logs`
3. Check Apache: `sudo apache2ctl configtest`
4. Check Apache logs: `sudo tail -f /var/log/apache2/ticket-*-error.log`

### Database connection error
1. Check PostgreSQL: `sudo systemctl status postgresql`
2. Verify DATABASE_URL in .env
3. Check database exists: `psql -U postgres -l`

### SSL certificate issues
1. Check certbot: `sudo certbot certificates`
2. Renew manually: `sudo certbot renew`

### Apache proxy errors
1. Check modules enabled: `apache2ctl -M | grep proxy`
2. Check backend is running: `pm2 status`
3. Test backend directly: `curl http://localhost:3001/api/health`
