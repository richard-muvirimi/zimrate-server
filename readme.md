# Zimrate

All Zimbabwean exchange rates from multiple sites in one RESTful / GraphQL API. No need to scrounge the internet for the
current day's rate.

![Screenshot1](resources/js/front-end/assets/images/zimrate_screenshot.png)

## Features

1. Scrapes specified websites using [Scrappy](https://scrappy.tyganeutronics.com) for currency rates and provides an API
   that users can use to access exchange rates.
2. If a scan fails, the site is flagged as failed and will not affect API queries.

### Installation (Setting Up)

#### Standard Setup

1. Clone the repository: `git clone https://github.com/richard-muvirimi/zimrate-server.git`
2. Run `composer install` to install required dependencies
3. Run `npm install` to install frontend dependencies
4. Run `npm run build` to build the frontend assets
5. Set up your `.env` file by copying from `.env.example` and generate an application key:

   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

6. Configure your database connection in the `.env` file and run the application setup command:

   ```bash
   php artisan app:setup
   ```

   This command will:
   - Create a storage link
   - Clear and optimize cache
   - Run database migrations
   - Prepare the application for use

#### Docker Setup

1. Clone the repository: `git clone https://github.com/richard-muvirimi/zimrate-server.git`
2. Set up your `.env` file by copying from `.env.example`:

   ```bash
   cp .env.example .env
   ```

3. Modify the `.env` file to use the Docker database configuration:

   ```bash
   DB_CONNECTION=mysql
   DB_HOST=db
   DB_PORT=3306
   DB_DATABASE=zimrate
   DB_USERNAME=zimrate
   DB_PASSWORD=zimrate_password
   ```

4. Build and start the Docker containers:

   ```bash
   docker compose up --build -d
   ```

   The Dockerfile's CMD will automatically handle application setup, including key generation and migrations.

See [README.Docker.md](README.Docker.md) for more Docker-specific instructions.

### Adding Sites to Scan

When adding sites to scan, the following fields will be used:

| Field | Description | Default Value |
|-------|-------------|--------------|
| `id` | Unique site identifier | Auto-increment |
| `status` | Last scan state (0 = false, 1 = true) | 1 |
| `enabled` | Whether the site is enabled for scanning (0 = false, 1 = true) | 1 |
| `javascript` | Whether the site needs client-side rendering (0 = false, 1 = true) | 0 |
| `rate_name` | Name of site, used for filtering based on source | Required |
| `rate_currency` | Name of currency (e.g., USD, ZAR) | Required |
| `rate_currency_base` | Base currency of rate (e.g., USD, ZAR), included in extra parameters | Required |
| `source_url` | URL of the site to be scanned | Required |
| `rate_selector` | CSS selector for the currency field | Required |
| `rate` | Rate from site | 1 |
| `last_rate` | Previously set rate, used for change calculations | 1 |
| `transform` | Formula to apply on the rate for correct USD relative value | `1 * x` |
| `rate_updated_at` | Timestamp when scan was last performed | 0 |
| `rate_updated_at_selector` | CSS selector for the date field | Optional |
| `updated_at` | Timestamp when site was last updated (depends on site timezone) | Current time |
| `source_timezone` | Timezone of the site | Required |
| `created_at` | Timestamp when site was added | Current time |
| `status_message` | Last scrape status message (blank if no errors) | Empty string |

#### Notes on Selectors

- **For `rate_selector` and `rate_updated_at_selector`**:
  - Best obtained by right-clicking in a browser, using inspect element, then copying the selector
  - Be very specific as pages may have multiple elements with the same IDs or classes
  - For rate selectors, the system discards all non-numeric values and takes the highest numeric value
  - For date selectors, the system first tries to parse the date directly, and if it fails, it removes non-date words and tries parsing again

### Usage Instructions

1. Add sites you want scanned manually into the database (there is no interface for this as it would require additional security considerations)

2. Once done, go to `your-site/crawl` and the app will scan rates from the specified sites. You can also set up a cron job to do this automatically using Laravel's `schedule:run` command:

   ```bash
   php artisan schedule:run
   ```

3. Set up a cron job pointing to the crawler:
   - URL Method: `your-site/crawl` (not recommended for production)
   - CLI Method (recommended): Add this to your server's crontab:

     ```bash
     * * * * * cd /path-to-your-project && php artisan schedule:run >> /dev/null 2>&1
     ```

   - Docker Method: See [README.Docker.md](README.Docker.md) for instructions on setting up a cron job with Docker.

4. Visit `your-site/api` or `your-site/api/v1` to access the API

### Tests

1. Make sure the server is running: `php artisan serve`
2. Run the tests: `php artisan test`

### Contributions and Issues

Contributions are more than welcome, as well as issue reports.
