<?php

defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Modern Simple HTML DOM Parser for PHP
 *
 * @link https://github.com/voku/simple_html_dom
 */
class HtmlParser
{

    public function __construct()
    {
        include_once "simple_html_dom-master/vendor/autoload.php";
    }
}

new HtmlParser();
