# LukaBot Server Deployment

This document captures the current server deployment setup for LukaBot on the DigitalOcean droplet.

## 1. Project layout on server

- App root: `/opt/lukarag`
- Frontend build output: `/opt/lukarag/dist`
- Backend FastAPI app: `/opt/lukarag/backend`
- Backend virtualenv: `/opt/lukarag/.venv`
- Environment file: `/opt/lukarag/.env`

## 2. Nginx configuration

The active Nginx site should use the following configuration.

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /opt/lukarag/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|json|txt|woff2?)$ {
        expires 1w;
        add_header Cache-Control "public, immutable";
    }
}
```

Important notes:
- `root` must be `/opt/lukarag/dist`.
- `try_files $uri $uri/ /index.html;` is required for SPA routing.
- The `default_server` directive ensures this block handles requests on `127.0.0.1` and the public IP.

## 3. Backend systemd service

Create `/etc/systemd/system/lukabot.service` with:

```ini
[Unit]
Description=LukaBot FastAPI backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/lukarag
EnvironmentFile=/opt/lukarag/.env
ExecStart=/opt/lukarag/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user-target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lukabot.service
sudo systemctl status lukabot.service
```

Check logs with:

```bash
sudo journalctl -u lukabot.service -f
```

## 4. Backend health verification

Verify backend is accessible locally:

```bash
curl -v http://127.0.0.1:8000/health
```

If the backend is running correctly, this should return a JSON response.

## 5. Frontend verification

Verify Nginx is serving the frontend:

```bash
curl -v http://127.0.0.1/
```

The response should be the built `index.html` from `/opt/lukarag/dist`.

## 6. Key troubleshooting points

- If `curl http://127.0.0.1/` returns `500`, the Nginx site config is likely incorrect or pointing to the wrong root.
- If the backend is not reachable on port `8000`, the systemd service is not running or has failed.
- If the frontend loads but API calls fail, the backend is not running or the `/api/` proxy is misconfigured.

## 7. Useful commands

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
sudo ss -ltnp | grep ':8000'
sudo systemctl status lukabot.service
sudo journalctl -u lukabot.service -n 50 --no-pager
```

## 8. Current deployment facts

- App is deployed under `/opt/lukarag`
- Frontend build is available at `/opt/lukarag/dist`
- Backend service should run at `127.0.0.1:8000`
- Nginx proxies `/api/` to the backend and serves static frontend files directly

## 9. Zulip direct backend integration

This backend now includes Zulip integration via `backend/services/zulip_service.py` and `backend/api/zulip.py`.

### Supported patterns
- `POST /api/zulip/send` to send a Zulip message from the backend
- `POST /api/zulip/incoming` to receive a Zulip webhook and reply directly via Zulip

### Required environment variables
- `ZULIP_SITE_URL` = `https://your-zulip-domain`
- `ZULIP_BOT_EMAIL` = Zulip bot email
- `ZULIP_API_KEY` = Zulip bot API key

### Example outgoing message payload
```json
{
  "type": "stream",
  "to": "general",
  "subject": "KingsBox",
  "content": "Hello from LukaBot!"
}
```

### Example incoming webhook handling payload
```json
{
  "message": {"content": "Hello"},
  "sender_email": "user@example.com",
  "sender_full_name": "User Name",
  "stream": "general",
  "subject": "chat"
}
```

The backend will use the Zulip bot credentials to post replies directly back into Zulip.
