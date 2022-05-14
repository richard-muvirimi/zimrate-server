<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * Model for Rates
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 *
 * phpcs:disable Squiz.Commenting.VariableComment.Missing
 */
class RateModel extends Model
{
	protected $table         = 'zimrate';
	protected $allowedFields = [
		'status',
		'enabled',
		'javascript',
		'name',
		'currency',
		'url',
		'selector',
		'rate',
		'last_checked',
		'last_updated_selector',
		'last_updated',
		'timezone',
	];
	protected $returnType    = 'App\Entities\Rate';
	protected $useTimestamps = false;
	protected $dateFormat    = 'int';

	/**
	 * Get all records
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  array
	 */
	public function getAll():array
	{
		$this->orderBy('url');
		return $this->findAll();
	}

	/**
	 * Get rows matching provided filters
	 *
	 * @param string  $source   Source.
	 * @param string  $currency Currency.
	 * @param integer $date     Date.
	 * @param string  $prefer   Prefer.
	 * @param boolean $enabled  Enabled.
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  array
	 */
	public function getByFilter(string $source, string $currency, int $date, string $prefer, bool $enabled = false):array
	{
		$columns = [
			'currency',
			'rate',
			'last_checked',
			'last_updated',
		];

		if (in_array($prefer, ['min', 'max', 'mean']))
		{
			$this->groupBy('currency');
		}
		else
		{
			$columns[] = 'name';
			$columns[] = 'url';
		}

		sort($columns);

		$this->select($columns);

		//source name
		if (strlen($source) !== 0)
		{
			$this->like('name', $source);
		}

		//currency name
		if (strlen($currency) !== 0)
		{
			$this->where('currency', $currency);
		}

		//
		if ($date !== 0)
		{
			$this->where('last_updated >', $date);
		}

		if ($enabled)
		{
			$this->where('enabled', 1);
		}

		$this->groupStart();
		$this->where('status', 1);

		$this->orWhere([
			'status'         => 0,
			'last_updated >' => time() - WEEK,
		]);

		$this->groupEnd();

		$this->orderBy('currency', 'ASC');

		$rates = [];

		switch ($prefer) {
			case 'max':
				$this->selectMax('rate');
				$rates = $this->findAll();
				break;
			case 'min':
				$this->selectMin('rate');
				$rates = $this->findAll();
				break;
			case 'mean':
				$this->selectAvg('rate');
				$rates = $this->findAll();
				break;
			default:
				$rates = $this->groupRates($prefer);
		}

		return   $rates;
	}

	/**
	 * Get list of supported prefers
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  array
	 */
	public function supportedPrefers():array
	{
		return [
			'min',
			'max',
			'mean',
			'median',
			'random',
			'mode',
		];
	}

	/**
	 * Apply addtional grouping on rates not natively supported by the database
	 *
	 * @param string $prefer Prefer.
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  array
	 */
	private function groupRates(string $prefer):array
	{
		$allRates = $this->findAll();

		$_rates = [];

		//group by currency
		foreach ($allRates as $rate)
		{
			$currency = $rate->currency;

			$_rates[$currency]['rate'][]         = $rate->rate;
			$_rates[$currency]['last_checked'][] = $rate->last_checked;
			$_rates[$currency]['last_updated'][] = $rate->last_updated;
		}

		$rates = [];

		//compile groupings
		foreach ($_rates as $currency => $rate)
		{
			switch ($prefer) {
				case 'median':
					sort($rate['rate']);

					$count = count($rate['rate']);

					if ($count % 2 === 0)
					{
						//even get central average

						$lower = ($count / 2);
						$upper = $lower + 1;

						$_rate = ($rate['rate'][$upper - 1] + $rate['rate'][$lower - 1]) / 2;
					}
					else
					{
						//odd get central
						$_rate = $rate['rate'][ceil($count / 2) - 1];
					}

					$rates[] = [
						'currency'     => $currency,
						'last_checked' => max($rate['last_checked']),
						'last_updated' => min($rate['last_updated']),
						'rate'         => $_rate,
					];
					break;
				case 'mode':
					$occurs = [];

					foreach ($rate['rate'] as $_rate)
					{
						$occurs[strval($_rate)] = (isset($occurs[$_rate]) ? $occurs[$_rate] : 0) + 1;
					}

					$_rate = floatval(array_search(max($occurs), $occurs));

					$position = array_search($_rate, $rate['rate']);

					$rates[] = [
						'currency'     => $currency,
						'last_checked' => $rate['last_checked'][$position],
						'last_updated' => $rate['last_updated'][$position],
						'rate'         => $_rate,
					];
					break;
				case 'random':
					$position = array_rand($rate['rate']);

					$_rate = $rate['rate'][$position];

					$rates[] = [
						'currency'     => $currency,
						'last_checked' => $rate['last_checked'][$position],
						'last_updated' => $rate['last_updated'][$position],
						'rate'         => $_rate,
					];
					break;
				default:
					//all
					$rates = $allRates;
					break;
			}
		}

		return $rates;
	}

	/**
	 * Get list of all available currencies
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  array
	 */
	public function getCurrencies():array
	{
		$this->distinct();
		$this->select('currency');
		$this->where('enabled', 1);

		$this->groupStart();
		$this->where('status', 1);

		$this->orWhere([
			'status'         => 0,
			'last_updated >' => time() - WEEK,
		]);

		$this->groupEnd();

		return $this->findAll();
	}

	/**
	 * Get last modified date
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	public function getLastChecked():string
	{
		$this->select('last_checked');
		$this->limit(1);
		$this->orderBy('last_checked', 'DESC');

		return $this->first()->{'last_checked'};
	}

	/**
	 * Get list of all available currencies
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  array
	 */
	public function getDisplayCurrencies():array
	{
		$this->select('currency');
		$this->selectAvg('rate', 'mean');
		$this->selectMax('rate', 'max');
		$this->selectMin('rate', 'min');
		$this->select('last_checked');

		$this->where('enabled', 1);

		$this->groupStart();
		$this->where('status', 1);

		$this->orWhere([
			'status'         => 0,
			'last_updated >' => time() - WEEK,
		]);

		$this->groupEnd();

		$this->groupBy('currency');
		$this->orderBy('COUNT(DISTINCT url)', 'DESC');

		return $this->findAll();
	}

	/**
	 * Get the sources of currency
	 *
	 * @param string $currency Currency.
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  array
	 */
	public function getCurrencySources(string $currency):array
	{
		$this->distinct();
		$this->select('url');

		$this->where('currency', $currency);
		$this->where('enabled', 1);

		$this->groupStart();
		$this->where('status', 1);

		$this->orWhere([
			'status'         => 0,
			'last_updated >' => time() - WEEK,
		]);

		$this->groupEnd();

		return $this->findAll();
	}
}
