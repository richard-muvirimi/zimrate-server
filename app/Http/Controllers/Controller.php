<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

class Controller extends BaseController
{
    use AuthorizesRequests;
    use ValidatesRequests;

    /**
     * The front end view.
     */
    public function frontEnd(Request $request): View
    {
        return view('front-end');
    }

    /**
     * The back end view.
     */
    public function backEnd(Request $request): View
    {
        return view('back-end');
    }
}
