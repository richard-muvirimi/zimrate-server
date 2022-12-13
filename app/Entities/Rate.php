<?php

namespace App\Entities;

use App\Models\RateModel;
use CodeIgniter\Entity\Entity;
use Config\Services;
use DateTime;
use Exception;
use voku\helper\HtmlDomParser;
use function \current as array_first;

/**
 * Rate Entity
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class Rate extends Entity
{

	/**
	 * Property Casts
	 *
	 * @var array
	 */
	protected $casts = [
		'rate'         => 'float',
		'last_updated' => 'int',
		'last_checked' => 'int',
		'enabled'      => 'boolean',
		'status'       => 'boolean',
		'javascript'   => 'boolean',
	];

	/**
	 * Crawl given site for values
	 *
	 * @return  void
	 * @version 1.0.0
	 * @since   1.0.0
	 */
	public function crawlSite(): void
	{
		//if enabled and half an hour has passed since last check
		if (intval($this->enabled) === 1 && (abs(time() - $this->last_checked) > (MINUTE * 30) || intval($this->status) !== 1)) {
			/**
			 * Get site html file and scan for required fields
			 */
			if (!$this->site) {
				$this->getHtmlContent();
			}

			if ($this->site) {
				$this->status = $this->parseHtml($this->site) === true ? 1 : 0;

				//last checked
				$this->last_checked = time();
			} else {
				$this->status = 0;
			}
		}
	}

	/**
	 * Parse given html for required values
	 *
	 * @param string $html Site Html
	 *
	 * @return  boolean
	 * @version 1.0.0
	 * @since   1.0.0
	 */
	private function parseHtml(string $html): bool
	{
		//get html dom
		$dom = HtmlDomParser::str_get_html($html);

		//rate
		$rate = $this->cleanRate($dom->findOneOrFalse($this->selector));
		if ($rate) {
			$this->rate = $rate;

			$date = $this->cleanDate($dom->findOneOrFalse($this->last_updated_selector)) ?: ($this->rate ? time() : 0);

			//date
			$this->last_updated = $this->fixDateOffset($date);
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Fix date offset
	 *
	 * @param integer $date Date.
	 *
	 * @return  integer
	 * @version 1.0.0
	 * @since   1.0.0
	 */
	private function fixDateOffset(int $date): int
	{
		$timezone = $this->timezone;

		return $date - date_offset_get(date_create('now', timezone_open($timezone)));
	}

	/**
	 * Convert number to an int
	 *
	 * @param string|HtmlDomParser $value Rate.
	 *
	 * @return  float
	 * @version 1.0.0
	 * @since   1.0.0
	 */
	private function cleanRate($value): float
	{
		$amount = $this->clean($value);

		if (!is_numeric($amount)) {
			$words = explode(' ', $amount);

			//remove non numeric words
			$numbered = array_filter($words, function ($word) {
				preg_match('/[0-9]/', $word, $matches);

				return count($matches) > 0;
			});

			//join to allow removing non numeric characters
			$numbers = implode(' ', $numbered);

			//split by non numeric
			$figures = preg_split('/[^0-9,.]/', $numbers, -1, PREG_SPLIT_NO_EMPTY);

			$amount = count($figures) > 0 ? max($figures) : 0;
		}

		/**
		 * Normalize the value
		 *
		 * There could be better ways but the premise here is
		 *
		 * if value is not within a 30 percentile range then it is invalid
		 * Handles cases where it may be in cents
		 */
		$model = new RateModel();

		$model->db->reconnect();
		$max = array_column($model->getByFilter('', $this->currency, 0, 'MAX', true), 'rate');
		$min = array_column($model->getByFilter('', $this->currency, 0, 'MIN', true), 'rate');

		if ($min && $max)
		{
			$amount = floatval($amount);

			if ($amount > (array_first($max) * 1.3) || $amount < (array_first($min) * 0.7))
			{
				$amount /= 100;

				if ($amount > (array_first($max) * 1.3) || $amount < (array_first($min) * 0.7))
				{
					$amount = 0;
				}
			}
		}

		return $amount;
	}

	/**
	 * Convert date to a unix time stamp
	 *
	 * @param string|HtmlDomParser $value Date.
	 *
	 * @return  integer
	 * @version 1.0.0
	 * @since   1.0.0
	 */
	private function cleanDate($value): int
	{
		$rawDate = $this->clean($value);

		/**
		 * Bug: php_parse fails when there is no year but time right after month e.g => "19 January 11:22"
		 *
		 * Hack: wrap time in brackets or some other non alpha-numeric characters :)
		 */
		$rawDate = preg_replace('/[0-9]{1,2}:[0-9]{1,2}/', '($0)', $rawDate);

		/**
		 * Change back and forward strokes to dashes
		 */
		$rawDate = preg_replace('/[\\/]/', '-', $rawDate);

		/**
		 * Filter all text not related to dates
		 *
		 * Method: will only leave text (months) in the form jan or january
		 */
		$months = [];
		for ($i = 1; $i <= 12; $i++)
		{
			$months[] = strtolower(DateTime::createFromFormat('n', $i)->format('M'));
			$months[] = strtolower(DateTime::createFromFormat('n', $i)->format('F'));
		}

		$rawDate = preg_replace("/\b(?!(" . implode('|', $months) . '|(\w[0-9][a-z])))(\w*[a-z]+[^\s]*|(\w[^\D\d\w]))/i', '', $rawDate);

		/**
		 * Parse the date
		 */
		$date = date_parse($rawDate);

		/**
		 * Return parsed date substituting with defaults on none existent parts
		 */
		return mktime($date['hour'] ?: 0, $date['minute'] ?: 0, $date['second'] ?: 0, $date['month'] ?: date('n'), $date['day'] ?: date('j'), $date['year'] ?: date('Y'));
	}

	/**
	 * Remove all html and php tags from given string
	 *
	 * @param string|HtmlDomParser $value Value.
	 *
	 * @return  string
	 * @version 1.0.0
	 * @since   1.0.0
	 */
	private function clean($value): string
	{
		while (is_a($value, 'HtmlDomParser')) {
			$value = $value->innerhtml();
		}

		$value = utf8_decode($value);
		$value = strip_tags($value);
		$value = str_replace('&nbsp;', ' ', $value);
		$value = preg_replace('/\s+/', ' ', $value);
		$value = trim($value);

		// $value = strip_tags(trim(html_entity_decode($value), " \t\n\r\0\x0B\xC2\xA0"));

		return implode(' ', array_map(function ($word) {
			return trim($word, '-,');
		}, explode(' ', $value)));
	}

	/**
	 * Get content of given url
	 *
	 * @return  void
	 * @version 1.0.0
	 * @since   1.0.0
	 */
	public function getHtmlContent(): void
	{
		$client = Services::curlrequest();

		$data = [
			'url' => $this->url,
			'format' => 'html',
			'timeout' => getenv('scrappy.timeout'),
			"user_agent"=> $this->getUserAgent(),
			"css" => "body"
		];

		try {

			$response = $client->post(getenv('scrappy.server') . "/scrape", [
				'user_agent' => $this->getUserAgent(),
				'multipart' => $data,
				'verify' => false,
				"headers" => [
					"Authorization" => "Bearer " . getenv("scrappy.authKey")
				]
			]);

			if ($response->getStatusCode() === 200) {
				$content = $response->getBody();
				$content = json_decode($content, true);
				
				if ($content['data'] !== 'false') {
					$this->site = $content["data"];
				}
			}
		} catch (Exception $e) {
			// echo $e->getMessage();

			$this->site = '';
		}
	}

	/**
	 * Get user agent string and cache if possible
	 *
	 * @return  string
	 * @version 1.0.0
	 * @since   1.0.0
	 */
	private function getUserAgent(): string
	{
		$agent = cache('user-agent');

		if (!$agent) {
			$agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36';

			$agent = preg_replace('/headless/i', '', $agent);

			cache()->save('user-agent', $agent);
		}

		return $agent;
	}
}
