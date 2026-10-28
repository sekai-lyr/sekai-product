#!/usr/bin/env bash
set -euo pipefail
umask 077
release="${1:?Release directory required}"
case "$release" in /opt/sekai-releases/[0-9]*) ;; *) echo 'Invalid release target'; exit 2 ;; esac
test "$(realpath "$release")" = "$release"
test -r "$release/app.jar"
test -r /opt/sekai-song/app.jar
test "$(df --output=avail -B1 /opt | tail -1 | tr -d ' ')" -gt 536870912
backup="/opt/sekai-backups/$(basename "$release")"
if test -e "$backup"; then
    test "${2:-}" = --resume
    test -s "$backup/database.sql"
    test -s "$backup/configuration.tar.gz"
    cmp /opt/sekai-song/app.jar "$backup/app.jar"
    mysqldump --skip-comments --no-create-info --skip-extended-insert sekai_friend sekai_song_user sekai_song_track sekai_song_local_binding > "$backup/protected.resume.sql"
    cmp "$backup/protected.before.sql" "$backup/protected.resume.sql"
else
    mkdir -p "$backup"
    chmod 700 "$backup"
    cp -a /opt/sekai-song/app.jar "$backup/app.jar"
    tar -czf "$backup/configuration.tar.gz" /etc/sekai-song /etc/nginx/conf.d /etc/systemd/system/sekai-song.service 2>/dev/null
    mysqldump --single-transaction --routines --triggers sekai_friend > "$backup/database.sql"
    mysql -N -e 'SELECT COUNT(*) FROM sekai_friend.sekai_song_track; SELECT COUNT(*) FROM sekai_friend.sekai_song_user; SELECT COUNT(*) FROM sekai_friend.sekai_song_local_binding;' > "$backup/counts.before"
    mysqldump --skip-comments --no-create-info --skip-extended-insert sekai_friend sekai_song_user sekai_song_track sekai_song_local_binding > "$backup/protected.before.sql"
fi
install -m 644 "$release/nginx-review-http.conf" /etc/nginx/conf.d/sekai-acme.conf
install -m 644 "$release/nginx-review-https.conf" /etc/nginx/conf.d/sekai-https.conf
nginx -t
systemctl reload nginx
closed=0
for attempt in $(seq 1 10); do
    if test "$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: sekaisong.com' http://127.0.0.1/)" = 503; then closed=1; break; fi
    sleep 1
done
test "$closed" = 1
echo 'Backup complete; public maintenance enabled'
rollback() {
    echo 'Upgrade failed; restoring previous application, keeping public maintenance enabled'
    install -o sekai -g sekai -m 640 "$backup/app.jar" /opt/sekai-song/app.jar
    systemctl restart sekai-song
}
trap rollback ERR
systemctl stop sekai-song
mysql sekai_friend < "$release/feedback-overview.sql"
mysql sekai_friend < "$release/listener-plaza-upgrade.sql" > "$backup/migration.out"
# Only new comment fields are affected; legacy rating values are preserved.
mysql sekai_friend -e 'ALTER TABLE sekai_song_feedback MODIFY usability TINYINT NULL, MODIFY innovation TINYINT NULL;'
mysqldump --skip-comments --no-create-info --skip-extended-insert sekai_friend sekai_song_user sekai_song_track sekai_song_local_binding > "$backup/protected.after.sql"
cmp "$backup/protected.before.sql" "$backup/protected.after.sql"
install -o sekai -g sekai -m 640 "$release/app.jar" /opt/sekai-song/app.jar
chgrp sekai /etc/sekai-song
chmod 750 /etc/sekai-song
chmod 600 /etc/sekai-song/environment
systemctl start sekai-song
ready=0
for attempt in $(seq 1 40); do
    if test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8085/login || true)" = 200; then ready=1; break; fi
    sleep 1
done
test "$ready" = 1
systemctl is-active --quiet sekai-song
mysql -N -e 'SELECT COUNT(*) FROM sekai_friend.sekai_song_track; SELECT COUNT(*) FROM sekai_friend.sekai_song_user; SELECT COUNT(*) FROM sekai_friend.sekai_song_local_binding;' > "$backup/counts.after"
cmp "$backup/counts.before" "$backup/counts.after"
trap - ERR
echo "Deployment complete; backup=$backup"
