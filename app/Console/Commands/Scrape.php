<?php

namespace App\Console\Commands;

use App\Models\Rate;
use Illuminate\Console\Command;

class Scrape extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:scrape';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Initiate scraping of rates';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $rates = Rate::query()->enabled()->get();

        $this->withProgressBar($rates, function (Rate $rate) {
            $rate->scrape();
        });

        $this->newLine();
        $this->info(sprintf('Scanned %d sites', $rates->count()));
        $this->newLine();
    }
}
