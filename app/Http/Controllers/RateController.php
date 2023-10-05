<?php

namespace App\Http\Controllers;

use App\Models\Option;
use App\Models\Rate;
use App\Rules\IsBoolean;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

class RateController extends BaseController
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'limit' => 'numeric',
                'page' => 'numeric',
            ]);

            $limit = Option::query()->firstOrCreate(['key' => 'paginator-limit'], ['value' => '20']);

            $request->mergeIfMissing([
                'limit' => $limit->value('value'),
                'page' => 1,
            ]);

            $paginator = Rate::query()->paginate(perPage: intval($request->get('limit')), page: intval($request->get('page')));

            return response()->json([
                'status' => true,
                'data' => [
                    'items' => $paginator->items(),
                    'paginator' => [
                        'total' => $paginator->total(),
                        'page' => $paginator->currentPage(),
                        'limit' => $paginator->perPage(),
                    ],
                ],
            ]);
        } catch (Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $rules = [
                'status' => ['required', new IsBoolean()],
                'enabled' => ['required', new IsBoolean()],
                'javascript' => ['required', new IsBoolean()],
                'rate_name' => 'required|string',
                'rate_currency' => 'required|string',
                'source_url' => 'required|url',
                'rate_selector' => 'required|string',
                'rate' => 'required|numeric',
                'last_rate' => 'required|numeric',
                'transform' => 'required|string',
                'rate_updated_at_selector' => 'required|string',
                'source_timezone' => 'required|string',
                'rate_updated_at' => 'required|datetime',
            ];

            $request->validate($rules);

            Rate::query()->create($request->only(array_keys($rules)));

            return response()->json([
                'status' => true,
                'message' => 'Rate Created Successfully',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Rate $rate): JsonResponse
    {
        return response()->json([
            'status' => true,
            'data' => $rate->toArray(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Rate $rate): JsonResponse
    {
        try {
            $rules = [
                'status' => ['required', new IsBoolean()],
                'enabled' => ['required', new IsBoolean()],
                'javascript' => ['required', new IsBoolean()],
                'rate_name' => 'required|string',
                'rate_currency' => 'required|string',
                'source_url' => 'required|url',
                'rate_selector' => 'required|string',
                'rate' => 'required|numeric',
                'last_rate' => 'required|numeric',
                'transform' => 'required|string',
                'rate_updated_at_selector' => 'required|string',
                'source_timezone' => 'required|string',
                'rate_updated_at' => 'required|datetime',
            ];

            $request->validate($rules);

            $rate->update($request->only(array_keys($rules)));

            return response()->json([
                'status' => true,
                'message' => 'Rate Updated Successfully',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Rate $rate): JsonResponse
    {
        $rate->delete();

        return response()->json([
            'status' => true,
            'message' => 'Rate Deleted Successfully',
        ]);
    }
}
