<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::command('app:scrape')->hourly()->timezone('Africa/Harare')->between('8:00', '20:00');

Schedule::command('app:status')->daily()->timezone('Africa/Harare')->at('20:00');

Schedule::command('queue:work --max-time=60')->everyMinute();

// Run health checks every 5 minutes
Schedule::command('health:check')
    ->everyFiveMinutes()
    ->appendOutputTo(storage_path('logs/health-check.log'));
