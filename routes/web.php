<?php

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::fallback(function () {
    $appData = json_decode(file_get_contents(base_path('composer.json')), true);

    $data = [
        'author' => Arr::get($appData, 'authors.0.name'),
        'title' => config('app.name'),
        'description' => Arr::get($appData, 'description'),
        'keywords' => collect(Arr::get($appData, 'keywords'))->join(', '),
    ];

    return view('index', compact('data'));
});

Route::get('setup', function () {
    Artisan::call('migrate');
});

Route::get('crawl', function () {
    Artisan::call('app:scrape');
});
