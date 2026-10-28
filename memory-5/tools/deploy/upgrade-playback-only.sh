#!/usr/bin/env bash
# Playback-only deployment: replaces the application jar without touching the schema,
# nginx configuration or /etc/sekai-song, and proves the protected tables are unchanged.
#
# usage: upgrade-playback-only.sh /opt/sekai-releases/<release> <expected-sha256>
set -euo pipefail
umask 077

release="${1:?Release directory required}"
expected="${2:?Expected SHA256 required}"
case "$release" in /opt/sekai-releases/[0-9]*) ;; *) echo 'Invalid release target'; exit 2 ;; esac
test "$(realpath "$release")" = "$release"
test -s "$release/app.jar"
test "$(sha256sum "$release/app.jar" | cut -d' ' -f1)" = "$expected"

backup="/opt/sekai-backups/$(basename "$release")"
test ! -e "$backup"

public_status=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/)
case "$public_status" in 301|503) ;; *) echo "Unexpected public HTTP state: $public_status"; exit 1 ;; esac

install -d -m 700 "$backup"
cp -a /opt/sekai-song/app.jar "$backup/app.jar"
cp -a /etc/sekai-song/application-prod.properties "$backup/application-prod.properties"
cp -a /etc/nginx/conf.d/sekai-https.conf "$backup/sekai-https.conf"
mysqldump --single-transaction --routines --triggers sekai_friend > "$backup/database.sql"
mysqldump --skip-comments --no-create-info --skip-extended-insert sekai_friend sekai_song_user sekai_song_track sekai_song_local_binding > "$backup/protected.before.sql"

rollback(){
    echo 'Playback deployment failed; restoring the previous application'
    install -o sekai -g sekai -m 640 "$backup/app.jar" /opt/sekai-song/app.jar
    systemctl restart sekai-song
}
trap rollback ERR

systemctl stop sekai-song
install -o sekai -g sekai -m 640 "$release/app.jar" /opt/sekai-song/app.jar
systemctl start sekai-song

ready=0
for attempt in $(seq 1 40); do
    if test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8085/login || true)" = 200; then ready=1; break; fi
    sleep 1
done
test "$ready" = 1
systemctl is-active --quiet sekai-song

# Static assets that live outside the maven resource filter must still be served.
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8085/images/login-music-room.png)" = 200
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8085/js/vendor/folia-gallery/avatar2-BDV3JGSV.png)" = 200
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8085/js/vendor/folia-sekai-source.zip)" = 200

test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/)" = "$public_status"

mysqldump --skip-comments --no-create-info --skip-extended-insert sekai_friend sekai_song_user sekai_song_track sekai_song_local_binding > "$backup/protected.after.sql"
cmp "$backup/protected.before.sql" "$backup/protected.after.sql"
trap - ERR

echo "Playback-only deployment complete; account/song/binding rows unchanged; public HTTP remains $public_status"
sha256sum /opt/sekai-song/app.jar
