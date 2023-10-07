<?php

namespace App\Console\Commands;

use App\Mail\Scrappy;
use App\Models\Rate;
use Carbon\Carbon;
use Carbon\CarbonInterface;
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
        $this->info("Retrieving rates for scraping...");
        $this->newLine();

        $rates = Rate::query()->enabled()->whereDate('updated_at', '<', Carbon::now('UTC')->subMinutes(30)->format(CarbonInterface::DEFAULT_TO_STRING_FORMAT))->get();

        $this->withProgressBar($rates, function (Rate $rate) {
            $rate->scrape();
        });
        $this->newLine();

        $this->info(sprintf('Scanned %d sites', $rates->count()));
        $this->newLine();
    }
}
