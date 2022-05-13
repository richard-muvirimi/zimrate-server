<!DOCTYPE html>
<html lang="en" class="no-js">

<head>

    <?php echo view('solid/partials/head'); ?>

    <title><?php echo lang('Site.page.privacy.title'); ?>
    </title>
    <meta property="og:title"
        content="<?php echo lang('Site.page.privacy.title'); ?>">

</head>

<body class="is-boxed has-animations">
    <div class="body-wrap">

        <?php echo view("solid/partials/header") ?>

        <main>
            <section class="hero">
                <div class="container">
                    <div class="hero-inner">
                        <div class="hero-copy">
                            <h1 class="hero-title mt-0"><?php echo lang('Site.page.privacy.title'); ?>
                            </h1>
                        </div>
                        <?php echo view("solid/partials/animation") ?>
                    </div>
                </div>
            </section>

            <section class="features section">
                <div class="container">
                    <div class="features-inner has-bottom-divider">
                        <?php echo view('solid/partials/privacy'); ?>
                    </div>
                </div>
            </section>

        </main>

        <?php echo view('solid/partials/footer'); ?>

    </div>

    <script src="public/js/main.min.js"></script>
</body>

</html>
