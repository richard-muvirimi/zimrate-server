<?php

namespace App\Controllers;

use App\Entities\Rate;
use CodeIgniter\API\ResponseTrait;
use CodeIgniter\HTTP\IncomingRequest;

/**
 * Front Page Controller
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class Home extends BaseController
{

	use ResponseTrait;

	/**
	 * Home page endpoint
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	public function index():string
	{
		return view('dist/index');
	}

	/**
	 * Page testing endpoint
	 *
	 * @since   1.0.0
	 * @version 1.0.0
	 * @return  string
	 */
	public function tester():string
	{
		/**
		 * Incoming Request.
		 *
		 * @var IncomingRequest $request
		 */
		$request = $this->request;

		$site          = new Rate();
		$site->url     = $request->getPostGet('site');
		$site->enabled = true;

		 //also prevents mail
		$site->status     = false;
		$site->site       = false;
		$site->javascript = true;
		$site->selector   = $request->getPostGet('css') ?? '*';

		$site->getHtmlContent();

		if (empty($site->site))
		{
			return 'Failed to scan site';
		}
		else
		{
			return $site->site;
		}
	}
}
