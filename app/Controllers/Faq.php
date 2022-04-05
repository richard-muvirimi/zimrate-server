<?php

namespace App\Controllers;

class Faq extends BaseController
{
    
    /**
     * Frequently asked questions endpoint
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return string
     */
    public function index()
    {
        return view('solid/faq');
    }
}
