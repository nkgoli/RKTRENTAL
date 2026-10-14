#!/bin/sh
# Apply pending migrations, then serve. Migrations are idempotent
# (`prisma migrate deploy`); to run them as a separate release step instead,
# override the entrypoint and run this command before starting the app.
set -e
node node_modules/prisma/build/index.js migrate deploy
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
