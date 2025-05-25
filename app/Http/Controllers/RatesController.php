<?php

namespace App\Http\Controllers;

use App\GraphQL\Queries\InfoQuery;
use App\Notifications\StatusNotification;
use App\Rules\IsBoolean;
use App\Traits\QueriesFaultyRates;
use App\Traits\ResolvesRates;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Config;

class RatesController extends Controller
{
    use QueriesFaultyRates, ResolvesRates;

    public function version0(Request $request): JsonResponse
    {
        try {

            return response()->json($this->getRates($request));

        } catch (Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function version1(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'info' => [new IsBoolean],
            ]);

            $response['USD'] = $this->getRates($request);

            if ($request->string('info', 'true')->toBoolean()) {
                $response['info'] = (new InfoQuery)(null, []);
            }

            if ($request->has('callback')) {
                return response()->jsonp($request->input('callback'),
                    $response,
                );
            } else {
                return response()->json($response);
            }

        } catch (Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function status(): Response
    {
        $rates = $this->getFaultyRates();
        $notification = new StatusNotification($rates);

        // Create a mock notifiable object with an email property
        $notifiable = new class
        {
            public function routeNotificationFor($channel)
            {
                return Config::get('mail.to.address');
            }
        };

        $mailData = $notification->toMail($notifiable);

        return response()->view($mailData->markdown, $mailData->viewData);
    }
}
