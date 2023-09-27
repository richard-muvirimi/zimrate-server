<?php

namespace App\Providers;

use App\Models\Rate;
use GraphQL\Type\Definition\EnumType;
use Illuminate\Support\Arr;
use Illuminate\Support\ServiceProvider;
use Nuwave\Lighthouse\Schema\TypeRegistry;

class GraphQLServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap services.
     */
    public function boot(TypeRegistry $typeRegistry): void
    {

        $aggregates = Rate::AGGREGATES;

        $typeRegistry->register(
            new EnumType([
                'name' => 'Prefer',
                'values' => array_combine(Arr::map($aggregates, 'strtoupper'), Arr::map($aggregates,
                    function ($prefer): array {
                        return ['value' => $prefer];
                    }
                )),
            ])
        );

        $currencies = Rate::query()->distinct()->enabled()->updated()->get(['rate_currency'])->pluck('rate_currency')->toArray();

        $typeRegistry->register(
            new EnumType([
                'name' => 'Currency',
                'values' => array_combine(Arr::map($currencies, 'strtoupper'), Arr::map($currencies,
                    function ($currency): array {
                        return ['value' => $currency];
                    }
                )),
            ])
        );
    }

    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }
}
