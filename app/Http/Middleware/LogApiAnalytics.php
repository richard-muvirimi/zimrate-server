<?php

namespace App\Http\Middleware;

use Br33f\Ga4\MeasurementProtocol\Dto\Event\BaseEvent;
use Br33f\Ga4\MeasurementProtocol\Dto\Parameter\BaseParameter;
use Br33f\Ga4\MeasurementProtocol\Dto\Request\BaseRequest;
use Br33f\Ga4\MeasurementProtocol\Service;
use Closure;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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

        $measurementId = env('MEASUREMENT_ID', '');
        $measurementSecret = env('MEASUREMENT_PROTOCOL_API_SECRET', '');

        if (Str::of($measurementId)->isNotEmpty() && Str::of($measurementSecret)->isNotEmpty()) {
            try {
                ob_start();

                $ip = $request->ip();
                $userAgent = $request->userAgent() ?: 'Zimrate/1.0';

                $ga4Service = new Service($measurementSecret);
                $ga4Service->setMeasurementId($measurementId);
                $ga4Service->setIpOverride($ip);
                $ga4Service->setOptions([
                    'User-Agent' => $userAgent,
                ]);

                $baseRequest = new BaseRequest;
                $baseRequest->setClientId($ip);

                $sessionId = md5($ip.$userAgent);

                $baseRequest->setUserId($sessionId);

                $baseEvent = new BaseEvent('api_request');

                // Create Base Event
                $paramSessionId = new BaseParameter($sessionId);
                $baseEvent->addParam('engagement_time_msec', $paramSessionId);

                $paramEngagementTime = new BaseParameter('100');
                $baseEvent->addParam('session_id', $paramEngagementTime);

                $baseRequest->addEvent($baseEvent);

                // Create View Page Event
                $pageViewEvent = new BaseEvent('page_view');

                $pageViewParam = new BaseParameter($request->url());
                $pageViewEvent->addParam('page_location', $pageViewParam);

                $localeParam = new BaseParameter($request->getLocale());
                $pageViewEvent->addParam('language', $localeParam);

                $titleParam = new BaseParameter($request->path());
                $pageViewEvent->addParam('page_title', $titleParam);

                $baseRequest->addEvent($pageViewEvent);

                // Send
                $ga4Service->send($baseRequest);
            } catch (Exception) {
                //do nothing
            } finally {
                ob_clean();
            }
        }

        return $next($request);
    }
}
