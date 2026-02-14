# OnlineEmu Server

Self-hosted game console emulator built with Next.js 16 and EmulatorJS.

## Features

- **EmulatorJS Integration**: Runs retro console emulators in an iframe (NES, SNES, N64, PS1, etc.)
- **PWA Support**: Install as a Progressive Web App on any device
- **Auto-Start Games**: Games start automatically when selected (no extra clicks)
- **Responsive Scaling**: Emulator canvas scales to fit any screen size
- **Gamepad Support**: Browser Gamepad API auto-detects controllers
- **Server-Side Saves**: Save states and SRM files stored on the server
- **Local Profiles**: Simple Netflix-style profile system (no authentication)

## Getting Started

```bash
npm install      # Installs deps + downloads EmulatorJS
npm run dev      # Start dev server (localhost:3000)
```

Open [http://localhost:3000](http://localhost:3000) to play games locally.

## PWA Installation

Install OnlineEmu on your phone or tablet:

1. Open `http://localhost:3000` (or your server's URL) in Chrome/Safari
2. Tap the browser menu → "Add to Home Screen"
3. The app installs and runs in standalone mode (no browser chrome)

The PWA caches EmulatorJS assets for offline use.

## Adding Games

1. Place ROM files in `public/roms/{system}/`
2. Click "Scan for ROMs" in the library
3. Games appear automatically with system detection

### Supported Systems

| System | Folder | Extensions |
|--------|--------|------------|
| NES | `nes/` | .nes |
| SNES | `snes/` | .sfc, .smc |
| Game Boy | `gb/` | .gb |
| Game Boy Advance | `gba/` | .gba |
| N64 | `n64/` | .z64, .n64 |
| Nintendo DS | `nds/` | .nds |
| PlayStation | `psx/` | .bin, .cue, .iso |
| PSP | `psp/` | .iso, .cso |
| Genesis | `segaMD/` | .md, .bin |
| Arcade | `arcade/` | .zip |

## Architecture

EmulatorJS **cannot run directly in React** (it tampers with the DOM). We use:

```text
Next.js Page → iframe → emulator.html → EmulatorJS
```

Communication between React and EmulatorJS uses `postMessage`.

## Keyboard Controls

| Key | Action |
|-----|--------|
| Arrow keys | D-Pad |
| Z | A button |
| X | B button |
| A | X button |
| S | Y button |
| Q | L shoulder |
| W | R shoulder |
| Enter | Start |
| Shift | Select |

## Production Deployment

### Vultr VPS Setup

**Recommended Plan**: Standard ($12/mo) - 80GB SSD, 4GB RAM

#### 1. Initial Server Setup

```bash
# SSH to your Vultr server
ssh root@YOUR_SERVER_IP

# Update system packages
apt update && apt upgrade -y

# Install Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Install PM2 globally
npm install -g pm2

# Install git
apt install git -y
```

#### 2. Clone and Build

```bash
# Clone repository to /opt
cd /opt
git clone https://github.com/Deejpotter/online-emu.git
cd online-emu/server

# Install dependencies (runs setup-emulatorjs.js automatically)
npm install

# Build production bundle
npm run build
```

#### 3. Upload ROM Files

From your local PC, upload ROM files via SCP:

```bash
# Example: Upload NES ROMs from Windows
scp -r "H:/Games/NES/ROMs/." root@YOUR_SERVER_IP:/opt/online-emu/server/public/roms/nes/

# Example: Upload N64 ROMs from Linux/Mac
scp -r ~/ROMs/N64/* root@YOUR_SERVER_IP:/opt/online-emu/server/public/roms/n64/
```

#### 4. Start with PM2

```bash
cd /opt/online-emu/server

# Start application (uses ecosystem.config.js)
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Enable auto-start on server reboot
pm2 startup

# Monitor application
pm2 monit
```

#### 5. Configure Firewall

```bash
# Install UFW
apt install ufw -y

# Allow SSH and port 3000
ufw allow 22/tcp
ufw allow 3000/tcp

# Enable firewall
ufw enable
```

Your app is now accessible at `http://YOUR_SERVER_IP:3000`

#### 6. Optional: Nginx + SSL

For custom domain and HTTPS:

```bash
# Install Nginx
apt install nginx -y

# Configure reverse proxy (edit /etc/nginx/sites-available/default)
# Proxy port 80 → localhost:3000

# Install Certbot for Let's Encrypt SSL
apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace with your domain)
certbot --nginx -d yourdomain.com
```

### Updates and Maintenance

```bash
# Pull latest changes
cd /opt/online-emu/server
git pull origin main

# Rebuild and restart
npm install
npm run build
pm2 restart ecosystem.config.js

# View logs
pm2 logs online-emu
```
- 3TB monthly bandwidth

See the main [README.md](../README.md) for full deployment instructions.

## Learn More

- [EmulatorJS Docs](https://emulatorjs.org/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [PM2 Guide](https://pm2.keymetrics.io/docs/)
