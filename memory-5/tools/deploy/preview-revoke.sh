#!/usr/bin/env bash
set -eu
install -o sekai-preview -g sekai-preview -m 600 /dev/null /home/sekai-preview/.ssh/authorized_keys
pkill -KILL -u sekai-preview || true
