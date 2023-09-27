<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Rate;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Tests\TestCase;

/**
 * Version 1 Api Test Class
 */
class ApiVersion1Test extends TestCase
{
    /**
     * Test no params of the api
     */
    public function test_api_responds(): void
    {
        $response = $this->getJson('api/v1');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'USD' => [
                "*" => [
                    'currency',
                    'last_checked',
                    'last_updated',
                    'name',
                    'rate',
                    'url'
                ]
            ]
        ]);

        Rate::query()->enabled()->updated()->get(["rate_currency", "updated_at", "rate_updated_at", "rate_name", "rate", "source_url"])->each(function (Rate $rate) use ($response) {
            $response->assertJsonFragment([
                'currency' => $rate->currency,
                'last_checked' => $rate->last_checked,
                'last_updated' => $rate->last_updated,
                'name' => $rate->name,
                'rate' => $rate->rate,
                'url' => $rate->url,
            ]);
        });

    }

    /**
     * Test the prefer aggregate of the api
     */
    public function test_filter_prefer_aggregate_works(): void
    {

        $query = [
            'prefer' => "MEDIAN",
        ];

        $response = $this->getJson('api/v1?' . Arr::query($query));

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'USD' => [
                "*" => [
                    'currency',
                    'last_checked',
                    'last_updated',
                    'rate',
                ],
            ],
        ]);

        Rate::query()->enabled()->updated()->preferred($query["prefer"])->get(["rate_currency", "updated_at", "rate_updated_at", "rate"])->each(function (Rate $rate) use ($response) {
            $response->assertJsonFragment([
                'currency' => $rate->currency,
                'last_checked' => $rate->last_checked,
                'last_updated' => $rate->last_updated,
                'rate' => $rate->rate,
            ]);
        });
    }

    /**
     * Test the currency of the api
     */
    public function test_filter_currency_works(): void
    {

        $query = [
            'currency' => Rate::query()->enabled()->updated()->first(['rate_currency'])->currency,
        ];

        $response = $this->getJson('api/v1?' . Arr::query($query));

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'USD' => [
                "*" => [
                    'currency',
                    'last_checked',
                    'last_updated',
                    'name',
                    'rate',
                    'url'
                ],
            ],
        ]);

        Rate::query()->enabled()->updated()->currency($query["currency"])->get(["rate_currency", "updated_at", "rate_updated_at", "rate_name", "rate", "source_url"])->each(function (Rate $rate) use ($response) {
            $response->assertJsonFragment([
                'currency' => $rate->currency,
                'last_checked' => $rate->last_checked,
                'last_updated' => $rate->last_updated,
                'name' => $rate->name,
                'rate' => $rate->rate,
                'url' => $rate->url,
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

        $response = $this->getJson('api/v1?' . Arr::query($query));

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'USD' => [
                "*" => [
                    'currency',
                    'last_checked',
                    'last_updated',
                    'name',
                    'rate',
                    'url'
                ],
            ],
        ]);

        Rate::query()->enabled()->updated()->date($query["date"])->get(["rate_currency", "updated_at", "rate_updated_at", "rate_name", "rate", "source_url"])->each(function (Rate $rate) use ($response) {
            $response->assertJsonFragment([
                'currency' => $rate->currency,
                'last_checked' => $rate->last_checked,
                'last_updated' => $rate->last_updated,
                'name' => $rate->name,
                'rate' => $rate->rate,
                'url' => $rate->url,
            ]);
        });
    }

    /**
     * Test the information removed of the api
     */
    public function test_info_is_excluded_in_response(): void
    {
        $query = [
            'info' => false,
        ];

        $response = $this->getJson('api/v1?' . Arr::query($query));

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'USD' => [
                "*" => [
                    'currency',
                    'last_checked',
                    'last_updated',
                    'name',
                    'rate',
                    'url'
                ],
            ],
        ]);

        Rate::query()->enabled()->updated()->get(["rate_currency", "updated_at", "rate_updated_at", "rate_name", "rate", "source_url"])->each(function (Rate $rate) use ($response) {
            $response->assertJsonFragment([
                'currency' => $rate->currency,
                'last_checked' => $rate->last_checked,
                'last_updated' => $rate->last_updated,
                'name' => $rate->name,
                'rate' => $rate->rate,
                'url' => $rate->url,
            ]);
        });
    }

    /**
     * Test the javascript callback of the api
     */
    public function test_jsonp_callback(): void
    {
        $query = [
            'callback' => 'test',
        ];

        $response = $this->getJson('api/v1?' . Arr::query($query));

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/javascript; charset=UTF-8');

        $response->assertSee('test(');
    }

    /**
     * Test the cors support of the api
     */
    public function test_cors_headers_are_set(): void
    {
        $query = [
            'cors' => true,
        ];

        $response = $this->getJson('api/v1?' . Arr::query($query));

        $response->assertStatus(200);
        $response->assertHeader('Access-Control-Allow-Origin', '*');
    }
}
