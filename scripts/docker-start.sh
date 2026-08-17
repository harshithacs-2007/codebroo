#!/bin/sh
set -eu
mkdir -p /app/data /app/sandbox
chown -R broo:broo /app/data /app/sandbox
exec su -s /bin/sh broo -c 'node --experimental-strip-types apps/server/src/index.ts'
