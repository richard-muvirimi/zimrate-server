<?php

$lang['developers'] = "For Software Developers";

$lang['disclaimer'] = "Disclaimer:";
$lang['documentation_disclaimer'] = "As a developer, I guess your are familier with how we (as software developers) hate to write documentation for software. After all we are not bloggers. But I have tried to be as extensive as possible, please contact me if all this does not make sense after reading through a few times.";

$lang['api_access'] = "The api can be accessed by visiting %s.";
$lang['api_parameters'] = "Accessing Rates";
$lang['api_brief'] = "There are a total of four possible query parameter combinations (GET | POST) that can be passed to get data from the RESTful Api namely:";

$lang['param_name_title'] = "<code>name</code> or <code>source</code>";
$lang['param_name'] = "Allows you to get currency rates using only part of a name of said currency (couldn't decide which best descibes the parameter)";

$lang['param_currency_title'] = "<code>currency</code>";
$lang['param_currency'] = "Can only be either of <code>%s</code>, this is only for when you require a specific currency.";

$lang['param_date_title'] = '<code>date</code>';
$lang['param_date'] = 'When provided only matching rate after this date will be returned.';

$lang['param_prefer_title'] = '<code>prefer</code>';
$lang['param_prefer'] = 'Can only be either of <code>MEAN, MAX, MIN</code>. or empty to return the whole list.';

$lang['param_emphasis'] = "All these parameters are optional and are there only as a convenience to get the specific data that you need.";
$lang['usage_emphasis'] = "Avoid accessing returned values based on their position as if a site goes down or is removed that site's rates may not be included thus distorting their position. A request with the prefer parameter is much more relaible as it includes values from all available sites and not a specific one.";
$lang['info_disable'] = "You can disable <code>info</code> from the response by passing <code>info=false</code> in your request.";

$lang['cors_title'] = 'Javascript CORS (Cross Origin Resource Sharing)';
$lang['cors_state'] = 'By default the api does not allow CORS but in cases where you require it there are two options:';
$lang['cors_param'] = 'Adding <code>cors=true</code> to your request';
$lang['cors_jsonp'] = 'Or using the <code>script</code> tag with the url having the parameter <code>callback</code> where the value will be the name of the function you want called after the tag is loaded. For example <code>callback=myFunction</code> will return wrapped in a function call as <code>myFunction({...});</code>';
$lang['cors_summary'] = 'Both achieve the same result with the later being applicable whilst the document is still loading.';
$lang['cors_example'] = '<pre><code>
function getRates() {
    var s = document.createElement("script");
    s.src = "%s?callback=myFunction";
    document.body.appendChild(s);
}

function myFunction(rates){
    console.log(rates);
    //remove script tag...
}
</code></pre>';
