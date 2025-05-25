<?php

use App\Http\Controllers\Controller;
use App\Http\Controllers\RatesController;
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

Route::get('/documentation/back-end', function () {
    return view('documentation.back-end');
})->middleware('auth:sanctum');

Route::get('/documentation/front-end', function () {
    return view('documentation.front-end');
});

Route::get('/crawl', function () {
    Artisan::call('app:scrape');
});

Route::get('/status', [RatesController::class, 'status']);

Route::prefix('admin')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [Controller::class, 'backEnd']);
    Route::get('/dashboard', [Controller::class, 'backEnd']);
    Route::fallback([Controller::class, 'backEnd']);
});

Route::fallback([Controller::class, 'frontEnd']);
