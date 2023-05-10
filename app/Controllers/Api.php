<?php

/**
 * Api Controller
 */

namespace App\Controllers;

use App\Entities\Rate;
use App\Libraries\SearchType;
use App\Models\RateModel;
use CodeIgniter\API\ResponseTrait;
use CodeIgniter\HTTP\ResponseInterface;
use Exception;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use GraphQL\GraphQL;
use GraphQL\Type\Definition\EnumType;
use GraphQL\Type\Schema;

/**
 * Api Handling Class
 *
 * @author  Richard Muvirimi <richard@tyganeutronics.com>
 * @since   1.0.0
 * @version 1.0.0
 */
class Api extends BaseController
{
    use ResponseTrait;

    /**
     * Version 0 api endpoint
     *
     * @return  ResponseInterface
     * @throws  Exception
     * @since   1.0.0
     * @version 1.0.0
     */
    public function version0(): ResponseInterface
    {
        return $this->response->setJSON($this->getData('api'));
    }

    /**
     * Version 1 api endpoint
     *
     * @return  ResponseInterface
     * @throws  Exception
     * @since   1.0.0
     * @version 1.0.0
     */
    public function version1(): ResponseInterface
    {
        helper('array');

        $response['USD'] = $this->getData('api/v1');

        $info = $this->request->getPostGet('info') ?: true;
        if (filter_var($info, FILTER_VALIDATE_BOOL)) {
            $response['info'] = dot_array_search('data.info', $this->resolveData('{info : info }'));
        }

        return $this->prepareResponse($response);
    }

    /**
     * Graphql version of the api
     *
     * @return  ResponseInterface
     * @throws  Exception
     * @version 1.0.0
     *
     * @author Richard Muvirimi <richard@tyganeutronics.com>
     * @since  1.0.0
     */
    public function graphql(): ResponseInterface
    {
        helper(['logger']);

        log_activity('"api_request"');

        $input     = $this->request->getJSON(true);
        $query     = $input['query'] ?? '{info : info}';
        $variables = $input['variables'] ?? null;

        $response = $this->resolveData($query, $variables);

        return $this->prepareResponse($response);
    }

    /**
     * Prepare response
     *
     * @param array $response Response.
     *
     * @return  ResponseInterface
     * @since   1.0.0
     * @version 1.0.0
     *
     * @author Richard Muvirimi <richard@tyganeutronics.com>
     */
    private function prepareResponse(array $response): ResponseInterface
    {
        if ($this->response->hasHeader('X-Callback')) {
            $this->response->setContentType('application/javascript');

            return $this->respond($this->response->getHeaderLine('X-Callback') . '(' . json_encode($response) . ');');
        }

        return $this->response->setJSON($response);
    }

    /**
     * Resolve request using graphql
     *
     * @param string     $query     Optional Query Data.
     * @param array|null $variables Variables.
     *
     * @return  array
     * @throws  Exception
     * @version 1.0.0
     *
     * @author Richard Muvirimi <richard@tyganeutronics.com>
     * @since  1.0.0
     */
    private function resolveData(string $query = '', array $variables = null): array
    {
        $rateType = new ObjectType([
            'name'   => 'Rate',
            'fields' => [
                'currency'     => [
                    'type'    => Type::string(),
                    'resolve' => fn (Rate $rate): string => $rate->currency ?? '',
                ],
                'last_checked' => [
                    'type'    => Type::int(),
                    'resolve' => fn (Rate $rate): int => $rate->lastChecked->getTimestamp(),
                ],
                'last_updated' => [
                    'type'    => Type::int(),
                    'resolve' => fn (Rate $rate): int => $rate->lastUpdated->getTimeStamp(),
                ],
                'name'         => [
                    'type'    => Type::string(),
                    'resolve' => fn (Rate $rate): string => $rate->name ?? '',
                ],
                'rate'         => [
                    'type'    => Type::float(),
                    'resolve' => fn (Rate $rate): float => $rate->rate ?? 0,
                ],
                'url'          => [
                    'type'    => Type::string(),
                    'resolve' => fn (Rate $rate): string => $rate->url ?? '',
                ],
            ],
        ]);

        $model = new RateModel();

        $currencies   = array_column($model->getDisplayCurrencies(), 'currency');
        $currencyType = new EnumType([
            'name'   => 'Currency',
            'values' => array_combine(array_map('strtoupper', $currencies), array_map(
                function ($prefer): array {
                    return ['value' => $prefer];
                },
                $currencies
            )),
        ]);

        $aggregates = $model->supportedPrefers();
        $preferType = new EnumType([
            'name'   => 'Prefer',
            'values' => array_combine(array_map('strtoupper', $aggregates), array_map(function ($prefer): array {
                return ['value' => $prefer];
            }, $aggregates)),
        ]);

        $queryType = new ObjectType([
            'name'   => 'Query',
            'fields' => [
                'rate' => [
                    'type'    => Type::listOf(Type::nonNull($rateType)),
                    'args'    => [
                        'search'   => [
                            'type'         => new SearchType(),
                            'defaultValue' => null,
                        ],
                        'date'     => [
                            'type'         => Type::int(),
                            'defaultValue' => 0,
                        ],
                        'currency' => [
                            'type'         => $currencyType,
                            'defaultValue' => null,
                        ],
                        'prefer'   => [
                            'type'         => $preferType,
                            'defaultValue' => null,
                        ],
                        'callback' => [
                            'type'         => Type::string(),
                            'defaultValue' => '',
                        ],
                        'cors'     => [
                            'type'         => Type::boolean(),
                            'defaultValue' => false,
                        ],
                    ],
                    'resolve' => function ($queryType, array $args) use ($model): array {
                        if ($args['cors']) {
                            $this->response->setHeader('Access-Control-Allow-Origin', '*');
                        }

                        if (! empty($args['callback'])) {
                            $this->response->setHeader('X-CallBack', $args['callback']);
                        }

                        ["search" => $search, "currency" => $currency, "date" => $date, "prefer" => $prefer] = $args;

                        return $model->getByFilter($search ?? '', $currency ?? '', $date, $prefer ?? '', true);
                    },
                ],
                'info' => [
                    'type'    => Type::string(),
                    'resolve' => fn (): string => view('notice.txt'),
                ],
            ],
        ]);

        $schema = new Schema([
            'query' => $queryType,
        ]);

        try {
            $result   = GraphQL::executeQuery($schema, $query, null, null, $variables);
            $response = $result->toArray();
        } catch (Exception $e) {
            $response = [
                'errors' => [
                    [
                        'message' => $e->getMessage(),
                    ],
                ],
            ];
        }

        return $response;
    }

