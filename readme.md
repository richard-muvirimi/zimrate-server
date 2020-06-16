# Zimrate

All exchange rates from multiple sites in one RESTful api. No need to scrounge the internet for the current days rate.

![Screenshot1](src/images/zimrate_screenshot.png)

### Features

1. Scrape specified webistes for currency rates and provide an api that users can use to access.
2. If a scan is failed the site is flagged as failed and will not affect api queries

### Installation (Setting Up)

1. Open `application/config/config.php` and change `$config['base_url']` to the url of your site
2. Open `application/config/database.php` and enter your database connection details. (The ones available are from my local server environment)
3. You are setup and done now onto adding sites to scan:

    1. Run app once to create database fields (Visit main page)

    2. The following fields will be created:
        * `id`                     Unique site identifyer
        * `status`                 Can only be 0 (failed) or 1(Success) representing last scan state
        * `enabled`                Can only be 0 (failed) or 1(Success) representing whether the site is enabled for scanning
        * `name`                   Name of site, will be used filtering sites based on source
        * `currency`               Name of currency e.g USD, ZAR
        * `url`                    The url of the site you want scanned. Make sure the site does not load it's values using javascript as the app cannot process such sites
        * `selector`               The css selector of the currency field (Best obtained by right clicking in browser, inspect element then copy selector)
        * `rate`                   The rate form site, (initially set to 1)
        * `last_checked`           The timestamp when scan was last perfomed
        * `last_updated_selector`  The css selector of the date field (Best obtained by right clicking in browser, inspect element then copy selector)
        * `last_updated`           The timestamp site was last updated. depends on the timezone of site (set below to get correct timestamp)
        * `timezone`               the timezone of site

    3. Add sites you want scanned manually into the database (there is no interface for that as i would have to worry more about security)

    4. Once done goto `your-site/crawler` and the app will scan rates from specified sites. The app is restricted to scanning each site after 30 minutes to prevent banning on said sites

    5. Set up a cron job pointing to the crawler:
        * URL `your-site/crawler`
        * CLI `your-site-path/index.php crawler index` (note the spaces)

4. For monitoring you can change the crawler headers in `application/models/Rate_crawler.php` => `__get_html_contents` as it defaults to "Zimrate"

5. In `application/controllers/Api.php` => `__logVisit` you can change tracking id to that of your google analytics tracking property