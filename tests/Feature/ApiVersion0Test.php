<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Rate;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Tests\TestCase;

/**
 * Version 0 Api Test Class
 */
class ApiVersion0Test extends TestCase
{
    /**
     * Test no params of the api
     */
    public function test_api_responds(): void
    {
        $response = $this->getJson('api');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            '*' => [
                'currency',
                'last_checked',
                'last_updated',
                'name',
                'rate',
                'url',
            ],
        ]);

        Rate::query()->enabled()->updated()->get(['rate_currency', 'updated_at', 'rate_updated_at', 'rate_name', 'rate', 'source_url'])->each(function (Rate $rate) use ($response) {
            $response->assertJsonFragment([
                'currency' => $rate->rate_currency,
                'last_checked' => $rate->last_checked,
                'last_updated' => $rate->last_updated,
                'name' => $rate->rate_name,
                'rate' => $rate->rate,
                'url' => $rate->source_url,
            ]);
        });

    }

    /**
     * Test the prefer aggregate of the api
     */
    public function test_filter_prefer_aggregate_works(): void
    {

        $aggregates = ['MAX', 'MEAN', 'MIN', 'MEDIAN', 'MODE', 'RANDOM'];

        foreach ($aggregates as $aggregate) {

            $query = [
                'prefer' => $aggregate,
            ];

            $response = $this->getJson('api?'.Arr::query($query));

            $response->assertStatus(200);
            $response->assertJsonStructure([
                '*' => [
                    'currency',
                    'last_checked',
                    'last_updated',
                    'rate',
                ],
            ]);

            if ($aggregate !== 'RANDOM') {
                Rate::query()->enabled()->updated()->preferred($query['prefer'])->get(['rate_currency', 'updated_at', 'rate_updated_at', 'rate'])->each(function (Rate $rate) use ($response) {
                    $response->assertJsonFragment([
                        'currency' => $rate->rate_currency,
                        'last_checked' => $rate->last_checked,
                        'last_updated' => $rate->last_updated,
                        'rate' => $rate->rate,
                    ]);
                });
            }
        }
    }

    /**
     * Test the currency of the api
     */
    public function test_filter_currency_works(): void
    {
        $query = [
            'currency' => Rate::query()->enabled()->updated()->first(['rate_currency'])->currency,
        ];

        $response = $this->getJson('api?'.Arr::query($query));

        $response->assertStatus(200);
        $response->assertJsonStructure([
            '*' => [
                'currency',
                'last_checked',
                'last_updated',
                'name',
                'rate',
                'url',
            ],
        ]);

        Rate::query()->enabled()->updated()->currency($query['currency'])->get(['rate_currency', 'updated_at', 'rate_updated_at', 'rate_name', 'rate', 'source_url'])->each(function (Rate $rate) use ($response) {
            $response->assertJsonFragment([
                'currency' => $rate->rate_currency,
                'last_checked' => $rate->last_checked,
                'last_updated' => $rate->last_updated,
                'name' => $rate->rate_name,
                'rate' => $rate->rate,
                'url' => $rate->source_url,
            ]);
        });

    }

    /**
     * Test the date of the api
     */
    public function test_filter_date_works(): void
    {

        $query = [
            'date' => Carbon::now()->subDay()->getTimestamp(),
        ];

        $response = $this->getJson('api?'.Arr::query($query));

        $response->assertStatus(200);

        $response->assertJsonStructure([
            '*' => [
                'currency',
                'last_checked',
                'last_updated',
                'name',
                'rate',
                'url',
            ],
        ]);

        Rate::query()->enabled()->updated()->date($query['date'])->get(['rate_currency', 'updated_at', 'rate_updated_at', 'rate_name', 'rate', 'source_url'])->each(function (Rate $rate) use ($response) {
            $response->assertJsonFragment([
                'currency' => $rate->rate_currency,
                'last_checked' => $rate->last_checked,
                'last_updated' => $rate->last_updated,
                'name' => $rate->rate_name,
                'rate' => $rate->rate,
                'url' => $rate->source_url,
            ]);
        });
    }
}
