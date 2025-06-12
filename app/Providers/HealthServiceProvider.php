<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Spatie\Health\Checks\Checks\CacheCheck;
use Spatie\Health\Checks\Checks\DatabaseCheck;
use Spatie\Health\Checks\Checks\DebugModeCheck;
use Spatie\Health\Checks\Checks\EnvironmentCheck;
use Spatie\Health\Facades\Health;

class HealthServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Health::checks([
            DatabaseCheck::new(),
            CacheCheck::new(),
            EnvironmentCheck::new()->expectEnvironment('production'),
            DebugModeCheck::new(),
        ]);
    }
}
