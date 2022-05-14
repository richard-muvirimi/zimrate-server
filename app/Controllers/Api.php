<?php

namespace App\Controllers;

use \App\Models\RateModel;
use CodeIgniter\API\ResponseTrait;
use CodeIgniter\HTTP\Exceptions\HTTPException;
use CodeIgniter\HTTP\Response;
use Config\Services;

/**
 * Api Handling Class
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class Api extends BaseController
{
	use ResponseTrait;

	/**
	 * Version 0 api endpoint
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  Response
	 */
	public function version0():Response
	{
		return $this->response->setJSON($this->getData());
	}

	/**
	 * Version 1 api endpoint
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  Response
	 */
	public function version1():Response
	{
		$response['USD'] = $this->getData();

		if ($this->request->getPostGet('info', FILTER_VALIDATE_BOOLEAN) ?: true)
		{
			$response['info'] = strip_tags(file_get_contents(FCPATH . 'public' . DIRECTORY_SEPARATOR . 'misc' . DIRECTORY_SEPARATOR . 'notice.txt'));
		}

		$json = json_encode($response);

		$callback = $this->request->getPostGet('callback');
		if ($callback)
		{
			$this->response->setContentType('application/javascript');

			return $this->respond($callback . '(' . $json . ');');
		}
		else
		{
			if ($this->request->getPostGet('cors', FILTER_VALIDATE_BOOLEAN))
			{
				$this->response->setHeader('Access-Control-Allow-Origin', '*');
			}

			return $this->response->setJSON($json);
		}
	}

	/**
	 * Retrieve data from the data base
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  array
	 */
	private function getData():array
	{
		$model = new RateModel();

		$this->logVisit();

		$source   = $this->normaliseName();
		$currency = $this->normaliseCurrency();
		$date     = $this->normaliseDate();
		$prefer   = $this->normalisePrefer();

		return $model->getByFilter($source, $currency, $date, $prefer, true);
	}

	/**
	 * Log visit to google analytics
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	private function logVisit():void
	{
		if (getenv('app.google.analytics'))
		{
			try
			{
				ob_start();

				$client = Services::curlrequest();

				$data = [
					// Version.
					'v'   => 1,
					// Tracking ID / Property ID.
					'tid' => getenv('app.google.analytics'),
					// Document hostname.
					'dh'  => base_url(),
					 // Anonymous Client ID.
					'cid' => $this->request->getIPAddress(),
					 // Hit Type.
					't'   => 'pageview',
					// Page.
					'dp'  => 'api',
				];

				$client->post('https://www.google-analytics.com/collect', [
					'user_agent'  => $this->request->getUserAgent()->getAgentString() ?: 'Zimrate/1.0',
					'form_params' => $data,
					'verify'      => false,
				]);
			}
			catch (HTTPException $e)
			{
			}finally{
				ob_clean();
			}
		}
	}

	/**
	 * Normalise search term
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	private function normaliseName():string
	{
		//if source fails try name
		$name = $this->request->getPostGet('source') ?: $this->request->getPostGet('name');

		//allow only alpha numeric text
		return preg_match('/^[a-zA-Z0-9 ]+$/', $name) === 1 ? $name : '';
	}

	/**
	 * Normalise currency
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	private function normaliseCurrency():string
	{
		$model = new RateModel();

		$currency = strtoupper($this->request->getPostGet('currency'));

		$currencies = $model->getCurrencies();

		return in_array($currency, array_column($currencies, 'currency')) ? $currency : '';
	}

	/**
	 * Normalise given date
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  integer
	 */
	private function normaliseDate():int
	{
		$date = $this->request->getPostGet('date', FILTER_VALIDATE_INT);
		if (! $date)
		{
			$date = 0;
		}

		return $date;
	}

	/**
	 * Normalise preferred return value
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	private function normalisePrefer():string
	{
		$model = new RateModel();

		$prefer = strtolower($this->request->getPostGet('prefer'));

		//value to get
		if (! in_array($prefer, $model->supportedPrefers()))
		{
			$prefer = '';
		}

		return $prefer;
	}
}
