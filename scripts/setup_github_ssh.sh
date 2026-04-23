#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 git@github.com:owner/repo.git"
  exit 1
fi

REPO_URL="$1"
SSH_DIR="$HOME/.ssh"
KEY_FILE="$SSH_DIR/github_deploy_key"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [ -f "$KEY_FILE" ]; then
  echo "SSH key already exists at $KEY_FILE"
else
  ssh-keygen -t ed25519 -C "droplet-github-key" -f "$KEY_FILE" -N ""
fi

chmod 600 "$KEY_FILE"

cat > "$SSH_DIR/config" <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy_key
  IdentitiesOnly yes
EOF

chmod 600 "$SSH_DIR/config"

if ! pgrep -u "$USER" ssh-agent >/dev/null 2>&1; then
  eval "$(ssh-agent -s)"
fi

ssh-add -l >/dev/null 2>&1 || ssh-add "$KEY_FILE"

echo ""
echo "=== GitHub deploy key created ==="
echo "Copy the following public key into GitHub repo Settings > Deploy keys:"
echo "------------------------------------------------------------"
cat "${KEY_FILE}.pub"
echo "------------------------------------------------------------"
echo ""
echo "Then test SSH connectivity with:"
echo "  ssh -T git@github.com"
echo ""
echo "Once the key is added to GitHub, clone the repo with:"
echo "  git clone $REPO_URL /opt/lukarag"
