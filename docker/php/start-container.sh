#!/usr/bin/env sh

if [ "$GITHUB_ACTIONS" = "true" ]; then
  echo "Skipping Setup as we are running in GitHub Actions"
else
    # Setup the application
    php artisan app:setup

    exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
fi
