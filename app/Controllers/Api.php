<?php

namespace App\Controllers;

use App\Libraries\SearchType;
use \App\Models\RateModel;
use CodeIgniter\API\ResponseTrait;
use CodeIgniter\HTTP\Exceptions\HTTPException;
use CodeIgniter\HTTP\Response;
use Config\Services;
use Exception;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use GraphQL\GraphQL;
use GraphQL\Type\Definition\EnumType;
use GraphQL\Type\Schema;

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
		return $this->response->setJSON($this->getData('api'));
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
		helper('array');

		$response['USD'] = $this->getData('api/v1');

		$info = $this->request->getPostGet('info') ?: true;
		if (filter_var($info, FILTER_VALIDATE_BOOL))
		{
			$response['info'] = dot_array_search('data.info', $this->resolveData('{info : info }'));
		}

		return $this->prepareResponse($response);
	}

	/**
	 * Graphql version of the api
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return Response
	 */
	public function graphql():Response
	{
		$this->logVisit('api/graphql');

		$input     = $this->request->getJSON(true);
		$query     = $input['query'] ?? '{info : info}';
		$variables = isset($input['variables']) ? $input['variables'] : null;

		$response = $this->resolveData($query, $variables);

		return $this->prepareResponse($response);
	}

	/**
	 * Prepare response
	 *
	 * @param array $response Response.
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return Response
	 */
	private function prepareResponse(array $response):Response
	{
		$callback = $this->request->getPostGet('callback');
		if ($callback)
		{
			$this->response->setContentType('text/javascript; charset=UTF-8');

			return $this->respond($callback . '(' . json_encode($response) . ');');
		}
		else
		{
			$cors = $this->request->getPostGet('cors');
			if (filter_var($cors, FILTER_VALIDATE_BOOL))
			{
				$this->response->setHeader('Access-Control-Allow-Origin', '*');
			}

			return $this->response->setJSON($response);
		}
	}

	/**
	 * Resolve request using graphql
	 *
	 * @param string $query     Optional Query Data.
	 * @param array  $variables Variables.
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return array
	 */
	private function resolveData(string $query = '', array $variables = null):array
	{
		$rateType = new ObjectType([
			'name'   => 'Rate',
			'fields' => [
				'currency'     => [
					'type'    => Type::string(),
					'resolve' => fn ($rate): string => $rate->currency ?? '',
				],
				'last_checked' => [
					'type'    => Type::int(),
					'resolve' => fn ($rate): int => $rate->last_checked ?? 0,
				],
				'last_updated' => [
					'type'    => Type::int(),
					'resolve' => fn ($rate):int =>$rate->last_updated ?? 0,
				],
				'name'         => [
					'type'    => Type::string(),
					'resolve' => fn ($rate): string => $rate->name ?? '',
				],
				'rate'         => [
					'type'    => Type::float(),
					'resolve' => fn ($rate): float => $rate->rate ?? 0,
				],
				'url'          => [
					'type'    => Type::string(),
					'resolve' => fn ($rate): string => $rate->url ?? '',
				],
			],
		]);

		$model = new RateModel();

		$currencies   = array_column($model->getDisplayCurrencies(), 'currency');
		$currencyType = new EnumType([
			'name'   => 'Currency',
			'values' => array_combine(array_map('strtoupper', $currencies), array_map(fn($prefer):array => ['value' => $prefer], $currencies) ),
		]);

		$aggregates = $model->supportedPrefers();
		$preferType = new EnumType([
			'name'   => 'Prefer',
			'values' => array_combine(array_map('strtoupper', $aggregates), array_map(fn($prefer):array => ['value' => $prefer], $aggregates) ),
		]);

		$queryType = new ObjectType([
			'name'   => 'Query',
			'fields' => [
				'rate' => [
					'type'    => Type::listOf($rateType),
					'args'    => [
						'search'   => [
							'type'         => new SearchType(),
							'defaultValue' => '',
						],
						'date'     => [
							'type'         => Type::int(),
							'defaultValue' => 0,
						],
						'currency' => [
							'type'         => $currencyType,
							'defaultValue' => '',
						],
						'prefer'   => [
							'type'         => $preferType,
							'defaultValue' => '',
						],
					],
					'resolve' => fn ($queryType, array $args):array => $model->getByFilter($args['search'], $args['currency'], $args['date'], $args['prefer'], true),
				],
				'info' => [
					'type'    => Type::string(),
					'resolve' => fn ():string=> strip_tags(file_get_contents(FCPATH . 'public' . DIRECTORY_SEPARATOR . 'misc' . DIRECTORY_SEPARATOR . 'notice.txt')),
				],
			],
		]);

		$schema = new Schema([
			'query' => $queryType,
		]);

		try
		{
			$result   = GraphQL::executeQuery($schema, $query, null, null, $variables);
			$response = $result->toArray();
		}
		catch (Exception $e)
		{
			$response = [
				'errors' => [
					[
						'message' => $e->getMessage(),
					],
				],
			];
		}

		return $response;
	}

	/**
	 * Retrieve data from the data base
	 *
	 * @param string $page Page name.
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  array
	 */
	private function getData(string $page):array
	{
		helper('array');

		$this->logVisit($page);

		$params = array_filter( [
			'search'   => $this->normaliseName(),
			'currency' => $this->normaliseCurrency(),
			'date'     => $this->normaliseDate(),
			'prefer'   => $this->normalisePrefer(),
		]);

		$params = array_map(function ($value, $key) {
			return $key . ' : ' . $value;
		}, $params, array_keys($params));

		$params = empty($params) ? '' : '(' . implode(', ', $params ) . ')';

		$query = '{query : rate' . $params . ' { currency, last_checked, last_updated, name, rate, url }}';

		return array_map('array_filter', dot_array_search( 'data.query', $this->resolveData($query)));
	}

	/**
	 * Log visit to google analytics
	 *
	 * @param string $page Page name.
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	private function logVisit(string $page):void
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
					'dp'  => $page,
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
		//search for rate
		return $this->request->getPostGet('search') ?: $this->request->getPostGet('source') ?: $this->request->getPostGet('name') ?: '';
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
		$date = $this->request->getPostGet('date') ?: 0;
		if (! is_numeric( $date))
		{
			$date = strtotime($date);
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

		return strtoupper($prefer);
	}
}
