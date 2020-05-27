<?php

defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Google Analytics Measurement Protocol library for PHP
 *
 * @link https://github.com/theiconic/php-ga-measurement-protocol
 */
class PhpGoogleAnalytics
{

    public function __construct()
    {
        include_once "php-ga-measurement-protocol-master/vendor/autoload.php";
    }

}

new PhpGoogleAnalytics();
