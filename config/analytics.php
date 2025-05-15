<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Google Analytics Measurement ID
    |--------------------------------------------------------------------------
    |
    | This is the measurement ID for Google Analytics/Tag Manager
    |
    */
    'measurement_id' => env('MEASUREMENT_ID', null),

    /*
    |--------------------------------------------------------------------------
    | Google Analytics Measurement Protocol API Secret
    |--------------------------------------------------------------------------
    |
    | This is the API secret for Google Analytics Measurement Protocol
    |
    */
    'measurement_protocol_api_secret' => env('MEASUREMENT_PROTOCOL_API_SECRET', null),
];
