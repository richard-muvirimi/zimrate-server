<?php declare(strict_types=1);

use App\Entities\Rate;
use App\Models\RateModel;
use CodeIgniter\I18n\Time;
use Config\Services;
use PHPUnit\Framework\TestCase;
use function current as array_first;

/**
 * Version 0 Api Test Class
 *
 * @author  Richard Muvirimi <richard@tyganeutronics.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class ApiVersion0Test extends TestCase{

	/**
	 * Test no params of the api
	 *
	 * @return  void
	 * @throws  Exception
	 * @version 1.0.0
	 *
	 * @author Richard Muvirimi <richard@tyganeutronics.com>
	 * @since  1.0.0
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

		$data = $model->getByFilter('', '', 0, '', true);

		$data = json_encode(array_map(function (Rate $item) {
			return $item->jsonSerialize();
		}, $data));

		$this->assertJsonStringEqualsJsonString($data, json_encode($response), 'The response from api version 0 does not match the expected response');
	}

	/**
	 * Test the prefer of the api
	 *
	 * @return  void
	 * @throws  Exception
	 * @version 1.0.0
	 *
	 * @author Richard Muvirimi <richard@tyganeutronics.com>
	 * @since  1.0.0
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

		$data = $model->getByFilter('', '', 0, 'median', true);

		$data = json_encode(array_map(function (Rate $item) {
			return $item->jsonSerialize();
		}, $data));

		$this->assertJsonStringEqualsJsonString($data, json_encode($response), 'The response from api version 0 does not match the expected response');
	}

	/**
	 * Test the currency of the api
	 *
	 * @return  void
	 * @throws  Exception
	 * @version 1.0.0
	 *
	 * @author Richard Muvirimi <richard@tyganeutronics.com>
	 * @since  1.0.0
	 */
	public function testCurrency():void
	{
		$model = new RateModel();

		$currencies = $model->getCurrencies();

		$this->assertNotEmpty($currencies, 'There are no valid currencies in the system');

		$client = Services::curlrequest();

		$response = $client->get($_SERVER['app.baseURL'] . 'api', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => ['currency' => array_first($currencies)->currency],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 0 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 0 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 0 is not an array');

		$data = $model->getByFilter('', array_first($currencies)->currency, 0, '', true);

		$data = json_encode(array_map(function (Rate $item) {
			return $item->jsonSerialize();
		}, $data));

		$this->assertJsonStringEqualsJsonString($data, json_encode($response), 'The response from api version 0 does not match the expected response');
	}

	/**
	 * Test the date of the api
	 *
	 * @return  void
	 * @throws  Exception
	 * @version 1.0.0
	 *
	 * @author Richard Muvirimi <richard@tyganeutronics.com>
	 * @since  1.0.0
	 */
	public function testDate():void
	{
		$client = Services::curlrequest();

		$date = Time::now()->subDays(1)->getTimestamp();

		$response = $client->get($_SERVER['app.baseURL'] . 'api', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'query'      => compact('date'),
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api version 0 was not 200');
		$this->assertJson($response->getBody(), 'The response from api version 0 is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api version 0 is not an array');

		$model = new RateModel();

		$data = $model->getByFilter('', '', $date, '', true);

		$data = json_encode(array_map(function (Rate $item) {
			return $item->jsonSerialize();
		}, $data));

		$this->assertJsonStringEqualsJsonString($data, json_encode($response), 'The response from api version 0 does not match the expected response');
	}
}
