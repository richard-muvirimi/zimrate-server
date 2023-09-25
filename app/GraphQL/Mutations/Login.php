<?php

namespace App\GraphQL\Mutations;

use App\Models\User;
use Exception;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;

final class Login
{
    /**
     * @param  array{}  $args
     *
     * @throws Exception
     */
    public function __invoke($_, array $args): User
    {
        $guard = Auth::guard(Arr::first(config('sanctum.guard')));

        if (! $guard->attempt($args)) {
            throw new Exception('Invalid credentials.');
        }

        $user = $guard->user();
        assert($user instanceof User, 'Since we successfully logged in, this can no longer be `null`.');

        $user['token'] = $user->createToken('token', [])->plainTextToken;

        return $user;
    }
}
