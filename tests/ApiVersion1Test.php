<?php declare(strict_types=1);

use App\Models\RateModel;
use Config\Services;
use PHPUnit\Framework\TestCase;

/**
 * Version 1 Api Test Class
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class ApiVersion1Test extends TestCase{

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

		$response = $client->get($_SERVER['app.baseURL'] . 'api/v1', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['prefer' => 'MEDIAN'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 1 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 1 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 1 is not an array');

		$model = new RateModel();
		$data  = json_encode($model->getByFilter('', '', 0, 'median', true));

		$this->assertArrayHasKey('USD', $response, 'The response from api version 1 does not contain the USD key');

		$this->assertJsonStringEqualsJsonString($data, json_encode($response['USD']), 'The response from api version 1 does not match the expected response');
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
		$currencies = $model->getDisplayCurrencies();

		$this->assertNotEmpty($currencies, 'There are no valid currencies in the system');

		$client = Services::curlrequest();

		$response = $client->get($_SERVER['app.baseURL'] . 'api/v1', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['currency' => $currencies[0]->currency],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 1 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 1 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 1 is not an array');

		$data = json_encode($model->getByFilter('', $currencies[0]->currency, 0, '', true));

		$this->assertArrayHasKey('USD', $response, 'The response from api version 1 does not contain the USD key');

		$this->assertJsonStringEqualsJsonString($data, json_encode($response['USD']), 'The response from api version 1 does not match the expected response');
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

		$response = $client->get($_SERVER['app.baseURL'] . 'api/v1', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['date' => time() - DAY],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 1 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 1 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 1 is not an array');

		$model = new RateModel();
		$data  = json_encode($model->getByFilter('', '', time() - DAY, '', true));

		$this->assertArrayHasKey('USD', $response, 'The response from api version 1 does not contain the USD key');

		$this->assertJsonStringEqualsJsonString($data, json_encode($response['USD']), 'The response from api version 1 does not match the expected response');
	}

	/**
	 * Test the information removed of the api
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return void
	 */
	public function testInfo():void
	{
		$client = Services::curlrequest();

		$response = $client->get($_SERVER['app.baseURL'] . 'api/v1', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['info' => 'false'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 1 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 1 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 1 is not an array');

		$this->assertArrayNotHasKey('info', $response, 'The response from api version 1 contains the info key');
	}

	/**
	 * Test the javascript callback of the api
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return void
	 */
	public function testCallback():void
	{
		$client = Services::curlrequest();

		$response = $client->get($_SERVER['app.baseURL'] . 'api/v1', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['callback' => 'test'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 1 was not 200');

		$this->assertStringContainsString('javascript', $response->getHeaderLine('Content-Type'), 'The response from api version 1 does not have a javascript content type');

		$this->assertMatchesRegularExpression('/test\(.*\);/', $response->getBody(), 'The response from api version 1 does not match expected javascript');
	}

	/**
	 * Test the cors support of the api
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return void
	 */
	public function testCors():void
	{
		$client = Services::curlrequest();

		$response = $client->get($_SERVER['app.baseURL'] . 'api/v1', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['cors' => 'true'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 1 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 1 is not valid json');

		$this->assertStringContainsString('*', $response->getHeaderLine('Access-Control-Allow-Origin'), 'The response from api version 1 does not have a cors header');
	}
}
