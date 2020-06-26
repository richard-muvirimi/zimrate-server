<?php

$lang['developers'] = "For Software Developers";

$lang['disclaimer'] = "Disclaimer:";
$lang['documentation_disclaimer'] = "As a developer, I guess your are familier with how we (as software developers) hate to write documentation for software. After all we are not bloggers. But I have tried to be as extensive as possible, please contact me if all this is just gibberish.";

$lang['api_access'] = "The api can be accessed by visiting %s. There are a total of four possible query parameter combinations that can be passed to get data from the RESTful Api namely:";

$lang['param_name_title'] = "<code>name</code> or <code>source</code>";
$lang['param_name'] = "Allows you to get currency rates using only part of a name of said currency (couldn't decide which best descibes the parameter)";

$lang['param_currency_title'] = "<code>currency</code>";
$lang['param_currency'] = "Can only be either of <code>%s</code>, this is only for when you require a specific currency.";

$lang['param_date_title'] = '<code>date</code>';
$lang['param_date'] = 'When provided only matching rate after this date will be returned.';

$lang['param_prefer_title'] = '<code>prefer</code>';
$lang['param_prefer'] = 'Can only be either of <code>MEAN, MAX, MIN</code>. or empty to return the whole list.';

$lang['param_emphasis'] = "All these parameters are optional and are only there as a convenience to get the specific data that you need.";
$lang['usage_emphasis'] = "Note: Never refer to the returned values based on their position as if a site goes down or is removed they may not be included thus distorting their position. A request with the prefer parameter is much more stable as it includes values from all available sites and not a specific one.";