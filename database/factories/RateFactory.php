<?php

namespace Database\Factories;

use App\Models\Rate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Rate>
 */
class RateFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'status' => $this->faker->boolean,
            'enabled' => $this->faker->boolean,
            'rate_name' => $this->faker->word,
            'rate_currency' => $this->faker->word,
            'rate_currency_base' => $this->faker->word,
            'source_url' => $this->faker->url,
            'rate_selector' => $this->faker->word,
            'rate' => $this->faker->randomFloat(2, 0, 100),
            'last_rate' => $this->faker->randomFloat(2, 0, 100),
            'rate_updated_at' => $this->faker->dateTime(),
            'rate_updated_at_selector' => $this->faker->word,
            'source_timezone' => $this->faker->timezone,
            'transform' => '1 * x',
            'status_message' => $this->faker->sentence,
        ];
    }
}
