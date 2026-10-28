#!/usr/bin/env bash
set -euo pipefail
umask 077
release="${1:?Release directory required}"
case "$release" in /opt/sekai-releases/[0-9]*) ;; *) exit 2 ;; esac
test "$(realpath "$release")" = "$release"
test "$(sha256sum "$release/app.jar" | cut -d' ' -f1)" = "${2:?Expected hash required}"
backup="/opt/sekai-backups/$(basename "$release")-device"
test ! -e "$backup"
install -d -m 700 "$backup"
cp -a /opt/sekai-song/app.jar "$backup/app.jar"
cp -a /etc/sekai-song/application-prod.properties "$backup/application-prod.properties"
cp -a /etc/nginx/conf.d/sekai-https.conf "$backup/sekai-https.conf"
mysqldump --single-transaction --routines --triggers sekai_friend > "$backup/database.sql"
rollback(){
    install -o sekai -g sekai -m 640 "$backup/app.jar" /opt/sekai-song/app.jar
    cp -a "$backup/application-prod.properties" /etc/sekai-song/application-prod.properties
    cp -a "$backup/sekai-https.conf" /etc/nginx/conf.d/sekai-https.conf
    systemctl restart sekai-song
    nginx -t && systemctl reload nginx
}
trap rollback ERR
systemctl stop sekai-song
mysqldump --skip-comments --no-create-info --skip-extended-insert sekai_friend sekai_song_user sekai_song_track sekai_song_local_binding > "$backup/protected.before.sql"
mysql sekai_friend < "$release/device-sharing.sql"
sed -i '/^sekai\.deviceSharing\.enabled=/d' /etc/sekai-song/application-prod.properties
printf '\nsekai.deviceSharing.enabled=true\n' >> /etc/sekai-song/application-prod.properties
install -o sekai -g sekai -m 640 "$release/app.jar" /opt/sekai-song/app.jar
systemctl start sekai-song
ready=0
for attempt in $(seq 1 40); do
    if test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8085/login || true)" = 200; then ready=1; break; fi
    sleep 1
done
test "$ready" = 1
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8085/api/device-sharing/devices)" = 401
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8085/downloads/sekai-device-client.zip)" = 200
install -m 644 "$release/sekai-device-https.conf" /etc/nginx/conf.d/sekai-https.conf
nginx -t
systemctl reload nginx
mysqldump --skip-comments --no-create-info --skip-extended-insert sekai_friend sekai_song_user sekai_song_track sekai_song_local_binding > "$backup/protected.after.sql"
cmp "$backup/protected.before.sql" "$backup/protected.after.sql"
trap - ERR
echo "Device sharing enabled; account/song/binding rows unchanged. Backup: $backup"
sha256sum /opt/sekai-song/app.jar
