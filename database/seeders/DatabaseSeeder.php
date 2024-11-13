<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use App\Enums\OptionKey;
use App\Models\Option;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::factory()->count(10)->create();

        if (Option::query()->count() === 0) {

            Option::factory()
                ->createMany([
                    [
                        'key' => OptionKey::SITE_NAME,
                        'value' => config('app.name'),
                    ],
                    [
                        'key' => OptionKey::SYSTEM_NOTICE,
                        'value' => '',
                    ],
                ]);
        }
    }
}
