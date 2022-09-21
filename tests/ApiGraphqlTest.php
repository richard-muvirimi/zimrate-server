<?php declare(strict_types=1);

use App\Models\RateModel;
use Config\Services;
use PHPUnit\Framework\TestCase;
use function current as array_first;

/**
 * Graphql Api Test Class
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class ApiGraphqlTest extends TestCase{

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

		$response = $client->post($_SERVER['app.baseURL'] . 'api/graphql', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'json'       => ['query' => '{USD : rate( prefer : MEDIAN) { currency last_checked last_updated rate }}'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api graphql was not 200');
		$this->assertJson($response->getBody(), 'The response from api graphql is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api graphql is not an array');

		$this->assertArrayHasKey('data', $response, 'The response from api graphql does not contain the data key');

		$response = $response['data'];

		$model = new RateModel();

		$data  = json_encode($model->getByFilter('', '', 0, 'median', true));

		$this->assertArrayHasKey('USD', $response, 'The response from api graphql does not contain the USD key');

		$this->assertJsonStringEqualsJsonString($data, json_encode($response['USD']), 'The response from api graphql does not match the expected response');
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
		$model = new RateModel();

		$currencies = $model->getDisplayCurrencies();

		$this->assertNotEmpty($currencies, 'There are no valid currencies in the system');

		$client = Services::curlrequest();

		$response = $client->post($_SERVER['app.baseURL'] . 'api/graphql', [
			'user_agent' => 'Zimrate/1.0',
			'verify'     => false,
			'json'       => ['query' => '{USD : rate(currency : ' . strtoupper(array_first($currencies)->currency) . ' ) {currency last_checked last_updated name rate url}}'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api graphql was not 200');
		$this->assertJson($response->getBody(), 'The response from api graphql is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api graphql is not an array');

		$this->assertArrayHasKey('data', $response, 'The response from api graphql does not contain the data key');

		$response = $response['data'];

		$data = json_encode($model->getByFilter('', array_first($currencies)->currency, 0, '', true));

		$this->assertArrayHasKey('USD', $response, 'The response from api graphql does not contain the USD key');

		$this->assertJsonStringEqualsJsonString($data, json_encode($response['USD']), 'The response from api graphql does not match the expected response');
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

    $date = time() - DAY;

		$response = $client->post($_SERVER['app.baseURL'] . 'api/graphql', [
			'user_agent' => 'Zimrate / 1.0',
			'verify'     => false,
			'json'       => ['query' => '{USD : rate(date : ' . $date . ' ) {currency last_checked last_updated name rate url }}'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api graphql was not 200');
		$this->assertJson($response->getBody(), 'The response from api graphql is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api graphql is not an array');

		$this->assertArrayHasKey('data', $response, 'The response from api graphql does not contain the data key');

		$response = $response['data'];

		$model = new RateModel();

		$data  = json_encode($model->getByFilter('', '', $date, '', true));

		$this->assertArrayHasKey('USD', $response, 'The response from api graphql does not contain the USD key');

		$this->assertJsonStringEqualsJsonString($data, json_encode($response['USD']), 'The response from api graphql does not match the expected response');
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

		$response = $client->post($_SERVER['app.baseURL'] . 'api/graphql', [
			'user_agent' => 'Zimrate / 1.0',
			'verify'     => false,
			'json'       => ['query' => '{USD : rate { currency last_checked last_updated name rate url }, info: info}'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api graphql was not 200');
		$this->assertJson($response->getBody(), 'The response from api graphql is not valid json');

		$response = json_decode($response->getBody(), true);

		$this->assertIsArray($response, 'The response from api graphql is not an array');

		$this->assertArrayHasKey('data', $response, 'The response from api graphql does not contain the data key');

		$response = $response['data'];

		$this->assertArrayHasKey('info', $response, 'The response from api graphql does not contain the info key');
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

		$response = $client->post($_SERVER['app.baseURL'] . 'api/graphql', [
			'user_agent' => 'Zimrate / 1.0',
			'verify'     => false,
			'json'       => ['query' => '{USD : rate(callback : "test") { currency last_checked last_updated name rate url }, info: info}'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api graphql was not 200');

		$this->assertStringContainsString('javascript', $response->getHeaderLine('Content-Type'), 'The response from api graphql does not have a javascript content type');

		$this->assertMatchesRegularExpression('/test\(.*\);/', $response->getBody(), 'The response from api graphql does not match expected javascript');
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

		$response = $client->post($_SERVER['app.baseURL'] . 'api/graphql', [
			'user_agent' => 'Zimrate / 1.0',
			'verify'     => false,
			'json'       => ['query' => '{USD : rate(cors : true) { currency last_checked last_updated name rate url }, info: info}'],
		]);

		$this->assertEquals (200, $response->getStatusCode(), 'The response code from api graphql was not 200');
		$this->assertJson($response->getBody(), 'The response from api graphql is not valid json');

		$this->assertStringContainsString('*', $response->getHeaderLine('Access-Control-Allow-Origin'), 'The response from api graphql does not have a cors header');
	}
}
