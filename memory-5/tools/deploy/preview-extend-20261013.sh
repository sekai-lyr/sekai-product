#!/usr/bin/env bash
set -euo pipefail
for path in /opt/sekai-preview/authorized_keys /home/sekai-preview/.ssh/authorized_keys; do
  test "$(grep -c 'expiry-time="20261014121000Z"' "$path")" -eq 1
done
grep -q 'OnCalendar=2026-10-14 12:10:00 UTC' /etc/systemd/system/sekai-preview-expire.timer
backup=/opt/sekai-preview/expiry-backup-20261013
test ! -e "$backup"
install -d -m 700 "$backup"
cp -a /opt/sekai-preview/authorized_keys "$backup/staged-authorized_keys"
cp -a /home/sekai-preview/.ssh/authorized_keys "$backup/live-authorized_keys"
cp -a /etc/systemd/system/sekai-preview-expire.timer "$backup/preview-expire.timer"
sed -i 's/20261014121000Z/20261018041000Z/' /opt/sekai-preview/authorized_keys /home/sekai-preview/.ssh/authorized_keys
sed -i 's/2026-10-14 12:10:00 UTC/2026-10-18 04:10:00 UTC/' /etc/systemd/system/sekai-preview-expire.timer
chown sekai-preview:sekai-preview /home/sekai-preview/.ssh/authorized_keys
chmod 600 /home/sekai-preview/.ssh/authorized_keys
systemctl daemon-reload
systemctl restart sekai-preview-expire.timer
systemctl is-active sekai-preview-expire.timer
grep -o 'expiry-time="[^"]*"' /home/sekai-preview/.ssh/authorized_keys
systemctl list-timers sekai-preview-expire.timer --no-pager
