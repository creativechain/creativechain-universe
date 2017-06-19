<html class=" js csstransforms3d">
<head>
    <title><?php echo strip_tags($_GET['search']); ?> | CREATIVECHAIN | Publish, Search & Smart contracts</title>
    <meta name="description"
          content="<?php echo strip_tags($_GET['search']); ?> . Publish, search and earn money that steal corporations in media distribution | Intellectual property register | Smart Contracts readable by humans">
    <?php


    echo '<meta name="keywords" content="' . $_GET['search'] . ' Publish, search and earn money that steal corporations in media distribution | Intellectual property register | Smart Contracts readable by humans">';
    echo '<meta name="description" content="' . $_GET['search'] . 'Publish, search and earn money that steal corporations in media distribution | Intellectual property register | Smart Contracts readable by humans">';
    echo '<meta property="og:title" content="' . $_GET['search'] . 'Publish, search and earn money that steal corporations in media distribution | Intellectual property register | Smart Contracts readable by humans">';
    echo '<meta property="og:description" content="' . $_GET['search'] . 'Publish, search and earn money that steal corporations in media distribution | Intellectual property register | Smart Contracts readable by humans">';
    echo '<meta property="og:keywords" content="' . $_GET['search'] . 'Publish, search and earn money that steal corporations in media distribution | Intellectual property register | Smart Contracts readable by humans">';
    echo '<meta property="og:image" content="Publish, search and earn money that steal corporations in media distribution | Intellectual property register | Smart Contracts readable by humans">';
    echo '<meta name="robots" content="all">';
    echo '<meta charset="utf-8">';
    echo '<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    ?>

    <link rel="stylesheet" href="../../css/bootstrap.css" type="text/css" media="all">
    <link rel="stylesheet" href="../../css/font-awesome.min.css" type="text/css" media="all">

    <link rel="stylesheet" href="../../css/creativechain.css" type="text/css" media="all">

    <link rel="stylesheet" href="../../css/custom.css" type="text/css" media="all">
    <link rel="stylesheet" href="../../css/responsive.css" type="text/css" media="all">
    <link rel="stylesheet" href="../../css/jquery.json-viewer.css" type="text/css" media="all">


    <link rel="icon shortcut" type="image/png" href="../../img/favicon.png">

    <link href="https://fonts.googleapis.com/css?family=Crete+Round" rel="stylesheet">

    <script src="../../js/jquery.js"></script>
    <script src="../../js/bootstrap-datepicker.min.js"></script>
    <script src="../../js/jquery.qrcode-0.11.0.min.js"></script>


    <script language="javascript" src="../../js/blockize.js" type="text/javascript"></script>
    <script src="../../js/bootstrap.min.js"></script>

</head>

<body>

<div style="clear:both;">

</div>

<nav class="navbar navbar-default navbar-fixed-top">
    <div class="beta-testing">
        <img src="../../img/nav-beta-testing.jpg">
    </div>
    <div class="container">
        <div class="row">
            <div class="col-lg-3 col-md-4 col-sm-3 col-xs-12">
                <div class="navbar-header">
                    <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar"
                            aria-expanded="false" aria-controls="navbar">
                        <span class="sr-only">Toggle navigation</span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                    </button>
                    <a class="navbar-brand" href="/">
                        <img src="../../img/creativechain-logo.png" class="img-responsive">
                    </a>
                </div>
            </div>
            <div class="col-lg-9 col-md-8 col-sm-9 col-xs-12">
                <div id="navbar" class="navbar-collapse collapse navbar-home">
                    <div class="row">
                        <div class="col-xs-12 visible-xs">
                            <form class="navbar-form"
                                  onSubmit="$('#output').html('');findWord(document.getElementById('find').value, 0);return false;">
                                <input id="find" type="text" class="form-control" placeholder="Search...">
                            </form>
                        </div>
                    </div>
                    <ul class="nav navbar-nav">
                        <li class="hidden-xs">
                            <form class="navbar-form"
                                  onSubmit="$('#output').html('');findWord(document.getElementById('find').value, 0);return false;">
                                <input id="find" type="text" class="form-control" placeholder="Search...">
                            </form>
                        </li>
                        <li>
                            <a href="../../cblock/reg/publish.php">PUBLISH</a>
                        </li>
                        <li>
                            <a href="https://creativechain.org/ico">BUY</a>
                        </li>
                        <li>
                            <a href="../../cblock/contract/getcrea.php">GET</a>
                        </li>
                        <li>
                            <a href="../../cblock/show/wallet.php">WALLET</a>
                        </li>
                    </ul>
                </div><!--/.nav-collapse -->
            </div>
        </div>


    </div>
</nav>
<script type="text/javascript">
    $(document).ready(function () {
        var url = window.location;
        $('ul.nav a[href="'+ url +'"]').parent().addClass('active');
        $('ul.nav a').filter(function() {
            return this.href == url;
        }).parent().addClass('active');
    });


</script>

<div class="gr-h"></div>






