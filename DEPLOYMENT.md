# V79 Tick-It — Production Deployment Guide
**Linux server · Docker · Nginx · SSL**

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Docker Engine | 24+ | `docker --version` |
| Docker Compose | v2 | `docker compose version` |
| Domain name | — | Pointed at your server's IP |
| Port 80 + 443 | Open | Firewall / security group |

---

## 1. Clone & Configure

```bash
git clone https://github.com/MrFixITslu/V79Tick-It.git
cd V79Tick-It

# Create your environment file
cp .env.example .env
```

### Generate secrets
```bash
node scripts/generate-secrets.js
```
Copy the output values into `.env`.

### Edit `.env` — required fields

| Variable | Description |
|---|---|
| `APP_BASE_URL` | `https://your-domain.com` |
| `ALLOWED_ORIGINS` | Same as APP_BASE_URL |
| `JWT_SECRET` | Generated 128-char hex |
| `SUPER_ADMIN_JWT_SECRET` | Generated 128-char hex |
| `SUPER_ADMIN_EMAIL` | Your super admin email |
| `SUPER_ADMIN_PASSWORD` | Strong password (8+ chars, 1 upper, 1 number) |

---

## 2. SSL Certificate

### Option A — Let's Encrypt (recommended)
```bash
# Install certbot
sudo apt install certbot

# Get cert (stop any service on port 80 first)
sudo certbot certonly --standalone -d your-domain.com

# Copy certs to nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem  nginx/ssl/
sudo chown -R $USER:$USER nginx/ssl/
```

### Option B — Self-signed (testing only)
```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout nginx/ssl/privkey.pem \
  -out    nginx/ssl/fullchain.pem \
  -days 365 \
  -subj "/CN=localhost"
```

---

## 3. Update Nginx Config

Edit `nginx/nginx.conf` and replace `server_name _;` with your actual domain:
```nginx
server_name your-domain.com www.your-domain.com;
```

---

## 4. Build & Launch

```bash
# Build the image and start all services
docker compose up -d --build

# Verify everything is healthy
docker compose ps
docker compose logs app --tail 30
```

Check the health endpoint:
```bash
curl https://your-domain.com/health
```

---

## 5. First Login

1. Visit `https://your-domain.com`
2. Click **Sign Up** to create your tenant account
3. For super admin access, visit `https://your-domain.com` and use the Super Admin login

---

## 6. Maintenance

### View logs
```bash
docker compose logs app   -f    # App logs (live)
docker compose logs nginx -f    # Nginx logs (live)
```

### Backup the database
```bash
docker compose exec app node scripts/backup-db.js
```
Backups are stored in the `tickit_backups` Docker volume. To copy to host:
```bash
docker run --rm \
  -v v79tick-it_tickit_backups:/backups \
  -v $(pwd)/local-backups:/out \
  alpine sh -c "cp -r /backups /out/"
```

### Update the app
```bash
git pull
docker compose up -d --build
```

### Reset a user password
```bash
docker compose exec app node scripts/reset-password.js user@example.com "NewPassword1!"
```

### Certificate renewal (Let's Encrypt)
```bash
# Add to cron: renew every 60 days
sudo certbot renew
# Then copy new certs and reload nginx
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem  nginx/ssl/
docker compose exec nginx nginx -s reload
```

---

## 7. Database Backup Cron (optional)

```bash
# Run nightly at 3 AM inside the container
echo "0 3 * * * docker exec v79tickit-app node scripts/backup-db.js" | crontab -
```

---

## Architecture

```
Internet → Nginx (443/80)
              ↓
        Node.js app (:3001)
              ↓
        SQLite (Docker volume: tickit_data)
```

| Volume | Purpose |
|---|---|
| `tickit_data` | SQLite database (`data.db`) |
| `tickit_uploads` | User-uploaded files |
| `tickit_logs` | App + audit logs |
| `tickit_backups` | Database backups |
