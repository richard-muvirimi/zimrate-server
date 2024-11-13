<?php

declare(strict_types=1);

namespace App\GraphQL\Queries;

use App\Enums\OptionKey;
use App\Models\Option;

final class InfoQuery
{
    /**
     * @param  array{}  $args
     */
    public function __invoke($_, array $args)
    {
        return Option::query()->firstWhere('key', OptionKey::SYSTEM_NOTICE)?->value('value') ?? '';
    }
}
