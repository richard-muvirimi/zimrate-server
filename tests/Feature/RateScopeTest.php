<?php

namespace Tests\Feature;

use App\Models\Rate;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Carbon;
use Tests\CreatesApplication;

class RateScopeTest extends TestCase
{
    use CreatesApplication;

    /**
     * Test scope enabled.
     */
    public function test_scope_enabled(): void
    {
        $rates = Rate::query()->enabled()->get(['enabled']);

        $rates->each(function (Rate $rate) {
            $this->assertTrue($rate->enabled);
        });
    }

    /**
     * Test scope updated.
     */
    public function test_scope_updated(): void
    {
        $rates = Rate::query()->enabled()->updated()->get(['status', 'updated_at']);

        $rates->each(function (Rate $rate) {
            if ($rate->status === false) {
                $this->assertGreaterThanOrEqual(Carbon::now()->startOfHour()->subWeek()->timestamp, $rate->updated_at->timestamp);
            }
        });
    }

    /**
     * Test scope search.
     */
    public function test_scope_search(): void
    {

        $search = Rate::query()->inRandomOrder()->first(['rate_name'])->rate_name;

        $rates = Rate::query()->search($search)->get(['rate_name']);

        $rates->each(function (Rate $rate) use ($search) {
            $this->assertStringContainsString($search, $rate->rate_name);
        });
    }

    /**
     * Test scope date.
     */
    public function test_scope_date(): void
    {

        $date = Rate::query()->oldest('updated_at')->first(['updated_at'])->last_checked;

        $rates = Rate::query()->date($date)->get(['updated_at']);

        $rates->each(function (Rate $rate) use ($date) {
            $this->assertGreaterThanOrEqual($date, $rate->last_checked);
        });
    }

    /**
     * Test scope currency.
     */
    public function test_scope_currency(): void
    {
        $currency = Rate::query()->inRandomOrder()->first()->rate_currency;

        $rates = Rate::query()->currency($currency)->get();

        $rates->each(function (Rate $rate) use ($currency) {
            $this->assertEquals($currency, $rate->rate_currency);
        });
    }

    public function test_scope_preferred(): void
    {

        $prefer = ['MIN', 'MAX', 'MEAN', 'MODE', 'MEDIAN', 'RANDOM'];

        foreach ($prefer as $aggregate) {
            $rates = Rate::query()->preferred($aggregate)->get(['rate', 'rate_currency']);

            $rates->each(function (Rate $rate) use ($aggregate) {
                switch ($aggregate) {
                    case 'MIN':
                        $this->assertEquals($rate->rate, Rate::query()->currency($rate->rate_currency)->min('rate'));
                        break;
                    case 'MAX':
                        $this->assertEquals($rate->rate, Rate::query()->currency($rate->rate_currency)->max('rate'));
                        break;
                    case 'MEAN':
                        $this->assertEquals($rate->rate, Rate::query()->currency($rate->rate_currency)->avg('rate'));
                        break;
                    case 'MODE':
                        $this->assertContains(intval($rate->rate), Rate::query()->preferred($aggregate)->currency($rate->rate_currency)->get(['rate'])->mode('rate'));
                        break;
                    case 'MEDIAN':
                        $this->assertEquals(floor($rate->rate), floor(Rate::query()->preferred($aggregate)->currency($rate->rate_currency)->get(['rate'])->median('rate')));
                        break;
                    case 'RANDOM':
                        $this->assertContains($rate->rate, Rate::query()->currency($rate->rate_currency)->get(['rate'])->pluck('rate'));
                        break;
                }
            });
        }

    }
}
