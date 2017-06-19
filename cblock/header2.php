<html class=" js csstransforms3d">
<head>
	<title><?php echo strip_tags($_GET['search']); ?> | CREATIVECHAIN </title>
	<meta name="description" content="Creativechain , search, publish & contracts">
	<link rel="stylesheet" href="../../css/bootstrap.css" type="text/css" media="all">
	<link rel="stylesheet" href="../../css/font-awesome.min.css" type="text/css" media="all">

	<link rel="stylesheet" href="../../css/creativechain.css" type="text/css" media="all">

	<link rel="stylesheet" href="../../css/responsive.css" type="text/css" media="all">
    <link rel="stylesheet" href="../../css/custom.css" type="text/css" media="all">
	<link rel="icon shortcut" type="image/png" href="../../img/favicon.png">
	<script src="../../js/jquery.js"></script>
	<script src="../../js/jquery.qrcode-0.11.0.min.js"></script>
	<script src="../../js/bootstrap.min.js"></script>
	<script language="javascript" src="../../js/blockize.js" type="text/javascript"></script>
	
</head>

<body>

<div style="clear:both;">

</div>

<nav class="navbar navbar-default navbar-fixed-top">
	<div class="beta-testing">
		<img src="../../img/nav-beta-testing.jpg">
	</div>
	<div class="container">
		<div class="navbar-header">
			<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">
				<span class="sr-only">Toggle navigation</span>
				<span class="icon-bar"></span>
				<span class="icon-bar"></span>
				<span class="icon-bar"></span>
			</button>
			<a class="navbar-brand" href="/">
				<img src="../../img/creativechain-logo.png">
			</a>
		</div>
		<div id="navbar" class="navbar-collapse collapse">

			<ul class="nav navbar-nav">
				<li>
					<form class="navbar-form" onSubmit="$('#output').html('');findWord(document.getElementById('find').value, 0);return false;">
						<input id="find" type="text" class="form-control" placeholder="Search...">
					</form>
				</li>
				<li class="active">
					<a href="http://creativechain.net/cblock/reg/publish.php">Publish</a>
				</li>
				<!--<li>
					<a href="http://creativechain.net/cblock/contract/buycrea.php">BUY</a>
				</li>-->
				<li>
					<a href="http://creativechain.net/cblock/contract/getcrea.php">GET</a>
				</li>
			</ul>
		</div><!--/.nav-collapse -->
	</div>
</nav>



<div class="gr-h"></div>

<div class="filter">
	<div class="container">
		<div class="row">
		</div>
	</div>
</div>



