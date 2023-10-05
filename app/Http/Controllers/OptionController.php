<?php

namespace App\Http\Controllers;

use App\Models\Option;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

class OptionController extends BaseController
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

            $paginator = Option::query()->paginate(perPage: intval($request->get('limit')), page: intval($request->get('page')));

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
            $request->validate([
                'key' => 'required|string',
                'value' => 'required|string',
            ]);

            Option::query()->updateOrCreate(['key' => $request->get('key')], ['value' => $request->get('value')]);

            return response()->json([
                'status' => true,
                'message' => 'Option Upsert Successfully',
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
    public function show(Option $option): JsonResponse
    {
        return response()->json([
            'status' => true,
            'data' => $option->toArray(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Option $option): JsonResponse
    {
        try {
            $request->validate([
                'key' => 'required|string',
                'value' => 'required|string',
            ]);

            $option->update($request->only(['key', 'value']));

            return response()->json([
                'status' => true,
                'message' => 'Option Upsert Successfully',
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
    public function destroy(Option $option): JsonResponse
    {
        $option->delete();

        return response()->json([
            'status' => true,
            'message' => 'Option Deleted Successfully',
        ]);
    }
}
