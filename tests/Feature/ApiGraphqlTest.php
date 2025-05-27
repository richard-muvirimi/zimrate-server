<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Option;
use App\Models\Rate;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\TestCase;
use Nuwave\Lighthouse\Testing\MakesGraphQLRequests;
use Nuwave\Lighthouse\Testing\RefreshesSchemaCache;
use Tests\CreatesApplication;

/**
 * Graphql Api Test Class
 */
class ApiGraphqlTest extends TestCase
{
    use CreatesApplication;
    use MakesGraphQLRequests;
    use RefreshesSchemaCache;

    /**
     * Test the api responds.
     */
    public function test_api_responds(): void
    {
        $response = $this->graphQl(/** @lang GraphQL */ 'query {USD : rate { currency last_checked last_updated name rate url }}');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'USD' => [
                    '*' => [
                        'currency',
                        'last_checked',
                        'last_updated',
                        'name',
                        'rate',
                        'url',
                    ],
                ],
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
            $response = $this->graphQl(/** @lang GraphQL */ 'query($prefer : Prefer!) {USD : rate(prefer : $prefer) { currency last_checked last_updated rate }}', ['prefer' => $aggregate]);

            $response->assertStatus(200);
            $response->assertJsonStructure([
                'data' => [
                    'USD' => [
                        '*' => [
                            'currency',
                            'last_checked',
                            'last_updated',
                            'rate',
                        ],
                    ],
                ],
            ]);

            if ($aggregate !== 'RANDOM') {
                Rate::query()->enabled()->updated()->preferred($aggregate)->get(['rate_currency', 'updated_at', 'rate_updated_at', 'rate'])->each(function (Rate $rate) use ($response) {
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

        $currency = Rate::query()->enabled()->updated()->first(['rate_currency'])->currency;

        $response = $this->graphQl(/** @lang GraphQL */ 'query ($currency: Currency!) { USD: rate(currency : $currency) { currency last_checked last_updated name rate url }}', ['currency' => $currency]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'USD' => [
                    '*' => [
                        'currency',
                        'last_checked',
                        'last_updated',
                        'name',
                        'rate',
                        'url',
                    ],
                ],
            ],
        ]);

        Rate::query()->enabled()->updated()->currency($currency)->get(['rate_currency', 'updated_at', 'rate_updated_at', 'rate_name', 'rate', 'source_url'])->each(function (Rate $rate) use ($response) {
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

        $date = Carbon::now()->subDay()->getTimestamp();

        $response = $this->graphQl(/** @lang GraphQL */ 'query ($date : Int!) { USD : rate(date:  $date) { currency last_checked last_updated name rate url }}', ['date' => $date]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'USD' => [
                    '*' => [
                        'currency',
                        'last_checked',
                        'last_updated',
                        'name',
                        'rate',
                        'url',
                    ],
                ],
            ],
        ]);

        Rate::query()->enabled()->updated()->date($date)->get(['rate_currency', 'updated_at', 'rate_updated_at', 'rate_name', 'rate', 'source_url'])->each(function (Rate $rate) use ($response) {
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
     * Test the info is returned in response
     */
    public function test_info_is_included_in_response(): void
    {
        $response = $this->graphQl(/** @lang GraphQL */ 'query {USD : rate { currency last_checked last_updated name rate url }, info: info}');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'USD' => [
                    '*' => [
                        'currency',
                        'last_checked',
                        'last_updated',
                        'name',
                        'rate',
                        'url',
                    ],
                ],
                'info',
            ],
        ]);

        $response->assertJsonFragment([
            'info' => Option::query()->firstWhere('key', 'notice')->value('value'),
        ]);
    }

    /**
     * Test the cors support of the api
     */
    public function test_cors_headers_are_set(): void
    {
        $response = $this->graphQl(/** @lang GraphQL */ 'query {USD : rate { currency last_checked last_updated name rate url }}', []);

        $response->assertStatus(200);
        $response->assertHeader('Access-Control-Allow-Origin', '*');
    }
}
