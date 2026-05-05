#!/usr/bin/env bash
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "This script must be run as root or with sudo."
  exit 1
fi

APP_DIR="/opt/lukarag"
REPO_URL="${REPO_URL:-}"
DB_USER="${DB_USER:-lukabot}"
DB_PASS="${DB_PASS:-change_me}"
DB_NAME="${DB_NAME:-lukabot}"
DOMAIN="${DOMAIN:-_}"
ENV_FILE="$APP_DIR/.env"

if [ -z "$REPO_URL" ]; then
  echo "Usage: REPO_URL=git@github.com:your-org/lukarag.git DB_USER=lukabot DB_PASS=securepass DB_NAME=lukabot DOMAIN=example.com ./scripts/deploy_droplet.sh"
  exit 1
fi

apt update
apt upgrade -y
apt install -y git curl python3 python3-venv python3-pip python3-dev build-essential libpq-dev nginx postgresql postgresql-contrib

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

mkdir -p "$APP_DIR"
cd /opt
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git pull --rebase || true
fi
cd "$APP_DIR"

# Create Python virtual environment and install backend dependencies
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

# Install and build frontend
cd frontend
npm install
npm run build
cd "$APP_DIR"

# Database setup
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS'"
sudo -u postgres psql -lqt | cut -d '|' -f 1 | grep -qw "$DB_NAME" || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER"

# Create .env if it does not exist
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
CHROMA_DB_DIR=$APP_DIR/chroma_data
OPENAI_API_KEY=
CHROMA_OPENAI_API_KEY=
SECRET_KEY=replace-with-secure-value
DRIVE_FOLDER_ID=
CREDENTIALS_FILE=$APP_DIR/credentials.json
TOKEN_FILE=$APP_DIR/token.json
EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE. Update it with your secrets before starting the app."
else
  echo "$ENV_FILE already exists; keeping current file." 
fi

# Create systemd service file
cat > /etc/systemd/system/lukabot.service <<'SERVICE'
[Unit]
Description=LukaBot FastAPI backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/lukarag
EnvironmentFile=/opt/lukarag/.env
ExecStart=/opt/lukarag/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

# Create Nginx configuration
cat > /etc/nginx/sites-available/lukabot <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    root /opt/lukarag/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|json|txt|woff2?)$ {
        expires 1w;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/lukabot /etc/nginx/sites-enabled/lukabot
rm -f /etc/nginx/sites-enabled/default

systemctl daemon-reload
systemctl enable lukabot.service
systemctl restart lukabot.service
systemctl restart nginx

echo "Deployment script completed."
echo "Next steps: update $ENV_FILE, copy Google credentials to $APP_DIR/credentials.json, and run 'systemctl restart lukabot.service' after editing."