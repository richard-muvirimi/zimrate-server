<?php

namespace App\Jobs;

use App\Models\Rate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ScrapeRate implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    /**
     * The number of seconds after which the job's unique lock will be released.
     *
     * @var int
     */
    public $uniqueFor = 3600; // 1 hour

    /**
     * Create a new job instance.
     */
    public function __construct(protected Rate $rate)
    {
        //
    }

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout = 90;
    
    /**
     * The number of seconds to wait before retrying the job.
     *
     * @var int
     */
    public $backoff = 60; // 1 minute
    
    /**
     * The unique ID of the job.
     */
    public function uniqueId(): string
    {
        return 'scrape_rate_' . $this->rate->id;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $this->rate->scrape();
    }
}
