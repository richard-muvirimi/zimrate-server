# Zimrate

All Zimbabwean exchange rates from multiple sites in one RESTful / Graphql api. No need to scrounge the internet for the
current days rate.

![Screenshot1](resources/js/assets/images/zimrate_screenshot.png)

### Features

1. Scrapes specified websites using [Scrappy](https://scrappy.tyganeutronics.com) for currency rates and provides an api
   that users can use to access exchange rates.
2. If a scan is failed the site is flagged as failed and will not affect api queries

### Installation (Setting Up)

1. Clone the repository `git clone https://github.com/richard-muvirimi/zimrate-server.git`
2. Run `composer install` to install required dependencies, will build npm packages as well (is case it fails run `npm
   install && npm run build`
3. Setup you `.env` file and run `php artisan migrate` to create database fields
4. You are set up and done now onto adding sites to scan:

    1. The following fields will be created:

        - `id` Unique site identifyer
        - `status` Can only be 0 (failed) or 1 (Success) representing last scan state
        - `enabled` Can only be 0 (failed) or 1 (Success) representing whether the site is enabled for scanning
        - `javascript` Can only be 0 (failed) or 1 (Success) representing whether the site needs to be treated as client
          side rendered
        - `rate_name` Name of site, will be used filtering sites based on source
        - `rate_currency` Name of currency e.g USD, ZAR
        - `source_url` The url of the site you want scanned.
        - `rate_selector` The css selector of the currency field

            - Best obtained by right-clicking in browser, inspect element then copy selector
            - Its best to be very specific as a page you did not create can have multiple ids or elements with same
              class
              names and would only confuse the app
            - the site will discard all non-numeric values and take the highest numeric value

        - `rate` The rate from site, (initially set to 1)
        - `transform` The formula to apply on the rate to get the correct rate relative to 1 USD (initially set
          to `1 * x`)
        - `rate_updated_at` The timestamp when scan was last performed (initially set to 0)
        - `rate_updated_at_selector` The css selector of the date field

            - Best obtained by right-clicking in browser, inspect element then copy selector
            - Its best to be very specific as a page you did not create can have multiple id or elements with same class
              names and would only confuse the app
            - the site will first try to parse the date, if it fails it will remove words that do not refer to a date
              and try parsing again

        - `updated_at` The timestamp when site was last updated. depends on the timezone of site (set below to get
          correct timestamp)
        - `source_timezone` the timezone of site
        - `created_at` The timestamp when site was added

    2. Add sites you want scanned manually into the database (there is no interface for that as i would have to worry
       more about security)

    3. Once done goto `your-site/crawl` and the app will scan rates from specified sites. You can also set up a cron
       job to do this automatically using laravels `schedule:run` command

    4. Set up a cron job pointing to the crawler:
        - URL `your-site/crawl`
        - CLI `php your-site-path/artisan schedule:run` (note the spaces)

5. Visit `your-site/api` or `your-site/api/v1` for the api

### Tests

1. Make sure the server is running `php artisan serve`
2. Run `php artisan test`

### Contributions and Issues

Contributions are more than welcome, as well as issues
