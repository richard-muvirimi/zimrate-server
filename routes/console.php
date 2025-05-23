<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('sanctum:prune-expired --hours=24')->hourly();
Schedule::command('app:scrape')->hourly()->between('8:00', '20:00');

Schedule::command('app:status')->daily()->at('20:00');

Schedule::command('queue:work --max-time=60')->everyMinute();
