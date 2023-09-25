<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Arr;

class Viewify extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:viewify';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Move main view file into views directory';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $this->info('Viewify starting...');

        // Get deploy path from angular.json

        $angularJson = file_get_contents(base_path('angular.json'));
        $angularJson = json_decode($angularJson, true);

        // use dot notation to get the path

        $deployPath = Arr::get($angularJson, 'projects.src.architect.build.options.outputPath');
        $deployPath = basename($deployPath);

        // Replace the stylesheet links
        $contents = file_get_contents(resource_path('views/index.blade.php'));
        $contents = preg_replace('/url\((?!https)([^\'"\)]*|.*)\)/mU', 'url('.$deployPath.'/$1)', $contents);
        file_put_contents(resource_path('views/index.blade.php'), $contents);

        $this->info('Viewify complete!');
    }
}
