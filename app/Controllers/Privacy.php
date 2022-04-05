<?php

namespace App\Controllers;

class Privacy extends BaseController
{

    /**
     * Privacy page endpoint
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return void
     */
    public function index()
    {
        return view('solid/privacy');
    }
}
