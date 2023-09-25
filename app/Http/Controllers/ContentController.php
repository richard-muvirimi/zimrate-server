<?php

namespace App\Http\Controllers;

use App\Models\Content;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

class ContentController extends BaseController
{
    /**
     * Create the controller instance.
     */
    public function __construct()
    {
        $this->authorizeResource(Content::class, 'content');
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
                'data' => Content::whereBelongsTo($request->user())
                    ->offset($request->offset ?? 0)
                    ->limit($request->limit ?? 20)
                    ->get(),
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
                'type' => 'required',
                'data' => '',
                'parent' => 'numeric',
            ]);

            Content::create([
                'type' => $request->type,
                'content' => $request->data,
                'parent' => $request->parent,
            ]);

            return response()->json([
                'status' => true,
                'message' => 'Content Created Successfully',
            ], 200);
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
    public function show(Content $content): JsonResponse
    {

        return response()->json([
            'status' => true,
            'data' => $content,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Content $content): JsonResponse
    {
        try {
            $request->validate([
                'type' => 'required',
                'content' => '',
                'parent' => 'datetime',
                'completed_at' => 'datetime',
            ]);

            $content->type = $request->type;
            $content->content = $request->content;
            $content->parent = $request->parent;
            $content->completed_at = $request->completed_at;

            $content->save();

            return response()->json([
                'status' => true,
                'message' => 'Content Updated Successfully',
            ], 200);
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
    public function destroy(Content $content): JsonResponse
    {

        $content->delete();

        return response()->json([
            'status' => true,
            'message' => 'Content Deleted Successfully',
        ], 200);
    }
}
