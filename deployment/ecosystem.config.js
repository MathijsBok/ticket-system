// PM2 Ecosystem Configuration
// Location: /var/www/ecosystem.config.js
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    // ============================================
    // DEVELOPMENT ENVIRONMENT
    // ============================================
    {
      name: 'ticket-dev-backend',
      cwd: '/var/www/ticket-system-dev/backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3101
      },
      error_file: '/var/log/pm2/ticket-dev-backend-error.log',
      out_file: '/var/log/pm2/ticket-dev-backend-out.log',
      time: true
    },
    {
      name: 'ticket-dev-frontend',
      cwd: '/var/www/ticket-system-dev/frontend',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development'
      },
      error_file: '/var/log/pm2/ticket-dev-frontend-error.log',
      out_file: '/var/log/pm2/ticket-dev-frontend-out.log',
      time: true
    },

    // ============================================
    // PRODUCTION ENVIRONMENT
    // ============================================
    {
      name: 'ticket-prod-backend',
      cwd: '/var/www/ticket-system-prod/backend',
      script: 'dist/server.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/pm2/ticket-prod-backend-error.log',
      out_file: '/var/log/pm2/ticket-prod-backend-out.log',
      time: true
    }
    // Note: Production frontend is served as static files by nginx
    // No PM2 process needed for frontend in production
  ]
};
