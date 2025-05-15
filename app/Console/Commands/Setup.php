<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class Setup extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:setup';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Set up the application';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $this->info('Setting up the application...');
        $this->newLine();

        // Start Maintenance
        Artisan::call('down --refresh=15');

        // Clear cache
        Artisan::call('optimize:clear');
        Artisan::call('cache:clear');

        // Generate storage link, ignore errors
        if (file_exists(public_path('storage'))) {
            $this->warn('Storage link already exists, skipping...');
        } else {
            $this->info('Creating storage link...');
            @Artisan::call('storage:link');
        }

        // Optimize Application
        Artisan::call('optimize');

        // Run migrations
        @Artisan::call('migrate');

        // End Maintenance
        Artisan::call('up');

        $this->newLine();

    }
}
