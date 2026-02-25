# Deployment Guide

This guide covers deploying the ticket system to production.

## Environment Setup

### Backend Environment Variables

Required variables for production:
```bash
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
PORT=3001
NODE_ENV=production

CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

UPLOAD_DIR=/var/app/uploads
MAX_FILE_SIZE=10485760

FRONTEND_URL=https://your-domain.com
```

### Frontend Environment Variables

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
VITE_API_URL=https://api.your-domain.com/api
```

## Database Setup

### PostgreSQL Production Setup

1. Create production database:
```bash
createdb ticket_system_prod
```

2. Run migrations:
```bash
cd backend
DATABASE_URL="your_prod_db_url" npm run db:migrate
```

3. Generate Prisma client:
```bash
npm run db:generate
```

## Deployment Options

### Option 1: Traditional VPS (DigitalOcean, Linode, etc.)

#### Backend
```bash
# Install dependencies
cd backend
npm install --production

# Build TypeScript
npm run build

# Start with PM2
pm2 start dist/server.js --name ticket-backend
pm2 save
```

#### Frontend
```bash
cd frontend
npm install
npm run build

# Serve with nginx or serve package
npm install -g serve
serve -s dist -l 5173
```

### Option 2: Docker Deployment

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ticket_system
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:your_password@postgres:5432/ticket_system
      NODE_ENV: production
    depends_on:
      - postgres
    volumes:
      - ./uploads:/app/uploads

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### Option 3: Cloud Platforms

#### Vercel (Frontend)
```bash
cd frontend
vercel --prod
```

#### Railway/Render (Backend + Database)
- Connect your GitHub repository
- Set environment variables in dashboard
- Deploy automatically on push

#### Heroku
```bash
# Backend
heroku create ticket-system-api
heroku addons:create heroku-postgresql:mini
git subtree push --prefix backend heroku main

# Frontend
cd frontend
npm run build
# Deploy dist folder to Vercel/Netlify
```

## Nginx Configuration

For reverse proxy setup:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Webhooks
    location /webhooks {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

## SSL/HTTPS Setup

Using Let's Encrypt with Certbot:
```bash
sudo certbot --nginx -d your-domain.com
```

## Post-Deployment Checklist

- [ ] Database backups configured
- [ ] SSL certificate installed
- [ ] Environment variables set
- [ ] Clerk webhooks configured
- [ ] File upload directory has write permissions
- [ ] Error logging configured
- [ ] Rate limiting enabled (optional)
- [ ] CDN configured for static assets (optional)
- [ ] Monitoring and alerts set up

## Clerk Webhook Configuration

1. Go to Clerk Dashboard > Webhooks
2. Add endpoint: `https://your-domain.com/webhooks/clerk`
3. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
4. Copy the signing secret
5. Add to backend .env: `CLERK_WEBHOOK_SECRET=whsec_xxxxx`

## Monitoring

Recommended tools:
- Application: PM2, New Relic, DataDog
- Database: pgAdmin, Postgres monitoring
- Logs: CloudWatch, Papertrail, Logtail
- Uptime: UptimeRobot, Pingdom

## Backup Strategy

### Database Backups
```bash
# Daily backup script
pg_dump ticket_system_prod > backup_$(date +%Y%m%d).sql

# Automated with cron
0 2 * * * pg_dump ticket_system_prod > /backups/backup_$(date +\%Y\%m\%d).sql
```

### File Upload Backups
```bash
# Sync uploads to S3 or similar
aws s3 sync /var/app/uploads s3://your-bucket/uploads
```

## Performance Optimization

### Database
- Enable connection pooling in Prisma
- Add database indexes (already included in schema)
- Set up read replicas for high traffic

### Backend
- Enable response compression
- Implement Redis caching for frequent queries
- Use CDN for file downloads

### Frontend
- Enable asset compression in Vite
- Use lazy loading for routes
- Implement code splitting

## Scaling Considerations

When your system grows:
1. Implement Redis for session storage and caching
2. Use message queues (RabbitMQ, AWS SQS) for email notifications
3. Separate file storage to S3/CloudFlare R2
4. Add Elasticsearch for advanced ticket search
5. Implement horizontal scaling with load balancer

## Security Hardening

Production security checklist:
- [ ] Enable CORS only for your domain
- [ ] Use helmet.js with strict CSP
- [ ] Implement rate limiting
- [ ] Enable HTTPS only
- [ ] Set secure cookie flags
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Implement API request logging
- [ ] Add DDoS protection (CloudFlare)
- [ ] Regular database backups
