<?php

namespace App\Http\Controllers;

use App\Enums\OptionKey;
use App\Models\Option;
use Illuminate\Contracts\View\View;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\Response;

class Controller extends BaseController
{
    use AuthorizesRequests;
    use ValidatesRequests;

    /**
     * Set up the application
     */
    public function setup(Request $request): JsonResponse
    {
        // Start Maintenance
        Artisan::call('down --refresh=15');

        // Clear cache
        Artisan::call('optimize:clear');
        Artisan::call('cache:clear');

        // Generate storage link, ignore errors
        @Artisan::call('storage:link');

        // Optimize Application
        Artisan::call('optimize');

        // Run migrations
        @Artisan::call('migrate');

        // End Maintenance
        Artisan::call('up');

        $composer = File::json(app()->basePath('composer.json'));

        return response()->json([
            'status' => true,
            'version' => Arr::get($composer, 'version'),
        ], Response::HTTP_OK);

    }

    /**
     * The front end view.
     */
    public function frontEnd(Request $request): View
    {
        $data = $this->getData();

        return view('front-end', compact('data'));
    }

    private function getData(): array
    {
        $options = Option::query()
            ->whereIn('key', [OptionKey::SITE_NAME])
            ->pluck('value', 'key')
            ->toArray();

        $composer = File::json(app()->basePath('composer.json'));

        return [
            'author' => Arr::get($composer, 'authors.0.name'),
            'title' => $options[OptionKey::SITE_NAME] ?? config('app.name'),
            'description' => Arr::get($composer, 'description'),
            'keywords' => implode(' ', Arr::get($composer, 'keywords')),
            'version' => Arr::get($composer, 'version'),
        ];
    }

    /**
     * The back end view.
     */
    public function backEnd(Request $request): View
    {
        $data = $this->getData();

        return view('back-end', compact('data'));
    }
}
