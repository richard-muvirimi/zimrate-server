<?php

use App\Http\Controllers\RateController;
use App\Http\Controllers\RatesController;
use Illuminate\Support\Facades\Route;

Route::match(['get', 'post'], '/', [RatesController::class, 'version0']);
Route::match(['get', 'post'], '/v1', [RatesController::class, 'version1']);

Route::prefix('/admin')->group(function () {

    Route::resource('/rate', RateController::class);
})->middleware('auth:sanctum');
