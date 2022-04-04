<?php

namespace App\Controllers;

use \App\Models\RateModel;

class Home extends BaseController
{

	public function index()
	{

		$rateModel = new RateModel();

		$currencies = array_map(function ($currency) use ($rateModel) {

			$currency->median = $rateModel->getByFilter("", $currency->currency, "", "median", true)[0]["rate"] ?? 0;
			$currency->mode = $rateModel->getByFilter("", $currency->currency, "", "mode", true)[0]["rate"] ?? 0;
			$currency->random = $rateModel->getByFilter("", $currency->currency, "", "random", true)[0]["rate"] ?? 0;

			return $currency;
		}, $rateModel->getDisplayCurrencies());

		$data = array(
			"last_checked" => $rateModel->getLastChecked(),
			"currencies" => $currencies,
		);

		return view('solid/index', $data);
	}
}
