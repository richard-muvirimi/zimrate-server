<?php

namespace App\Enums;

use BenSampo\Enum\Attributes\Description;
use BenSampo\Enum\Enum;

final class OptionKey extends Enum
{
    #[Description(description: 'The system wide notice.')]
    public const SYSTEM_NOTICE = 'notice';

    #[Description(description: 'The site name.')]
    public const SITE_NAME = 'site-name';
}
