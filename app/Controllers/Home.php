<?php

namespace App\Controllers;

use App\Entities\Rate;
use \App\Models\RateModel;
use CodeIgniter\API\ResponseTrait;

/**
 * Front Page Controller
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class Home extends BaseController
{

	use ResponseTrait;

	/**
	 * Home page endpoint
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	public function index()
	{
		$model = new RateModel();

		$currencies = array_map(function ($currency) use ($model) {
			$currency->median = $model->getByFilter('', $currency->currency, 0, 'median', true)[0]['rate'] ?? 0;
			$currency->mode   = $model->getByFilter('', $currency->currency, 0, 'mode', true)[0]['rate'] ?? 0;
			$currency->random = $model->getByFilter('', $currency->currency, 0, 'random', true)[0]['rate'] ?? 0;

			return $currency;
		}, $model->getDisplayCurrencies());

		$data = [
			'lastChecked' => $model->getLastChecked(),
			'currencies'  => $currencies,
		];

		return view('solid/index', $data);
	}

	/**
	 * Frequently asked questions endpoint
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	public function faq():string
	{
		return view('solid/faq');
	}

	/**
	 * Developers page end point
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	public function developers():string
	{
		$model = new RateModel();

		$prefers = $model->supportedPrefers();
		sort($prefers);

		$data = [
			'currencies' => array_column($model->getDisplayCurrencies(), 'currency'),
			'prefers'    => array_map('strtoupper', $prefers),
		];

		return view('solid/developers', $data);
	}

	/**
	 * Privacy page endpoint
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	public function privacy():string
	{
		return view('solid/privacy');
	}

	/**
	 * Page testing endpoint
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	public function tester():string
	{
		$site          = new Rate();
		$site->url     = $this->request->getPostGet('site');
		$site->enabled = true;

		 //also prevents mail
		$site->status     = false;
		$site->site       = false;
		$site->javascript = filter_var(getenv('app.panther'), FILTER_VALIDATE_BOOL);
		$site->selector   = $this->request->getPostGet('css') ?? '*';

		$site->getHtmlContent();

		if (empty($site->site))
		{
			return 'Failed to scan site';
		}
		else
		{
			return $site->site;
		}
	}
}