    /**
     * Retrieve data from the data base
     *
     * @param string $page Page name.
     *
     * @return  array
     * @throws  Exception
     * @since   1.0.0
     * @version 1.0.0
     */
    private function getData(string $page): array
    {
        helper(['array', 'text', 'logger']);

        log_activity('api_request');

        $params = array_filter([
            'search'   => '"' . $this->normalizeName() . '"',
            'currency' => $this->normalizeCurrency(),
            'date'     => $this->normalizeDate(),
            'prefer'   => $this->normalizePrefer(),
            'cors'     => $this->request->getPostGet('cors'),
            'callback' => '"' . $this->request->getPostGet('callback') . '"',
        ], function ($param): bool {
            return $param && strlen(strip_quotes($param));
        });

        $params = array_map(function ($value, $key) {
            return $key . ' : ' . $value;
        }, $params, array_keys($params));

        $params = empty($params) ? '' : ' (' . implode(', ', $params) . ')';

        $query = '{ query : rate' . $params . ' { currency last_checked last_updated name rate url }}';

        return array_map('array_filter', dot_array_search('data.query', $this->resolveData($query)) ?? []);
    }

    /**
     * Normalize search term
     *
     * @return  string
     * @version 1.0.0
     * @since   1.0.0
     */
    private function normalizeName(): string
    {
        $filter = [
            $this->request->getPostGet('search'),
            $this->request->getPostGet('source'),
            $this->request->getPostGet('name')
        ];

        //search for rate
        return array_filter($filter) ?: "";
    }

    /**
     * Normalize currency
     *
     * @return  string
     * @throws  Exception
     * @since   1.0.0
     * @version 1.0.0
     */
    private function normalizeCurrency(): string
    {
        $model = new RateModel();

        $currency = strtoupper($this->request->getPostGet('currency') ?: '');

        $currencies = $model->getCurrencies();

        return in_array($currency, array_column($currencies, 'currency')) ? $currency : '';
    }

    /**
     * Normalize given date
     *
     * @return  integer
     * @version 1.0.0
     * @since   1.0.0
     */
    private function normalizeDate(): int
    {
        $date = $this->request->getPostGet('date') ?: 0;
        if ($date && ! is_numeric($date)) {
            $date = strtotime($date);
        }

        return $date;
    }

    /**
     * Normalize preferred return value
     *
     * @return  string
     * @version 1.0.0
     * @since   1.0.0
     */
    private function normalizePrefer(): string
    {
        $model = new RateModel();

        $prefer = strtolower($this->request->getPostGet('prefer') ?: '');

        //value to get
        if (! in_array($prefer, $model->supportedPrefers())) {
            $prefer = '';
        }

        return strtoupper($prefer);
    }
}
