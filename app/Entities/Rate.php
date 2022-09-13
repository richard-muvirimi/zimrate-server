<?php

namespace App\Entities;

use App\Models\RateModel;
use CodeIgniter\Entity\Entity;
use Config\Services;
use DateTime;
use Exception;
use PhpCss;
use voku\helper\HtmlDomParser;
use Symfony\Component\Panther\Client;
use PhpCss\Ast\Visitor\Xpath;

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
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	public function crawlSite():void
	{
		//if enabled and half an hour has passed since last check
		if (intval($this->enabled) === 1 && (abs(time() - $this->last_checked) > (MINUTE * 30) || intval($this->status) !== 1))
		{
			/**
			 * Get site html file and scan for required fields
			 */
			if (! $this->site)
			{
				$this->getHtmlContent();
			}

			if ($this->site)
			{
				$this->status = $this->parseHtml($this->site) === true ? 1 : 0;

				//last checked
				$this->last_checked = time();
			}
			else
			{
				$this->status = 0;
			}
		}
	}

	/**
	 * Parse given html for required values
	 *
	 * @param string $html Site Html
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  boolean
	 */
	private function parseHtml(string $html):bool
	{
		//get html dom
		$dom = HtmlDomParser::str_get_html($html);

		//rate
		$rate = $this->cleanRate($dom->findOneOrFalse($this->selector));
		if ($rate)
		{
			$this->rate = $rate;

			$date = $this->cleanDate($dom->findOneOrFalse($this->last_updated_selector)) ?: ($this->rate ? time() : 0);

			//date
			$this->last_updated = $this->fixDateOffset($date);
			return true;
		}
		else
		{
			return false;
		}
	}

	/**
	 * Fix date offset
	 *
	 * @param integer $date Date.
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  integer
	 */
	private function fixDateOffset(int $date):int
	{
		$timezone = $this->timezone;

		return $date - date_offset_get(date_create('now', timezone_open($timezone)));
	}

	/**
	 * Convert number to an int
	 *
	 * @param string|HtmlDomParser $value Rate.
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  float
	 */
	private function cleanRate($value):float
	{
		$amount = $this->clean($value);

		if (! is_numeric($amount))
		{
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
		static $max = 0, $min = 0, $model = new RateModel();

		try
		{
			if ($max === 0)
			{
				$model->db->reconnect();
				$max = array_column($model->getByFilter('', $this->currency, 0, 'MAX', true), 'rate');
			}

			if ($min === 0)
			{
				$model->db->reconnect();
				$min = array_column($model->getByFilter('', $this->currency, 0, 'MIN', true), 'rate');
			}
		}
		catch (Exception $e)
		{
		}finally{
			if ($min !== 0 && $max !== 0)
			{
				$amount = floatval($amount);

				if ($amount > ($max[0] * 1.3) || $amount < ($min[0] * 0.7))
				{
					$amount /= 100;

					if ($amount > ($max[0] * 1.3) || $amount < ($min[0] * 0.7))
					{
						$amount = 0;
					}
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
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  integer
	 */
	private function cleanDate($value):int
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
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	private function clean($value):string
	{
		while (is_a($value, 'HtmlDomParser'))
		{
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
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	public function getHtmlContent():void
	{
		if (intval($this->javascript) === 1)
		{
			if (filter_var(getenv('app.panther'), FILTER_VALIDATE_BOOL))
			{
				$this->getHtmlContentBrowser();
			}
			else
			{
				#skip

				$this->site = '';
			}
		}
		else
		{
			$this->getHtmlContentText();
		}
	}

	/**
	 * Parse a site using curl
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	public function getHtmlContentText():void
	{
		$client = Services::curlrequest();

		$headers = [
			'Accept'         => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Charset' => 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
			'Cache-Control'  => 'max-age=0',
		];

		$tries = 0;

		try
		{
			do
			{
				try
				{
					$response = $client->get($this->url, [
						'headers'    => $headers,
						'user_agent' => 'Zimrate/1.0',
						'verify'     => false,
						'timeout'    => MINUTE * 3,
					]);

					if ($response->getStatusCode() === 200)
					{
						$this->site = $response->getBody();

						break;
					}
				}
				catch (Exception $e)
				{
					//echo $e->getMessage();

					$this->site = '';
				} finally {
					$tries++;
				}
			}
			while ($tries < 5);

			if (empty($this->site))
			{
				throw new Exception('Failed to scan site');
			}
		}
		catch (Exception $e)
		{
			//failed to parse site

			if (filter_var(getenv('app.panther'), FILTER_VALIDATE_BOOL))
			{
				//try with panther

				$this->getHtmlContentBrowser();
			}
			else
			{
				if ($this->status)
				{
					//first time only
					$this->mail($e->getMessage());
				}
			}
		}
	}

	/**
	 * Parse a site using selenium
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	private function getHtmlContentBrowser():void
	{
		//$_SERVER["PANTHER_FIREFOX_BINARY"] = ROOTPATH . "drivers/firefox/firefox-bin";
		//$_SERVER["PANTHER_CHROME_BINARY"] = ROOTPATH . "drivers/chrome-linux/chrome";

		/**
		 * List of command line options for chromium
		 *
		 * @see https://peter.sh/experiments/chromium-command-line-switches/
		 */
		$args = [
			'--no-sandbox',
			'--disable-gpu',
			'--incognito',
			'--window-size=1920,1080',
			'start-maximized',
			'--user-agent=' . $this->getUserAgent(),
			'--headless',
		];

		$options = [
			'connection_timeout_in_ms' => MINUTE * 1000 * 3,
			'request_timeout_in_ms'    => MINUTE * 1000 * 3,
		];

		$tries = 0;

		try
		{
			$client = Client::createChromeClient(null, $args, $options);

			if (str_starts_with($this->selector, '//'))
			{
				$xpath = $this->selector;
			}
			else
			{
				$xpath = PhpCss::toXpath($this->selector, Xpath::OPTION_USE_CONTEXT_DOCUMENT);
			}

			$crawler = $client->request('GET', $this->url);

			do
			{
				try
				{
					$client->wait(MINUTE);
					$client->waitForVisibility($xpath, MINUTE * 3);

					$this->site = $crawler->html();

					break;
				}
				catch (Exception $e)
				{
					//echo $e->getMessage();

					$client->reload();
				} finally {
					$tries++;
				}
			}
			while ($tries < 5);
		}
		catch (Exception $e)
		{
			#driver does not exist

			if ($this->status)
			{
				//first time only
				$this->mail($e->getMessage());
			}
		} finally {
			if (isset($client) && is_object($client))
			{
				$client->quit();
			}
		}
	}

	/**
	 * Send mail when there is an error parsing a site
	 *
	 * @param string $message Message.
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	private function mail(string $message):void
	{
		$email = Services::email();

		$email->setSubject('Failed to parse site');
		$email->setMessage('Failed to parse ' . $this->url . ' with error message ' . $message);

		$email->send();
	}

	/**
	 * Get user agent string and cache if possible
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	private function getUserAgent():string
	{
		$agent = cache('user-agent');

		if (! $agent)
		{
			try
			{
				$client = Client::createChromeClient();
				$client->request('GET', 'chrome://version');

				$agent = $client->executeScript('return navigator.userAgent;');
			}
			catch (Exception $e)
			{
			} finally {
				if (isset($client) && is_object($client))
				{
					$client->quit();
				}
			}

			if (! $agent)
			{
				$agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36';
			}

			$agent = preg_replace('/headless/i', '', $agent);

			cache()->save('user-agent', $agent);
		}

		return $agent;
	}
}
