<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\OptionController;
use App\Http\Controllers\RateController;
use App\Http\Controllers\RatesController;
use App\Http\Controllers\UserController;

Route::get('setup', [Controller::class, 'setup']);

Route::post('/login', [AuthController::class, 'login']);
Route::get('/logout', [AuthController::class, 'logout']);

Route::match(['get', 'post'], '/', [RatesController::class, 'version0']);
Route::match(['get', 'post'], '/v1', [RatesController::class, 'version1']);

Route::prefix('/admin')->group(function () {
    Route::get('/account', [AuthController::class, 'account']);

    Route::resource('/user', UserController::class);
    Route::resource('/option', OptionController::class);
    Route::resource('/rate', RateController::class);
})->middleware('auth:sanctum');
