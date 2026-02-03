/**
 * PM2 Configuration for OnlineEmu Server
 * 
 * This file configures the server to run as a managed process with PM2.
 * PM2 will automatically restart the server if it crashes and can start
 * the server on system boot.
 * 
 * Commands:
 * - Start: pm2 start ecosystem.config.js
 * - Stop: pm2 stop onlineemu
 * - Restart: pm2 restart onlineemu
 * - Logs: pm2 logs onlineemu
 * - Status: pm2 status
 * - Startup (Windows): pm2 startup
 *   Then follow instructions to create startup script
 * - Save current config: pm2 save
 */

module.exports = {
  apps: [{
    name: 'onlineemu',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};
