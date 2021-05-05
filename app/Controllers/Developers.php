<?php

namespace App\Controllers;

use \App\Models\RateModel;

class Developers extends BaseController
{

    public function index()
    {

        $rateModel = new RateModel();

        $data = array(
            "currencies" => array_column($rateModel->getDisplayCurrencies(), "currency"),
        );

        return view('solid/developers', $data);
    }
}
