# Docker Setup for Zimrate

## Getting Started with Zimrate in Docker

### Environment Setup

1. Copy the example environment file to create your `.env` file:

   ```bash
   cp .env.example .env
   ```

2. Update the following database settings in your `.env` file:

   ```bash
   DB_CONNECTION=mysql
   DB_HOST=db
   DB_PORT=3306
   DB_DATABASE=zimrate
   DB_USERNAME=zimrate
   DB_PASSWORD=zimrate_password
   ```

### Building and Running Zimrate

1. Build and start the Docker containers:

   ```bash
   docker compose up --build -d
   ```

2. Generate the application key:

   ```bash
   docker compose exec app php artisan key:generate
   ```

3. Run database migrations:

   ```bash
   docker compose exec app php artisan migrate
   ```

Your application will be available at [http://localhost:8000](http://localhost:8000).

## Scheduled Tasks (Cron Jobs)

You'll need to set up your own cron job to run Laravel's scheduler. This is required for automatic currency rate updates.

### Option 1: Set up a cron job on your host machine

Add this to your host machine's crontab to run the scheduler inside the Docker container:

```bash
* * * * * docker compose -f /path/to/docker-compose.yml exec -T app php artisan schedule:run >> /dev/null 2>&1
```

Replace `/path/to/docker-compose.yml` with the actual path to your docker-compose.yml file.

### Option 2: Use an external scheduler service

If you're deploying to a cloud provider, you may want to use their scheduler services instead.

### Option 3: Manually trigger scans

To manually trigger a scan of currency rates:

```bash
docker compose exec app php artisan schedule:run
```

Or you can directly access the crawler endpoint at [http://localhost:8000/crawl](http://localhost:8000/crawl).

## Useful Docker Commands

```bash
# Start containers in detached mode
docker compose up -d

# Stop containers
docker compose down

# View logs
docker compose logs -f

# Run artisan commands
docker compose exec app php artisan <command>

# Access MySQL
docker compose exec db mysql -uzimrate -pzimrate_password zimrate
```

## Deploying Zimrate to the Cloud

1. Build your image:

   ```bash
   docker build -t zimrate .
   ```

2. If your cloud uses a different CPU architecture than your development machine (e.g., you are on a Mac M1 and your cloud provider is amd64), build the image for that platform:

   ```bash
   docker build --platform=linux/amd64 -t zimrate .
   ```

3. Push it to your registry:

   ```bash
   docker tag zimrate myregistry.com/zimrate
   docker push myregistry.com/zimrate
   ```

Consult Docker's [getting started](https://docs.docker.com/go/get-started-sharing/) docs for more detail on building and pushing.
