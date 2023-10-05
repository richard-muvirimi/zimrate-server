<?php

namespace App\Http\Middleware;

use Closure;
use Exception;
use Freshbitsweb\LaravelGoogleAnalytics4MeasurementProtocol\Facades\GA4;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogApiAnalytics
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        try {
            GA4::setClientId(request()->ip())
                ->postEvent([
                    'name' => 'api_request',
                ]);
        } catch (Exception) {
            // Do nothing
        }

        return $next($request);
    }
}
