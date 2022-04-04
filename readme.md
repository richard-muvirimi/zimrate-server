# Zimrate

All exchange rates from multiple sites in one RESTful api. No need to scrounge the internet for the current days rate.

![Screenshot1](public/images/zimrate_screenshot.png)

### Features

1. Scrape specified webistes for currency rates and provide an api that users can use to access.
2. If a scan is failed the site is flagged as failed and will not affect api queries

### Installation (Setting Up)

1. Copy `env` to `.env` and change the parameters to that of your environment
2. Run `composer install` to install required dependencies
3. Visit `your-site/install` to create database fields
4. If you need to parse javascript sites, you will need to setup the [Panther](https://github.com/symfony/panther) library. On a capable system this would require installing google chrome or chomium and it's chrome driver as detailed in their documentation.
5. You are setup and done now onto adding sites to scan:

   1. The following fields will be created:

      - `id` Unique site identifyer
      - `status` Can only be 0 (failed) or 1(Success) representing last scan state
      - `enabled` Can only be 0 (failed) or 1(Success) representing whether the site is enabled for scanning
      - `javascript` Can only be 0 (failed) or 1(Success) representing whether the site needs the [Panther](https://github.com/symfony/panther) library to parse site
      - `name` Name of site, will be used filtering sites based on source
      - `currency` Name of currency e.g USD, ZAR
      - `url` The url of the site you want scanned.

        - Make sure the site does not load it's values using javascript as the app cannot process such sites
        - Get the full url of the site including the www or http:// or https:// if it's present
        - A site tester is included and can be accessed by going to `your-site/tester?site=site-url` (or using post) where `site-url` is site you want to check
        - The response you get from the site tester is what the app will see on crawling

      - `selector` The css selector of the currency field

        - Best obtained by right clicking in browser, inspect element then copy selector
        - Its best to be very specific as a page you did not create can have multiple id or elements with same class names and would only confuse the app
        - the site will discard all non numeric values and take the highest numeric value

      - `rate` The rate from site, (initially set to 1)
      - `last_checked` The timestamp when scan was last perfomed (initially set to 0)
      - `last_updated_selector` The css selector of the date field

        - Best obtained by right clicking in browser, inspect element then copy selector
        - Its best to be very specific as a page you did not create can have multiple id or elements with same class names and would only confuse the app
        - the site will first try to parse the date, if it fails it will remove words that do not refer to a date and try parsing again

      - `last_updated` The timestamp site was last updated. depends on the timezone of site (set below to get correct timestamp) (initially set to 0)
      - `timezone` the timezone of site

        - Using the site tester linked above, use this field to correct the site's timestamp

   2. Add sites you want scanned manually into the database (there is no interface for that as i would have to worry more about security)

   3. Once done goto `your-site/crawl` and the app will scan rates from specified sites. The app is restricted to scanning each site after 30 minutes to prevent banning on said sites

   4. Set up a cron job pointing to the crawler:
      - URL `your-site/crawl`
      - CLI `your-site-path/index.php crawl index` (note the spaces)

6. For monitoring you can change the crawler headers in `app/Entities/Rate.php` => `get_html_contents()` as it defaults to "Zimrate"

7. Visit `your-site/api` or `your-site/api/v1` for the api

### Contributions and Issues

Contributions are more than welcome, as well as issues
