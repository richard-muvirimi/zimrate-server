<?php

namespace App\Providers;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\File;
use Illuminate\Support\ServiceProvider;

class ComposerServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        if (File::exists(app()->basePath('composer.json'))) {
            $composer = File::json(app()->basePath('composer.json'));

            Config::set('app.author', Arr::get($composer, 'authors.0.name') ?: Config::get('app.author'));
            Config::set('app.description', Arr::get($composer, 'description') ?: Config::get('app.description'));
            Config::set('app.keywords', implode(' ', Arr::get($composer, 'keywords', [])) ?: Config::get('app.keywords'));
            Config::set('app.version', Arr::get($composer, 'version') ?: Config::get('app.version'));
        }
    }
}
