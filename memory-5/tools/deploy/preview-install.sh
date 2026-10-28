#!/usr/bin/env bash
set -euo pipefail
stage=/opt/sekai-preview
test -s "$stage/preview_key.pub"
if getent passwd sekai-preview >/dev/null; then echo 'Existing preview account; refusing overwrite'; exit 1; fi
cp -a /etc/ssh/sshd_config "$stage/sshd_config.before"
useradd --create-home --shell /usr/sbin/nologin sekai-preview
install -d -o sekai-preview -g sekai-preview -m 700 /home/sekai-preview/.ssh
{ printf 'restrict,port-forwarding,permitopen="127.0.0.1:8081",expiry-time="20261018041000Z" '; cat "$stage/preview_key.pub"; } > "$stage/authorized_keys"
install -o sekai-preview -g sekai-preview -m 600 "$stage/authorized_keys" /home/sekai-preview/.ssh/authorized_keys
install -m 644 "$stage/preview-ssh-match.conf" /etc/ssh/sekai-preview-match.conf
printf '\nInclude /etc/ssh/sekai-preview-match.conf\n' >> /etc/ssh/sshd_config
if ! /usr/sbin/sshd -t; then cp -a "$stage/sshd_config.before" /etc/ssh/sshd_config; exit 1; fi
install -m 644 "$stage/preview-nginx.conf" /etc/nginx/conf.d/sekai-preview.conf
nginx -t
systemctl reload ssh nginx
chmod 700 "$stage/preview-revoke.sh"
install -m 644 "$stage/preview-expire.service" /etc/systemd/system/sekai-preview-expire.service
install -m 644 "$stage/preview-expire.timer" /etc/systemd/system/sekai-preview-expire.timer
systemctl daemon-reload
systemctl enable --now sekai-preview-expire.timer
echo 'Restricted preview enabled; expiry 2026-10-18 12:10 Asia/Shanghai'
