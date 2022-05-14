<?php

namespace App\Controllers;

use \App\Models\RateModel;
use CodeIgniter\Database\Exceptions\DataException;

/**
 * Cronjob Controller
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class Crawl extends BaseController
{

	/**
	 * Initiate site crawling to get rates
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  void
	 */
	public function index():void
	{
		$model = new RateModel();

		if (! filter_var(getenv('app.panther'), FILTER_VALIDATE_BOOL))
		{
			$model->where('javascript', 0);
		}

		$sites = $model->getAll();

		$cache = [];

		foreach ($sites as $site)
		{
			if (intval($site->enabled) === 1)
			{
				//set cache if same site
				$site->site = isset($cache[$site->url]) ? $cache[$site->url] : '';

				$site->crawlSite();

				//set cache
				$cache[$site->url] = $site->site;

				try
				{
					$model->save($site);
				}
				catch (DataException $e)
				{
				}
			}
		}
	}
}
