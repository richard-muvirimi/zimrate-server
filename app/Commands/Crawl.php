<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use \App\Models\RateModel;
use CodeIgniter\Database\Exceptions\DataException;

/**
 * Crawl command class
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class Crawl extends BaseCommand
{
	/**
	 * The Command's Group
	 *
	 * @var string
	 */
	protected $group = 'CodeIgniter';

	/**
	 * The Command's Name
	 *
	 * @var string
	 */
	protected $name = 'crawl';

	/**
	 * The Command's Description
	 *
	 * @var string
	 */
	protected $description = 'Crawl sites';

	/**
	 * The Command's Usage
	 *
	 * @var string
	 */
	protected $usage = 'crawl [arguments] [options]';

	/**
	 * The Command's Arguments
	 *
	 * @var array
	 */
	protected $arguments = [];

	/**
	 * The Command's Options
	 *
	 * @var array
	 */
	protected $options = [];

	/**
	 * Actually execute a command.
	 *
	 * @param array $params Parameters.
	 *
	 * @return void
	 */
	public function run(array $params):void
	{
		$model = new RateModel();

		if (! filter_var(getenv('app.panther'), FILTER_VALIDATE_BOOL))
		{
			$model->where('javascript', 0);
		}

		$sites = $model->getAll();

		$cache = [];

		$total = count($sites);

		for ($i = 0; $i < $total; $i++)
		{
			$site = $sites[$i];

			CLI::showProgress($i, $total - 1);
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

		CLI::showProgress(false);
		CLI::print(sprintf('Scanned %d sites', $total));
	}
}