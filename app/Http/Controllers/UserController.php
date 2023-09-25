<?php

namespace App\Http\Controllers;

use App\Models\User;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Hash;

class UserController extends BaseController
{
    /**
     * Create the controller instance.
     */
    public function __construct()
    {
        $this->authorizeResource(User::class, 'user');
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'limit' => 'numeric',
                'offset' => 'numeric',
            ]);

            return response()->json([
                'status' => true,
                'data' => User::all(),
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
                'name' => 'required',
                'email' => 'required|email',
                'password' => 'required',
            ]);

            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => $request->password,
                'role' => 'user',
            ]);

            return response()->json([
                'status' => true,
                'message' => 'User Created Successfully',
                'data' => $user->createToken(config('app.key'))->plainTextToken,
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
            'data' => $user,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        try {
            $request->validate([
                'name' => 'required',
                'email' => 'required|email',
                'password' => '',
                'role' => '',
            ]);

            $user->name = $request->name;
            $user->email = $request->email;

            if ($request->user()->tokenCan('update:others:account')) {
                $user->role = $request->role;
            }

            if ($request->password) {
                $user->password = Hash::make($request->password);
            }

            $user->save();

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
