<?php

namespace App\Controllers;

use function command as execute;

/**
 * Cronjob Controller
 *
 * @author  Richard Muvirimi <richard@tyganeutronics.com>
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
    public function index(): void
    {
        set_time_limit(0);
        ignore_user_abort(true);

        execute('crawl');
    }
}
