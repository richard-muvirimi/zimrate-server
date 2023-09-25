<?php

namespace App\GraphQL\Mutations;

use App\Models\User;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;

final class Logout
{
    /**
     * @param  array{}  $args
     */
    public function __invoke($_, array $args): ?Authenticatable
    {
        $guard = Auth::guard(Arr::first(config('sanctum.guard')));

        /** @var User $user */
        $user = Auth::user();
        $user->tokens()->delete();
        $guard->logout();

        return $user;
    }
}
