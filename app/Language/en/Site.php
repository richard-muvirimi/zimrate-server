<?php

return [
    "default" => [
        'title' => 'ZimRate',
        'description' => 'All Zimbabwean exchange rates from multiple sites in one RESTful api. No need to scrounge the internet for the current days rate.',
        "fork" => "Fork me on GitHub",
    ],
    "page" => [
        'home' => [
            //actions
            'rates' => "View Rates",
            'developers' => "Software Developers",

            //benefits
            'benefit_productive_title' => "Be Productive",
            'benefit_productive' => "Become more productive focusing on what really matters with a no nonsense api that caters for your needs as a software developer.",

            'benefit_time_title' => "Save Time",
            'benefit_time' => "Spend more time developing the core of your applications relying on a fast and reliable api, that is easily customisable to the needs of your applications.",

            'benefit_free_title' => "It's Free",
            'benefit_free' => "Well, had to say it, who doesn't like free goodies.<br>There are no plans to charge for this service.",

            'title_why' => "WHY?",

            'last_checked' => "Last Checked",
            'average' => "Average",
            'maximum' => "Highest",
            'minimum' => "Lowest",
            'rate_usd' => "Against the United States Dollar",

            'sample_app' => "Official apps using this service",
            'google_play' => "Google Play",
            'wordpress' => "WordPress",

            'not_convinced' => "Still not convinced on using api?",
            'contact_btn' => "Get in touch",

            'usd_rate' => "1 USD : {0}",
        ],
        "developers" => [
            'title' => "For Software Developers",

            'disclaimer' => "Disclaimer:",
            'documentation_disclaimer' => "As a developer, I guess your are familier with how we (as software developers) hate to write documentation for software. After all we are not bloggers. But I have tried to be as extensive as possible, please contact me if all this does not make sense after reading through a few times.",

            'api_access' => "The api can be accessed by visiting {0}.",
            'api_parameters' => "Accessing Rates",
            'api_brief' => "There are a total of four possible query parameter combinations (GET | POST) that can be passed to get data from the RESTful Api namely:",

            'param_name_title' => "<code>name</code> or <code>source</code>",
            'param_name' => "Allows you to get currency rates using only part of a name of said currency (couldn't decide which best descibes the parameter)",

            'param_currency_title' => "<code>currency</code>",
            'param_currency' => "Can only be either of <code>{0}</code>, this is only for when you require a specific currency.",

            'param_date_title' => '<code>date</code>',
            'param_date' => 'When provided only matching rate after this date will be returned.',

            'param_prefer_title' => '<code>prefer</code>',
            'param_prefer' => 'Can only be either of <code>MEAN, MAX, MIN</code>. or empty to return the whole list.',

            'param_emphasis' => "All these parameters are optional and are there only as a convenience to get the specific data that you need.",
            'usage_emphasis' => "Avoid accessing returned values based on their position as if a site goes down or is removed that site's rates may not be included thus distorting their position. A request with the prefer parameter is much more relaible as it includes values from all available sites and not a specific one.",
            'info_disable' => "You can disable <code>info</code> from the response by passing <code>info=false</code> in your request.",

            'cors_title' => 'Javascript CORS (Cross Origin Resource Sharing)',
            'cors_state' => 'By default the api does not allow CORS but in cases where you require it there are two options:',
            'cors_param' => 'Adding <code>cors=true</code> to your request',
            'cors_jsonp' => 'Or using the <code>script</code> tag with the url having the parameter <code>callback</code> where the value will be the name of the function you want called after the tag is loaded. For example <code>callback=myFunction</code> will return wrapped in a function call as <code>myFunction({...});</code>',
            'cors_summary' => 'Both achieve the same result with the later being applicable whilst the document is still loading.',
        ],
        'faq' => [
            'title' => "Frequently Asked Questions",

            'q1' => "What the heck is this?",
            'qa1' => "This is a RESTful service that allows you to get Zimbabwean currency updates from a single place.",
            'q2' => "But why?",
            'qa2' => "I noted with frustration that to get the current days rate, one had to visit multiple sites and then work out an average, maximum or minimum from all those sites. this would be a nightmare for a software developer as they would have to scan all those sites to get a meaningful rate. This web application does this automatically every hour so you get an accurate rate by the hour.",
            'q3' => "So how do i get started?",
            'qa3' => "A developers page has been timeously crafted to get you started.",
            'q4' => "How much do i pay?",
            'qa4' => "This is a free service as in FREE. Do with it what ever you see fit (except trying to hack this server of course)",
            'q5' => "What if i need feature X",
            'qa5' => "You are free to contact me on {0} and will do my best to make your idea a reality.",
            'q6' => "Is this stable and can I rely on this",
            'qa6' => "This RESTful application is hosted on a server with a 99.99 percent uptime. Future updates of this RESTful service will not break apps relying on previous versions through the use of Api versioning.",
            'q7' => "Are donations welcome",
            'qa7' => "Yes of course, Visit {0}",
        ],
        'footer' => [
            'copywrite' => "&copy; 2020 Tyganeutronics, all rights reserved",

            'about' => "About",
            'contact' => "Contact",
            'faqs' => "FAQ's",
            'support' => "Support",

            'facebook' => "Facebook",
            'twitter' => "Twitter",
            'google' => "Google",
        ]
    ]
];
