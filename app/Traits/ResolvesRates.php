<?php

namespace App\Traits;

use App\Models\Rate;
use App\Rules\IsBoolean;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
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
            'prefer' => ['string', Rule::in([...Rate::AGGREGATES, ...Arr::map(Rate::AGGREGATES, 'strtoupper')])],
            'callback' => 'string',
            'extra' => [new IsBoolean()],
        ]);

        $query = Rate::query();

        if ($request->has('search')) {
            $query->search($request->input('search'));
        }

        if ($request->has('currency')) {
            $query->currency($request->input('currency'));
        }

        if ($request->has('date')) {
            $query->date($request->input('date'));
        }

        $query->enabled();
        $query->updated();

        if ($request->has('prefer')) {
            $query->preferred($request->input('prefer'));
        }

        // Fields
        $fields = collect(['currency', 'last_checked', 'last_updated', 'rate']);

        if (! $request->has('prefer')) {
            $fields->push('name', 'url');
        }

        if ($request->string('extra', 'false')->toBoolean()) {
            $fields->push('currency_base', 'last_rate');
        }

        return $query->get()->map(function ($rate) use ($fields) {
            return $rate->only($fields->sort()->toArray());
        })->toArray();
    }
}
