<?php

declare(strict_types=1);

namespace App\GraphQL\Scalars;

use Illuminate\Support\Carbon;
use Nuwave\Lighthouse\Schema\Types\Scalars\DateTime;

/** Read more about scalars here: https://webonyx.github.io/graphql-php/type-definitions/scalars. */
final class UnixTimeStamp extends DateTime
{
    /**
     * {@inheritDoc}
     */
    protected function format(Carbon $carbon): string
    {
        return strval($carbon->getTimestamp());
    }

    /**
     * {@inheritDoc}
     */
    protected function parse(mixed $value): Carbon
    {
        return Carbon::createFromTimestamp($value);
    }
}
