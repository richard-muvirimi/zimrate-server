<?php

namespace App\Traits;

use BenBjurstrom\Replicate\Replicate;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

trait ConsultsReplicate
{
    public function consultReplicate(string $prompt): string
    {
        $model = env('REPLICATE_MODEL_ID');

        $input = [
            'prompt' => $prompt,
        ];

        $replicate = new Replicate(
            apiToken: env('REPLICATE_API_TOKEN'),
        );

        $data = $replicate->predictions()->create($model, $input);

        do {
            $data = $replicate->predictions()->get($data->id);

            sleep(1);
        } while ($data->status !== 'succeeded');

        return Str::squish(Arr::join(Arr::wrap($data->output), ''));
    }
}
