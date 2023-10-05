<?php

namespace App\Http\Controllers;

use App\Models\Option;
use App\Models\User;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Hash;

class UserController extends BaseController
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

            $paginator = User::query()->paginate(perPage: intval($request->get('limit')), page: intval($request->get('page')));

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
                'name' => 'required|string',
                'email' => 'required|email',
                'password' => 'required|string',
            ];

            $request->validate($rules);

            User::query()->create($request->only(array_keys($rules)));

            return response()->json([
                'status' => true,
                'message' => 'User Created Successfully',
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
    public function show(User $user): JsonResponse
    {
        return response()->json([
            'status' => true,
            'data' => $user->toArray(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        try {
            $request->validate([
                'name' => 'required|string',
                'email' => 'required|email',
                'password' => '',
            ]);

            $user->update($request->only(['name', 'email']));

            if ($request->has('password')) {
                $user->update(['password' => Hash::make($request->get('password'))]);
            }

            return response()->json([
                'status' => true,
                'message' => 'User Updated Successfully',
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
    public function destroy(User $user): JsonResponse
    {

        $user->delete();

        return response()->json([
            'status' => true,
            'message' => 'User Deleted Successfully',
        ]);
    }
}
