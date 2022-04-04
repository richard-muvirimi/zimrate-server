<?php

namespace App\Controllers;

use \App\Models\RateModel;

class Developers extends BaseController
{

    public function index()
    {

        $rateModel = new RateModel();

        $prefers = $rateModel->supportedPrefers();
        sort($prefers);

        $data = array(
            "currencies" => array_column($rateModel->getDisplayCurrencies(), "currency"),
            "prefers" => array_map("strtoupper", $prefers)
        );

        return view('solid/developers', $data);
    }
}