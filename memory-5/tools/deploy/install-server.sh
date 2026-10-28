#!/bin/bash
set -euo pipefail
cd /opt/sekai-deploy
test ! -e /opt/sekai-song/app.jar || { echo 'Existing deployment found; refusing overwrite'; exit 1; }
if mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='sekai_friend'" | grep -qv '^0$'; then
  echo 'Existing database found; refusing import'; exit 1
fi
id sekai >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash sekai
install -d -o sekai -g sekai /opt/sekai-song /opt/sekai-song/uploads/audio /opt/sekai-song/uploads/covers /opt/sekai-song/external-uploads/audio
install -d -o root -g sekai -m 750 /etc/sekai-song
install -m 644 mysql-sekai.cnf /etc/mysql/mysql.conf.d/sekai.cnf
systemctl restart mysql
DB_PASSWORD=$(openssl rand -hex 24)
mysql <<SQL
CREATE DATABASE sekai_friend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sekai_app'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, ALTER ON sekai_friend.* TO 'sekai_app'@'127.0.0.1';
SQL
mysql sekai_friend < song-data.sql
printf 'SEKAI_DB_USER=sekai_app\nSEKAI_DB_PASSWORD=%s\n' "$DB_PASSWORD" > /etc/sekai-song/environment
chmod 600 /etc/sekai-song/environment
install -m 644 application-prod.properties /etc/sekai-song/application-prod.properties
install -o sekai -g sekai -m 640 app.jar /opt/sekai-song/app.jar
tar -xf media.tar -C /opt/sekai-song
chown -R sekai:sekai /opt/sekai-song/uploads
install -m 644 sekai-song.service /etc/systemd/system/sekai-song.service
install -m 644 nginx-sekai-private.conf /etc/nginx/conf.d/sekai-song.conf
# The stock welcome site is disabled for this private deployment.
if test -e /etc/nginx/sites-enabled/default; then
  mv /etc/nginx/sites-enabled/default /etc/nginx/default-site.before-sekai
fi
nginx -t
systemctl daemon-reload
systemctl enable --now sekai-song
systemctl restart nginx
systemctl is-active mysql nginx sekai-song
