<?php

use App\Providers\AppServiceProvider;
use App\Providers\ComposerServiceProvider;
use App\Providers\GraphQLServiceProvider;
use App\Providers\HealthServiceProvider;

return [
    AppServiceProvider::class,
    ComposerServiceProvider::class,
    GraphQLServiceProvider::class,
    HealthServiceProvider::class,
];
