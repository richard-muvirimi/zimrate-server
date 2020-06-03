<!DOCTYPE html>
<html lang="en" class="no-js">

<head>

    <?php $this->load->view('solid/head.php'); ?>

    <meta name="description" content="<?php echo $this->lang->line('description'); ?>" />
    <meta name="keywords" content="Zimbabwe, Rate, Bond, Rtgs, Zwl, Currency, Exchange, MarketWatch, Rbz">
    <meta name="author" content="Richard Muvirmi">

    <meta property="og:title" content="<?php echo $this->lang->line('title'); ?>">
    <meta property="og:description" content="<?php echo $this->lang->line('description'); ?>">

    <title><?php echo $this->lang->line('title'); ?></title>
    <script src="src/js/date.js"></script>

</head>

<body class="is-boxed has-animations" onload="setDate()">
    <div class="body-wrap">
        <header class="site-header">
            <div class="container">
                <div class="site-header-inner">
                    <div class="brand header-brand">
                        <h1 class="m-0">
                            <a href="#">
                                <img class="header-logo-image" src="dist/images/logo.svg" alt="Logo">
                            </a>
                        </h1>
                    </div>
                </div>
            </div>
        </header>

        <main>
            <section class="hero">
                <div class="container">
                    <div class="hero-inner">
                        <div class="hero-copy">
                            <h1 class="hero-title mt-0"><?php echo $this->lang->line('title'); ?></h1>
                            <p class="hero-paragraph"><?php echo $this->lang->line('description'); ?></p>
                            <div class="hero-cta"><a class="button button-primary"
                                    href="#rates"><?php echo $this->lang->line('rates'); ?></a><a class="button"
                                    href="developers"><?php echo $this->lang->line('developers'); ?></a></div>
                        </div>
                        <div class="hero-figure anime-element">
                            <svg class="placeholder" width="528" height="396" viewBox="0 0 528 396">
                                <rect width="528" height="396" style="fill:transparent;" />
                            </svg>
                            <div class="hero-figure-box hero-figure-box-01" data-rotation="45deg"></div>
                            <div class="hero-figure-box hero-figure-box-02" data-rotation="-45deg"></div>
                            <div class="hero-figure-box hero-figure-box-03" data-rotation="0deg"></div>
                            <div class="hero-figure-box hero-figure-box-04" data-rotation="-135deg"></div>
                            <div class="hero-figure-box hero-figure-box-05"></div>
                            <div class="hero-figure-box hero-figure-box-06"></div>
                            <div class="hero-figure-box hero-figure-box-07"></div>
                            <div class="hero-figure-box hero-figure-box-08" data-rotation="-22deg"></div>
                            <div class="hero-figure-box hero-figure-box-09" data-rotation="-52deg"></div>
                            <div class="hero-figure-box hero-figure-box-10" data-rotation="-50deg"></div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="features section">
                <div class="container">
                    <div class="features-inner section-inner has-bottom-divider">

                        <div class="text-center">
                            <h2 class="section-title mt-0">
                                <?php echo $this->lang->line('title_why'); ?>
                            </h2>
                        </div>

                        <div class="features-wrap">
                            <div class="feature text-center is-revealing">
                                <div class="feature-inner">
                                    <div class="feature-icon">
                                        <img src="dist/images/feature-icon-01.svg" alt="Feature 01">
                                    </div>
                                    <h4 class="feature-title mt-24">
                                        <?php echo $this->lang->line('benefit_productive_title'); ?></h4>
                                    <p class="text-sm mb-0"><?php echo $this->lang->line('benefit_productive'); ?></p>
                                </div>
                            </div>
                            <div class="feature text-center is-revealing">
                                <div class="feature-inner">
                                    <div class="feature-icon">
                                        <img src="dist/images/feature-icon-02.svg" alt="Feature 02">
                                    </div>
                                    <h4 class="feature-title mt-24">
                                        <?php echo $this->lang->line('benefit_time_title'); ?></h4>
                                    <p class="text-sm mb-0"><?php echo $this->lang->line('benefit_time'); ?></p>
                                </div>
                            </div>
                            <div class="feature text-center is-revealing">
                                <div class="feature-inner">
                                    <div class="feature-icon">
                                        <img src="dist/images/feature-icon-03.svg" alt="Feature 03">
                                    </div>
                                    <h4 class="feature-title mt-24">
                                        <?php echo $this->lang->line('benefit_free_title'); ?></h4>
                                    <p class="text-sm mb-0"><?php echo $this->lang->line('benefit_free'); ?></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="pricing section" id="rates">
                <div class="container-sm">
                    <div class="pricing-inner section-inner">
                        <div class="pricing-header text-center">
                            <p class="section-paragraph mb-0"><?php echo $this->lang->line('last_checked'); ?></p>
                            <h2 id="last_checked_date" class="section-title mt-0"><?php echo $last_checked; ?></h2>
                        </div>
                        <div class="pricing-tables-wrap">

                            <?php foreach ($currencies as $key => $currency): ?>

                            <div class="pricing-table">
                                <div class="pricing-table-inner is-revealing" style="height: initial;">
                                    <div class="pricing-table-main">

                                        <div class="pricing-table-header pb-24">
                                            <div class="pricing-table-price">
                                                <span class="pricing-table-price-amount h1">
                                                    <?php echo round($currency->max, 2); ?>
                                                </span>
                                                <span class="pricing-table-price-currency h2">
                                                    %
                                                </span>
                                                <span class="text-xs">
                                                    <?php echo $this->lang->line('maximum'); ?>
                                                </span>
                                            </div>
                                        </div>

                                        <div class="pricing-table-header pb-24">
                                            <div class="pricing-table-price">
                                                <span class="pricing-table-price-amount h1">
                                                    <?php echo round($currency->mean, 2); ?>
                                                </span>
                                                <span class="pricing-table-price-currency h2">
                                                    %
                                                </span>
                                                <span class="text-xs">
                                                    <?php echo $this->lang->line('average'); ?>
                                                </span>
                                            </div>
                                        </div>

                                        <div class="pricing-table-header pb-24">
                                            <div class="pricing-table-price">
                                                <span class="pricing-table-price-amount h1">
                                                    <?php echo round($currency->min, 2); ?>
                                                </span>
                                                <span class="pricing-table-price-currency h2">
                                                    %
                                                </span>
                                                <span class="text-xs">
                                                    <?php echo $this->lang->line('minimum'); ?>
                                                </span>
                                            </div>
                                        </div>

                                        <div class="pricing-table-features-title text-xs pt-24 pb-24">
                                            <?php printf($this->lang->line('usd_rate'), $currency->currency); ?>
                                        </div>

                                        <?php $sources = $this->rate->getCurrencySources($currency->currency)->result(); ?>

                                        <ul class="pricing-table-features list-reset text-xs">
                                            <?php foreach ($sources as $key => $source): ?>
                                            <li>
                                                <span><?php echo auto_link(parse_url($source->url, PHP_URL_HOST)); ?></span>
                                            </li>
                                            <?php endforeach; ?>
                                        </ul>

                                    </div>
                                </div>
                            </div>

                            <?php endforeach; ?>

                        </div>

                        <div class="pricing-header text-center">
                            <p class="section-paragraph mb-0"><?php echo $this->lang->line('rate_usd'); ?></p>
                        </div>

                        <div class="pricing-header text-center">
                            <p class="section-paragraph mb-0"><?php echo $this->lang->line('sample_app'); ?></p>
                            <a
                                href='https://play.google.com/store/apps/details?id=com.tyganeutronics.myratecalculator&pcampaignid=pcampaignidMKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1'>
                                <img alt='Get it on Google Play' style="margin: auto;"
                                    src='https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png' />
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <section class="cta section">
                <div class="container">
                    <div class="cta-inner section-inner">
                        <h3 class="section-title mt-0"><?php echo $this->lang->line('not_convinced'); ?></h3>
                        <div class="cta-cta">
                            <a class="button button-primary button-wide-mobile"
                                href="https://tyganeutronics.com/#contact-form-2"><?php echo $this->lang->line('contact_btn'); ?></a>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <?php $this->load->view('solid/footer.php'); ?>

    </div>

    <script src="dist/js/main.min.js"></script>
</body>

</html>