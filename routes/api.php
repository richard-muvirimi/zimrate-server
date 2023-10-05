<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\OptionController;
use App\Http\Controllers\RateController;
use App\Http\Controllers\RatesController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::post('login', [AuthController::class, 'login']);
Route::get('logout', [AuthController::class, 'logout']);

Route::match(['get', 'post'], '/', [RatesController::class, 'version0']);
Route::match(['get', 'post'], '/v1', [RatesController::class, 'version1']);

Route::prefix('admin')->group(function () {
    Route::get('/account', [AuthController::class, 'account']);

    Route::resource('/user', UserController::class);
    Route::resource('/option', OptionController::class);
    Route::resource('/rate', RateController::class);
})->middleware('auth:sanctum');
