<?php

namespace App\Controllers;

use \App\Models\RateModel;

class Home extends BaseController
{

	public function index()
	{

		$rateModel = new RateModel();

		$data = array(
			"last_checked" => $rateModel->getLastChecked(),
			"currencies" => $rateModel->getDisplayCurrencies(),
		);

		return view('solid/index', $data);
	}
}
