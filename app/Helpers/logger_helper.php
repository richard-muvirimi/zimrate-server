<?php

use Br33f\Ga4\MeasurementProtocol\Dto\Event\BaseEvent;
use Br33f\Ga4\MeasurementProtocol\Dto\Parameter\BaseParameter;
use Br33f\Ga4\MeasurementProtocol\Dto\Request\BaseRequest;
use Br33f\Ga4\MeasurementProtocol\Service;
use Config\Services;

/**
 * Log events to Google analytics
 *
 * @param string $event Event.
 *
 * @since   1.0.0
 * @version 1.0.0
 *
 * @return void
 *
 * @author Richard Muvirimi <richard@tyganeutronics.com>
 */
function log_activity(string $event): void
{
    if (getenv('GOOGLE_MEASUREMENT_ID') && getenv('GOOGLE_MEASUREMENT_PROTOCOL_API_SECRET')) {
        try {
            ob_start();

            $request = Services::request();

            $ipAddress = $request->getIPAddress();
            $userAgent = $request->getUserAgent()->getAgentString() ?: 'Zimrate/1.0';

            $ga4Service = new Service(getenv('GOOGLE_MEASUREMENT_PROTOCOL_API_SECRET'));
            $ga4Service->setMeasurementId(getenv('GOOGLE_MEASUREMENT_ID'));
            $ga4Service->setIpOverride($ipAddress);
            $ga4Service->setOptions([
                'User-Agent' => $userAgent,
            ]);

            $baseRequest = new BaseRequest();
            $baseRequest->setClientId($ipAddress);

            $sessionId = md5($ipAddress . $userAgent);

            $baseRequest->setUserId($sessionId);

            $baseEvent = new BaseEvent($event);

            // Create Base Event
            $paramSessionId = new BaseParameter($sessionId);
            $baseEvent->addParam('engagement_time_msec', $paramSessionId);

            $paramEngagementTime = new BaseParameter('100');
            $baseEvent->addParam('session_id', $paramEngagementTime);

            $baseRequest->addEvent($baseEvent);

            // Create View Page Event
            $pageViewEvent = new BaseEvent('page_view');

            $pageViewParam = new BaseParameter(current_url());
            $pageViewEvent->addParam('page_location', $pageViewParam);

            $localeParam = new BaseParameter($request->getLocale());
            $pageViewEvent->addParam('language', $localeParam);

            $titleParam = new BaseParameter(current_url(true)->getPath());
            $pageViewEvent->addParam('page_title', $titleParam);

            $baseRequest->addEvent($pageViewEvent);

            // Send
            $ga4Service->send($baseRequest);
        } catch (Exception $e) {
            //do nothing
        } finally {
            ob_clean();
        }
    }
}
