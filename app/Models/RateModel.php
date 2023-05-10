<?php

namespace App\Models;

use App\Entities\Rate;
use CodeIgniter\I18n\Time;
use CodeIgniter\Model;
use Exception;

/**
 * Model for Rates
 *
 * @author  Richard Muvirimi <richard@tyganeutronics.com>
 * @since   1.0.0
 * @version 1.0.0
 *
 * @method groupEnd()
 * @method groupStart()
 * @method distinct()
 */
class RateModel extends Model
{
    /**
     * Table for the model
     *
     * @var string
     */
    protected $table = 'zimrate';

    /**
     * Fields that can be saved to database
     *
     * @var string[]
     */
    protected $allowedFields = [
        'status',
        'enabled',
        'javascript',
        'name',
        'currency',
        'url',
        'selector',
        'rate',
        'last_checked',
        'last_updated_selector',
        'last_updated',
        'timezone',
    ];

    /**
     * Data return type
     *
     * @var string
     */
    protected $returnType = 'App\Entities\Rate';

    /**
     * Use timestamps for rows
     *
     * @var boolean
     */
    protected $useTimestamps = false;

    /**
     * Database date format
     *
     * @var string
     */
    protected $dateFormat = 'int';

    /**
     * Get all records
     *
     * @return  array
     * @version 1.0.0
     * @since   1.0.0
     */
    public function getAll(): array
    {
        $this->orderBy('url');
        return $this->findAll();
    }

    /**
     * Get rows matching provided filters
     *
     * @param string  $source   Source.
     * @param string  $currency Currency.
     * @param integer $date     Date.
     * @param string  $prefer   Prefer.
     * @param boolean $enabled  Enabled.
     *
     * @return  array
     * @throws  Exception
     * @since   1.0.0
     * @version 1.0.0
     */
	// phpcs:ignore Generic.Files.LineLength.TooLong
    public function getByFilter(string $source, string $currency, int $date, string $prefer, bool $enabled = false): array
    {
        $columns = [
            'currency',
            'rate',
            'last_checked',
            'last_updated',
            'name',
            'url',
        ];

        sort($columns);

        $this->select($columns);

        //source name
        if (strlen($source) !== 0) {
            $this->like('name', $source);
        }

        //currency name
        if (strlen($currency) !== 0) {
            $this->where('currency', $currency);
        }

        if ($date > 0) {
            $this->where('last_updated >', $date);
        }

        if ($enabled) {
            $this->where('enabled', 1);
        }

        $this->groupStart();
        $this->where('status', 1);

        $this->orWhere([
            'status'         => 0,
            'last_updated >' => Time::now()->subDays(7),
        ]);

        $this->groupEnd();

        $this->orderBy('currency', 'ASC');

        return $this->groupRates($prefer);
    }

    /**
     * Get list of supported prefers
     *
     * @return  array
     * @version 1.0.0
     * @since   1.0.0
     */
    public function supportedPrefers(): array
    {
        return [
            'min',
            'max',
            'mean',
            'median',
            'random',
            'mode',
        ];
    }

    /**
     * Apply aggregation
     *
     * @param string $prefer Prefer.
     *
     * @return  array
     * @version 1.0.0
     * @since   1.0.0
     */
    private function groupRates(string $prefer): array
    {
        $rates = $this->findAll();

        if (strlen($prefer) !== 0) {
            $_rates = [];

            //group by currency
            foreach ($rates as $rate) {
                $currency = $rate->currency;

                $_rates[$currency]['rate'][]         = $rate->rate;
                $_rates[$currency]['last_checked'][] = $rate->lastChecked;
                $_rates[$currency]['last_updated'][] = $rate->lastUpdated;
            }

            $rates = [];

            //compile groupings
            foreach ($_rates as $currency => $rate) {
                switch ($prefer) {
                    case 'max':
                        $rates[] = new Rate([
                            'currency'     => $currency,
                            'last_checked' => max($rate['last_checked']),
                            'last_updated' => min($rate['last_updated']),
                            'rate'         => max($rate['rate']),
                        ]);
                        break;
                    case 'min':
                        $rates[] = new Rate([
                            'currency'     => $currency,
                            'last_checked' => max($rate['last_checked']),
                            'last_updated' => min($rate['last_updated']),
                            'rate'         => min($rate['rate']),
                        ]);
                        break;
                    case 'mean':
                        $rates[] = new Rate([
                            'currency'     => $currency,
                            'last_checked' => max($rate['last_checked']),
                            'last_updated' => min($rate['last_updated']),
                            'rate'         => array_sum($rate['rate']) / count($rate['rate']),
                        ]);
                        break;
                    case 'median':
                        sort($rate['rate']);

                        $count = count($rate['rate']);

                        if ($count % 2 === 0) {
                            //even get central average

                            $lower = ($count / 2);
                            $upper = $lower + 1;

                            $_rate = ($rate['rate'][$upper - 1] + $rate['rate'][$lower - 1]) / 2;
                        } else {
                            //odd get central
                            $_rate = $rate['rate'][ceil($count / 2) - 1];
                        }

                        $rates[] = new Rate([
                            'currency'     => $currency,
                            'last_checked' => max($rate['last_checked']),
                            'last_updated' => min($rate['last_updated']),
                            'rate'         => $_rate,
                        ]);
                        break;
                    case 'mode':
                        $occurs = [];

                        foreach ($rate['rate'] as $_rate) {
                            $occurs[strval($_rate)] = ($occurs[strval($_rate)] ?? 0) + 1;
                        }

                        $_rate = floatval(array_search(max($occurs), $occurs));

                        $position = array_search($_rate, $rate['rate']);

                        $rates[] = new Rate([
                            'currency'     => $currency,
                            'last_checked' => $rate['last_checked'][$position],
                            'last_updated' => $rate['last_updated'][$position],
                            'rate'         => $_rate,
                        ]);
                        break;
                    case 'random':
                        $position = array_rand($rate['rate']);

                        $_rate = $rate['rate'][$position];

                        $rates[] = new Rate([
                            'currency'     => $currency,
                            'last_checked' => $rate['last_checked'][$position],
                            'last_updated' => $rate['last_updated'][$position],
                            'rate'         => $_rate,
                        ]);
                        break;
                }
            }
        }

        return $rates;
    }

    /**
     * Get list of all available currencies
     *
     * @return  array
     * @throws  Exception
     * @since   1.0.0
     * @version 1.0.0
     */
    public function getCurrencies(): array
    {
        $this->distinct();
        $this->select('currency');
        $this->where('enabled', 1);

        $this->groupStart();
        $this->where('status', 1);

        $this->orWhere([
            'status'         => 0,
            'last_updated >' => Time::now()->subDays(7),
        ]);

        $this->groupEnd();

        return $this->findAll();
    }

    /**
     * Get list of all available currencies
     *
     * @return  array
     * @throws  Exception
     * @since   1.0.0
     * @version 1.0.0
     */
    public function getDisplayCurrencies(): array
    {
        $this->select('currency');
        $this->selectAvg('rate', 'mean');
        $this->selectMax('rate', 'max');
        $this->selectMin('rate', 'min');

        $this->where('enabled', 1);

        $this->groupStart();
        $this->where('status', 1);

        $this->orWhere([
            'status'         => 0,
            'last_updated >' => Time::now()->subDays(7),
        ]);

        $this->groupEnd();

        $this->groupBy('currency');
        $this->orderBy('COUNT(DISTINCT url)', 'DESC');

        return $this->findAll();
    }
}
