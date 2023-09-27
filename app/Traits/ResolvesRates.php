<?php

namespace App\Traits;

use App\Models\Rate;
use App\Rules\IsBoolean;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

trait ResolvesRates
{
    /**
     * Get rates.
     */
    public function getRates(Request $request): array
    {

        $request->validate([
            'search' => 'string|prohibits:source,name',
            'source' => 'string|prohibits:search,name',
            'name' => 'string|prohibits:search,source',
            'date' => 'numeric|date_format:U|before:now',
            'currency' => 'string|exists:rates,rate_currency',
            'prefer' => ['string', Rule::in([...Rate::AGGREGATES, ...Arr::map(Rate::AGGREGATES, "strtoupper")])],
            'callback' => 'string',
            'cors' => [new IsBoolean()],
        ]);

        $query = Rate::query();

        if (Str::of($request->get('cors'))->toBoolean()) {
            $query->cors();
        }

        if ($request->has('search')) {
            $query->search($request->get('search'));
        }

        if ($request->has('currency')) {
            $query->currency($request->get('currency'));
        }

        if ($request->has('date')) {
            $query->date($request->get('date'));
        }

        $query->enabled();
        $query->updated();

        $query->logAnalyticsEvent();

        if ($request->has('prefer')) {
            $query->preferred($request->get('prefer'));
        }

        return $query->get()->map(function ($rate) use ($request) {
            $fields = collect(['currency', 'last_checked', 'last_updated', 'rate']);

            if (!$request->has('prefer')) {
                $fields->push('name', 'url');
            }

            return $rate->only($fields->sort()->toArray());

        })->toArray();
    }
}
