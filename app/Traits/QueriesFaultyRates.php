<?php

namespace App\Traits;

use App\Models\Rate;
use Carbon\Carbon;

trait QueriesFaultyRates
{
    public function getFaultyRates()
    {
        return Rate::query()
            ->enabled()
            ->whereDate('updated_at', '<', Carbon::now('UTC')->subHours(6))
            ->where('status_message', '!=', '')
            ->where('status', 0)
            ->get();
    }
}
