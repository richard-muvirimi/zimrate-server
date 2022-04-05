<!DOCTYPE html>
<html lang="en" class="no-js">

<head>

    <?= view('solid/partials/head'); ?>

    <title><?= lang('Site.page.privacy.title'); ?>
    </title>
    <meta property="og:title"
        content="<?= lang('Site.page.privacy.title'); ?>">

</head>

<body class="is-boxed has-animations">
    <div class="body-wrap">

        <?= view("solid/partials/header") ?>

        <main>
            <section class="hero">
                <div class="container">
                    <div class="hero-inner">
                        <div class="hero-copy">
                            <h1 class="hero-title mt-0"><?= lang('Site.page.privacy.title'); ?>
                            </h1>
                        </div>
                        <?= view("solid/partials/animation") ?>
                    </div>
                </div>
            </section>

            <section class="features section">
                <div class="container">
                    <div class="features-inner has-bottom-divider">
                        <?= view('solid/partials/privacy'); ?>
                    </div>
                </div>
            </section>

        </main>

        <?= view('solid/partials/footer'); ?>

    </div>

    <script src="public/js/main.min.js"></script>
</body>

</html>