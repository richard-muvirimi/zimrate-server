<?php

namespace App\Console\Commands;

use App\Notifications\StatusNotification;
use App\Traits\QueriesFaultyRates;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class Status extends Command
{
    use QueriesFaultyRates;

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:status';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send Server StatusMail Report';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $this->info('Retrieving rates for status...');
        $this->newLine();

        $rates = $this->getFaultyRates();

        if ($rates->count() === 0) {
            $this->info('No rates have issues, all good!');
        } else {
            $this->info('Sending status notification...');

            Notification::route('mail', config('mail.to.address'))
                ->notify(new StatusNotification($rates));

            $this->info('Status notification sent!');
        }

        $this->newLine();

    }
}
