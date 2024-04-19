<?php

namespace App\Traits;

use App\Models\Rate;
use Carbon\Carbon;
use Carbon\CarbonInterface;

trait QueriesFaultyRates
{
    public function getFaultyRates()
    {
        return Rate::query()
            ->enabled()
            ->whereDate('updated_at', '<', Carbon::now('UTC')->subHours(6)->format(CarbonInterface::DEFAULT_TO_STRING_FORMAT))
            ->where('status_message', '<>', '')
            ->where('status', '=', true)
            ->get();
    }
}
