<?php

namespace App\Controllers;

use \App\Models\RateModel;

class Developers extends BaseController
{

    /**
     * Developers page end point
     *
     * @since 1.0.0
     * @version 1.0.0
     * @return string
     */
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
