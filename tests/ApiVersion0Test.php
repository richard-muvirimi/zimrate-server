<?php declare(strict_types=1);

use App\Models\RateModel;
use Config\Services;
use PHPUnit\Framework\TestCase;

/**
 * Version 0 Api Test Class
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class ApiVersion0Test extends TestCase{

	/**
	 * Test no params of the api
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return void
	 */
	public function testApi():void
	{
		$client = Services::curlrequest();

		$response = $client->get($_SERVER['app.baseURL'] . 'api', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 0 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 0 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 0 is not an array');

		$model = new RateModel();
		$data  = json_encode($model->getByFilter('', '', 0, '', true));

		$this->assertJsonStringEqualsJsonString($data, json_encode($response), 'The response from api version 0 does not match the expected response');
	}

	/**
	 * Test the prefer of the api
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return void
	 */
	public function testPrefer():void
	{
		$client = Services::curlrequest();

		$response = $client->get($_SERVER['app.baseURL'] . 'api', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['prefer' => 'MEDIAN'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 0 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 0 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 0 is not an array');

		$model = new RateModel();
		$data  = json_encode($model->getByFilter('', '', 0, 'median', true));

		$this->assertJsonStringEqualsJsonString($data, json_encode($response), 'The response from api version 0 does not match the expected response');
	}

	/**
	 * Test the currency of the api
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return void
	 */
	public function testCurrency():void
	{
		$model      = new RateModel();
		$currencies = $model->getCurrencies();

		$this->assertNotEmpty($currencies, 'There are no valid currencies in the system');

		$client = Services::curlrequest();

		$response = $client->get($_SERVER['app.baseURL'] . 'api', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['currency' => $currencies[0]->currency],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 0 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 0 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 0 is not an array');

		$data = json_encode($model->getByFilter('', $currencies[0]->currency, 0, '', true));

		$this->assertJsonStringEqualsJsonString($data, json_encode($response), 'The response from api version 0 does not match the expected response');
	}

	/**
	 * Test the date of the api
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return void
	 */
	public function testDate():void
	{
		$client = Services::curlrequest();

		$response = $client->get($_SERVER['app.baseURL'] . 'api', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['date' => time() - DAY],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 0 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 0 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 0 is not an array');

		$model = new RateModel();
		$data  = json_encode($model->getByFilter('', '', time() - DAY, '', true));

		$this->assertJsonStringEqualsJsonString($data, json_encode($response), 'The response from api version 0 does not match the expected response');
	}
}
