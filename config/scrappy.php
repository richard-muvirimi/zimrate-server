<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Scrappy Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains configuration for the Scrappy web scraping service
    | used by the application to fetch exchange rate data from various sources.
    |
    */

    /**
     * API Token for authentication with the Scrappy service
     */
    'token' => env('SCRAPPY_TOKEN'),

    /**
     * Request timeout in seconds
     */
    'timeout' => env('SCRAPPY_TIMEOUT'),

    /**
     * Scrappy server URL (without trailing slash)
     */
    'server' => env('SCRAPPY_SERVER'),

    /**
     * User agent string for HTTP requests
     */
    'user_agent' => env('USER_AGENT', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'),

];
