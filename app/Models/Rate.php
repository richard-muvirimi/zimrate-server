<?php

namespace App\Models;

use App\Traits\ScrapesRates;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class Rate extends Model
{
    use ScrapesRates;

    /**
     * Aggregates.
     *
     * @var array|string[]
     */
    public const AGGREGATES = [
        'min',
        'max',
        'mean',
        'median',
        'random',
        'mode',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'status',
        'enabled',
        'rate_name',
        'rate_currency',
        'source_url',
        'rate_selector',
        'rate',
        'last_rate',
        'rate_updated_at',
        'rate_updated_at_selector',
        'updated_at',
        'created_at',
        'source_timezone',
        'transform',
        'status_message',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'status' => 'boolean',
        'enabled' => 'boolean',
        'javascript' => 'boolean',
        'rate' => 'float',
        'last_rate' => 'float',
        'rate_updated_at' => 'datetime',
        'updated_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * Scope a query to only include search results.
     */
    public function scopeSearch(Builder $query, string $search): Builder
    {
        return $query->where('rate_name', 'like', '%'.$search.'%');
    }

    /**
     * Scope a query to only include results matching currency.
     */
    public function scopeCurrency(Builder $query, string $currency): Builder
    {
        return $query->where('rate_currency', strtoupper($currency));
    }

    /**
     * Scope a query to only include results after given date.
     */
    public function scopeDate(Builder $query, int $date): Builder
    {
        return $query->whereDate('rate_updated_at', '>', Carbon::createFromTimestamp($date));
    }

    /**
     * Scope a query to only include enabled results.
     */
    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('enabled', true);
    }

    /**
     * Scope a query to only include successful results.
     */
    public function scopeUpdated(Builder $query): Builder
    {
        return $query->where(function ($query) {
            $query->where('status', true)->orWhere(function ($query) {
                $query->where('status', false)->whereDate('updated_at', '>=', Carbon::now()->subWeek());
            });
        });
    }

    /**
     * Scope response to have cors header.
     */
    public function scopeCors(Builder $query, bool $enable = true): Builder
    {
        return $query;
    }

    /**
     * Scope a query to only include aggregated results.
     */
    public function scopePreferred(Builder $query, string $prefer): Builder
    {
        switch (strtolower($prefer)) {
            case 'max':
                $query->selectRaw('rate_currency, MAX(updated_at) as updated_at, MAX(rate_updated_at) as rate_updated_at, MAX(rate) as rate')
                    ->groupBy('rate_currency');
                break;
            case 'min':
                $query->selectRaw('rate_currency, MAX(updated_at) as updated_at, MAX(rate_updated_at) as rate_updated_at, MIN(rate) as rate')
                    ->groupBy('rate_currency');
                break;
            case 'mean':
                $query->selectRaw('rate_currency, MAX(updated_at) as updated_at, MAX(rate_updated_at) as rate_updated_at, AVG(rate) as rate')
                    ->groupBy('rate_currency');
                break;
            case 'random':
                $rates = $query->clone()->get(['id', 'rate_currency'])->groupBy('rate_currency')->map(function (Collection $rates) {
                    return $rates->random();
                });

                $query->whereIn('id', $rates->pluck('id'));
                break;
            case 'median':
                $rates = $query->clone()->get(['id', 'rate_currency', 'rate'])->groupBy('rate_currency')->map(function (Collection $rates) {
                    if ($rates->count() % 2 === 0) {
                        return $rates->sortBy('rate', SORT_NUMERIC)->slice(floor($rates->count() / 2) - 1, 2);
                    } else {
                        return $rates->sortBy('rate', SORT_NUMERIC)->slice(floor($rates->count() / 2), 1);
                    }
                });

                $query->whereIn('id', $rates->flatten(1)->pluck('id'));
                $query->preferred('MEAN');
                break;
            case 'mode':
                $rates = $query->clone()->get(['id', 'rate_currency', 'rate'])->groupBy('rate_currency')->map(function (Collection $rates) {

                    $rates = $rates->groupBy('rate')->sortBy(function (Collection $rates) {
                        return $rates->count();
                    }, SORT_NUMERIC);

                    return $rates;
                });

                $query->whereIn('id', $rates->flatten(2)->first()->pluck('id'));
                break;
            default:
                break;
        }

        return $query;
    }

    /**
     * Get name attribute.
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: function (mixed $value, array $attributes) {
                return $attributes['rate_name'];
            },
            set: function (mixed $value, array $attributes) {
                $this->attributes['rate_name'] = $value;
            });
    }

    /**
     * Get currency attribute.
     */
    protected function currency(): Attribute
    {
        return Attribute::make(
            get: function (mixed $value, array $attributes) {
                return $attributes['rate_currency'];
            },
            set: function (mixed $value, array $attributes) {
                $this->attributes['rate_currency'] = $value;
            });
    }

    /**
     * Get currency attribute.
     */
    protected function currencyBase(): Attribute
    {
        return Attribute::make(
            get: function (mixed $value, array $attributes) {
                return $attributes['rate_currency_base'];
            },
            set: function (mixed $value, array $attributes) {
                $this->attributes['rate_currency_base'] = $value;
            });
    }

    /**
     * Get url attribute.
     */
    protected function url(): Attribute
    {
        return Attribute::make(
            get: function (mixed $value, array $attributes) {
                return $attributes['source_url'];
            },
            set: function (mixed $value, array $attributes) {
                $this->attributes['source_url'] = $value;
            });
    }

    /**
     * Get last updated attribute.
     */
    protected function lastUpdated(): Attribute
    {
        return Attribute::make(
            get: function (mixed $value, array $attributes) {
                return Carbon::parse($attributes['rate_updated_at'])->getTimestamp();
            },
            set: function (mixed $value, array $attributes) {
                $this->attributes['rate_updated_at'] = Carbon::createFromTimestamp($value);
            });
    }

    /**
     * Get last checked attribute.
     */
    protected function lastChecked(): Attribute
    {
        return Attribute::make(
            get: function (mixed $value, array $attributes) {
                return Carbon::parse($attributes['updated_at'])->getTimestamp();
            },
            set: function (mixed $value, array $attributes) {
                $this->attributes['updated_at'] = Carbon::createFromTimestamp($value);
            });
    }
}
