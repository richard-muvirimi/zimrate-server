# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

################################################################################

# Create a new stage for running the application that contains the minimal
# runtime dependencies for the application. This often uses a different base
# image from the install or build stage where the necessary files are copied
# from the install stage.
#
# The example below uses the PHP Apache image as the foundation for running the app.
# By specifying the "8.1-apache" tag, it will also use whatever happens to be the
# most recent version of that tag when you build your Dockerfile.
# If reproducibility is important, consider using a specific digest SHA, like
# php@sha256:99cede493dfd88720b610eb8077c8688d3cca50003d76d1d539b0efc8cca72b4.
FROM php:8.2

# Check if running in GitHub Actions
ARG GITHUB_ACTIONS=false
ENV GITHUB_ACTIONS=${GITHUB_ACTIONS}

WORKDIR /var/www/html

# Set environment variables
ARG TZ=UTC
ENV TZ=${TZ}

# Set the timezone regardless of the system's timezone setting.
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/

# Install dependencies
RUN apt-get update && apt-get install -y \
    default-mysql-client \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libmcrypt-dev \
    libpng-dev \
    libcurl4-nss-dev \
    libc-client-dev \
    libkrb5-dev \
    firebird-dev \
    libicu-dev \
    libxml2-dev \
    libxslt1-dev \
    autoconf \
    zip \
    unzip \
    git \
    libzip-dev \
    locales-all \
    libonig-dev

RUN install-php-extensions \
    bcmath \
    dom \
    exif \
    gd \
    imagick \
    imap \
    intl \
    mysqli \
    pdo_mysql \
    redis \
    soap \
    xdebug \
    xml \
    xsl \
    zip

RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y curl \
    && curl -sLS https://getcomposer.org/installer | php -- --install-dir=/usr/bin/ --filename=composer \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs jq gnupg supervisor dnsutils ffmpeg nano

RUN apt-get update \
    && apt-get install -y cron \
    && echo "* * * * * /usr/bin/php /var/www/html/artisan schedule:run >> /dev/null 2>&1" > /etc/cron.d/schedule \
    && chmod 0644 /etc/cron.d/schedule \
    && crontab /etc/cron.d/schedule \
    && touch /var/log/cron.log

# Cleanup all downloaded packages
RUN apt-get -y autoclean && \
    apt-get -y autoremove && \
    apt-get -y clean && \
    rm -rf /var/lib/apt/lists/*

# Use the default production configuration for PHP runtime arguments, see
# https://github.com/docker-library/docs/tree/master/php#configuration
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

# Comment out xdebug extension line per default
RUN sed -i 's/^zend_extension=/;zend_extension=/g' /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

# Copy xdebug configuration for remote debugging
COPY ./docker/php/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini

#
#--------------------------------------------------------------------------
# Final Touches
#--------------------------------------------------------------------------
#

# Copy the php-fpm config
COPY ./docker/php/php-dev.ini /usr/local/etc/php/conf.d/php.ini

# Configure non-root user.
ARG PUID=1000
ENV PUID=${PUID}
ARG PGID=1000
ENV PGID=${PGID}

# Set the proper permissions
RUN groupmod -o -g ${PGID} www-data && \
    usermod -o -u ${PUID} -g www-data www-data

# Copy the app files from the app directory.
COPY --chown=www-data:www-data . /var/www/html

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage a bind mounts to package.json and package-lock.json to avoid having to copy them into
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --include=dev

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a bind mounts to composer.json and composer.lock to avoid having to copy them
# into this layer.
# Leverage a cache mount to /tmp/cache so that subsequent builds don't have to re-download packages.
RUN --mount=type=bind,source=composer.json,target=composer.json \
    --mount=type=bind,source=composer.lock,target=composer.lock \
    --mount=type=cache,target=/tmp/cache \
    composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

# Build the app and clean up.
RUN npm run build \
    && rm -rf /var/www/html/node_modules

RUN chown -R www-data:www-data /var/www/html

COPY ./docker/php/start-container.sh /usr/local/bin/start-container
RUN chmod +x /usr/local/bin/start-container

COPY ./docker/php/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8000/tcp

ENTRYPOINT ["start-container"]
