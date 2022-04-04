<!DOCTYPE html>
<html lang="en" class="no-js">

<head>
    <?= view('solid/partials/head'); ?>

    <title><?= lang('Site.page.developers.title'); ?></title>
    <meta property="og:title" content="<?= lang('Site.page.developers.title'); ?>">

</head>

<body class="is-boxed has-animations">
    <div class="body-wrap">

        <?= view("solid/partials/header") ?>

        <main>
            <section class="hero">
                <div class="container">
                    <div class="hero-inner">
                        <div class="hero-copy">
                            <h1 class="hero-title mt-0"><?= lang('Site.page.developers.title'); ?></h1>
                        </div>
                        <?= view("solid/partials/animation") ?>
                    </div>
                </div>
            </section>

            <section class="features section">
                <div class="container">
                    <div class="features-inner has-bottom-divider">

                        <p class="text-sm mb-0">
                            <?= lang('Site.page.developers.api_access', [anchor(base_url("api/v1"))]); ?></p>

                        <h4><?= lang('Site.page.developers.api_parameters'); ?></h4>
                        <p class="text-sm mb-0"><?= lang('Site.page.developers.api_brief'); ?></p>

                        <dl>
                            <dt><?= lang('Site.page.developers.param_name_title'); ?></dt>
                            <dd>- <?= lang('Site.page.developers.param_name'); ?></dd>

                            <dt><?= lang('Site.page.developers.param_currency_title'); ?></dt>
                            <dd>- <?= lang('Site.page.developers.param_currency', [implode(", ", $currencies)]); ?></dd>

                            <dt><?= lang('Site.page.developers.param_date_title'); ?></dt>
                            <dd>- <?= lang('Site.page.developers.param_date'); ?></dd>

                            <dt><?= lang('Site.page.developers.param_prefer_title'); ?></dt>
                            <dd>- <?= lang('Site.page.developers.param_prefer', [implode(", ", $prefers)]); ?></dd>
                        </dl>

                        <p class="text-sm mb-0"><?= lang('Site.page.developers.param_emphasis'); ?></p>

                        <h4><?= lang('Site.page.developers.cors_title'); ?></h4>
                        <p class="text-sm mb-0"><?= lang('Site.page.developers.cors_state'); ?></p>

                        <ul>
                            <li><?= lang('Site.page.developers.cors_param'); ?></li>
                            <li>
                                <p class="text-sm mb-0"><?= lang('Site.page.developers.cors_jsonp'); ?></p>
                                <p class="text-sm mb-0">
                                <pre><code><?= sprintf(file_get_contents(FCPATH . 'public' . DIRECTORY_SEPARATOR . 'misc' . DIRECTORY_SEPARATOR . 'example.js'), base_url("api/v1")) ?></code></pre>
                                </p>
                            </li>
                        </ul>

                        <p class="text-sm mb-0"><?= lang('Site.page.developers.cors_summary'); ?></p>

                        <h4>...</h4>

                        <ul>
                            <li><?= lang('Site.page.developers.usage_emphasis'); ?></li>
                            <li><?= lang('Site.page.developers.info_disable'); ?></li>
                        </ul>

                        <h4><?= lang('Site.page.developers.disclaimer'); ?></h4>
                        <p class="text-sm mb-0"><?= lang('Site.page.developers.documentation_disclaimer'); ?></p>

                    </div>
                </div>
            </section>

        </main>

        <?= view('solid/partials/footer'); ?>

    </div>

    <script src="public/js/main.min.js"></script>
</body>

</html>