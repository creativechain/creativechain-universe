var shell = require('electron').shell;
var WebTorrent = require('webtorrent');
var client = new WebTorrent();

global.appRoot = path.resolve(__dirname);

if (typeof fs != 'undefined') {
    const fs = require('fs')
}

//open links externally by default
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
});
if (document.location.href == 'https://www.creativechain.net/') {
    document.location.href = 'https://creativechain.net';
}
String.prototype.hex2bin = function() {
    var i = 0,
        len = this.length,
        result = "";

    //Converting the hex string into an escaped string, so if the hex string is "a2b320", it will become "%a2%b3%20"
    for (; i < len; i += 2)
        result += '%' + this.substr(i, 2);

    return unescape(result);
}



var wsUri = "wss://ws.blockchain.info/inv";
var output;
var count = 0;

function init() {
    output = document.getElementById("output");
    testWebSocket();
}

function testWebSocket() {
    websocket = new WebSocket(wsUri);
    websocket.onopen = function(evt) {
        onOpen(evt)
    };
    websocket.onclose = function(evt) {
        onClose(evt)
    };
    websocket.onmessage = function(evt) {
        onMessage(evt)
    };
    websocket.onerror = function(evt) {
        onError(evt)
    };
}

function onOpen(evt) {
    //writeToScreen("CONNECTED");
    doSend('{"op":"unconfirmed_sub"}');
}

function onClose(evt) {
    //writeToScreen("DISCONNECTED");
}


function onMessage(evt) {
    var obj = JSON.parse(evt.data);
    //alert(JSON.stringify(obj));
    var datas = obj['x']['out'];
    var hex2 = "";
    var hex = "";
    //alert(datas.length);
    for (var i = 1; i <= datas.length; i++) {

        hex = datas[i - 1]['script'].hex2bin();
        var hex2 = hex.split('---');
        if (hex2.length == 3) {
            //alert(hex2[1]);
            getData(hex2[1]);
        }

    }


    //writeToScreen('<span style="color: blue;">RESPONSE: ' + JSON.stringify(obj)+'</span>');
    if (count > 9) {
        //document.getElementById('output').innerHTML = '';
        count = 0;
    }
    count++;
    // websocket.close();
}

function onError(evt) {
    //writeToScreen('<span style="color: red;">ERROR:</span> ' + evt.data);
}


function doSend(message) {
    // writeToScreen("SENT: " + message);
    websocket.send(message);
}

function writeToScreen(message) {
    var pre = document.createElement("p");
    pre.style.wordWrap = "break-word";
    pre.innerHTML = message;
    output.appendChild(pre);
}




function timeConverter(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp * 1000);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
    return time;
}

function getcontracts(type, ref) {
    trantor.getcontracts(type, ref, function(obj) {
        if (obj['transactions'] !== null) {
            $.each(obj['transactions'], function(key, value) {
                var objdata = JSON.parse(value['data']);
                $("#contractsmini").html('');
                $("#contractsmini").append('	<div class="row box-comment-like">' +
                    '<div class="col-md-12">' +
                    '<ul class="list-inline">' +
                    '     <li><p></p></li>' +
                    '     <li><p>' + timeConverter(obj['transactions'][key]['date']) + '</p></li>' +
                    '    <li>' +
                    '         <p><img id="likebutton" class="ctx" src="img/like.png" onclick="like(\'' + obj['transactions'][key]['ntx'] + '\')"></p>' +
                    '    </li>' +
                    '    <li>' +
                    '        <p><img id="unlikebutton" class="ctx" src="img/unlike.png" onclick="unlike(\'' + obj['transactions'][key]['ntx'] + '\')"></p>' +
                    '    </li>' +
                    '</ul>' +
                    '</div>' +
                    '<div class="col-md-12">' +
                    '   <p>' + objdata['comment'] + '</p>' +
                    '</div>' +
                    '</div>	');
            });
        } else {
            // alert('asdas')
            $("#contractsmini").html('<p>Nothing here</p>');
        }

    })
    // $.post( "https://creativechain.net/api.php",{"action":"getcontracts", "type": type, "ref": ref}, function( data ) {
    // 	//console.log(data);
    // 	var obj=JSON.parse(data);
    // 	if(obj['transactions']!==null){
    // 		$.each( obj['transactions'], function( key, value ) {
    // 			var objdata=JSON.parse(value['data']);
    // 			$("#contractsmini").html('');
    // 			$("#contractsmini").append('	<div class="row box-comment-like">'+
    //                     '<div class="col-md-12">'+
    //                        '<ul class="list-inline">'+
    //                        '     <li><p></p></li>'+
    //                        '     <li><p>'+timeConverter(obj['transactions'][key]['date'])+'</p></li>'+
    //                         '    <li>'+
    //                        '         <p><img id="likebutton" class="ctx" src="img/like.png" onclick="like(\''+obj['transactions'][key]['ntx']+'\')"></p>'+
    //                         '    </li>'+
    //                         '    <li>'+
    //                         '        <p><img id="unlikebutton" class="ctx" src="img/unlike.png" onclick="unlike(\''+obj['transactions'][key]['ntx']+'\')"></p>'+
    //                         '    </li>'+
    //                         '</ul>'+
    //                     '</div>'+
    //                     '<div class="col-md-12">'+
    //                      '   <p>'+objdata['comment']+'</p>'+
    //                     '</div>'+
    //                 '</div>	');
    // 		});
    // 	}else{
    // 		$("#contractsmini").html('');
    //
    // 	}
    // });
}

function like(txs) {
    $("#cmodal").modal();
    $("#modaltitle").html("Like");
    $("#modalcontract").val("like");
    $("#modaltx").val(txs);
    getcontracts('like', txs);
}

function unlike(txs) {
    $("#cmodal").modal();
    $("#modaltitle").html("Unlike");
    $("#modalcontract").val("unlike");
    $("#modaltx").val(txs);

}

function smartaction(txs) {
    $("#smodal").modal();
    $("#modaltxS").val(txs);

}

function sponsor() {
    document.location.href = 'cblock/contract/sponsor.html?ref=' + $("#modaltxS").val();
}

function partner() {
    document.location.href = 'cblock/contract/creadealx2x.html?ref=' + $("#modaltxS").val();
}

function aoffer() {
    document.location.href = 'cblock/contract/acceptoffer.html?ref=' + $("#modaltxS").val();
}

function spend() {
    document.location.href = 'cblock/contract/spend.html?ref=' + $("#modaltxS").val();
}

function createspend() {
    let addr = $("#multiaddress").text(),
        reedem = $("#redeemscript").text(),
        amount = $("#amount").val(),
        members = $("#members").val(),
        sendTo = []

    $('#spend').prop("disabled", true );

    var wallets = localStorage.getItem("wallets");
    wallets = JSON.parse(wallets);
    $.each(wallets, function(wif, address, i) {
        var keyPairs = bitcoin.ECPair.fromWIF(wif, bitcoin.networks.creativecoin);
        sendTo.push(keyPairs);
        console.log("Address", sendTo);
    })

    // TODO: test spend
    console.log("address", sendTo);
    trantor.spend(addr, reedem, amount, sendTo, members, function(data, allSigned, signs) {
        // var objdata = JSON.parse(data);
        console.log("allSigned", allSigned);
        if (!data.error) {
            $('#spend').prop("disabled", false );
            $("#rawtx").html(data);
            $("#sings").html(signs);
        }
        else {
            alert(data.error);
        }
    })
    // $.post( "https://creativechain.net/api.php",{"action":"spend", "addr": $("#multiaddress").text(), "reedem": $("#redeemscript").text(), "amount": $("#amount").val() , "sendto": $("#authoraddr").text()   }, function( data ) {
    // 	var objdata=JSON.parse(data);
    //
    // 	if(objdata.error!=="null"){
    // 		$("#rawtx").html(objdata.result);
    // 	}
    //
    // });
}

function spendtransaction() {
    var maddr = $("#multiaddress").html();
    var aaddr = $("#authoraddress").html();

    alert("cooming soon");
}

function isObject(item) {
    return (typeof item === "object" && !Array.isArray(item) && item !== null);
}

function setOnContent() {
    trantor.onContent = function () {
        console.log('trantor.blockize.onContent');
        findWord(null, 1);
    }
}

function findWord(findword, page) {
    if (page == 0) {
        $("#page").html('1');
    }
    if ($("#page").html() == '1') {
        $("#back").hide();
    } else {
        $("#back").show();
    }

    if (parseInt($("#page").html()) >= parseInt($("#totalresults").html())) {
        $("#next").hide();
    } else {
        $("#next").show();
    }
    $('#output').html('');
    $('#loading').show();

    console.log('findWord', findword)
    // $.post("https://creativechain.net/api.php", {"action":"findWord", "find": findword, "page": page }, function( data ) {
    trantor.findWord(findword, page, data => {
        console.log("WEB data", data);
        if (data) {
            // console.log(data);
            var objF = new Object();
            //alert(data);
            var datos = data;

            $.each(datos, function(key, value) {
                console.log('data');

                var ref = "";


                $.each(value, function(key2, value2) {
                    console.log(key2, value2);
                    // value2 = JSON.stringify(value2)
                    if (key2 == 'ref') {
                        objF[value2] = value2;
                        ref = value2;
                    }
                    if (key2 == 'count') {
                        $('#totalresults').html(Math.ceil(value2 / 10));
                    }
                    if (key2 == 'content') {
                        console.log("content");
                        var objdata;
                        try {
                            console.log(value2);
                            // console.log(JSON.parse(value2));
                            objdata = value2
                            if (typeof value2 == 'string') {
                                objdata = JSON.parse(value2);
                            }
                            //
                            // if (isObject(value2)) {
                            //   //	alert(value2);
                            // }
                            //alert(value2);
                            var obj2 = objdata;
                            var idunique = '';
                            idunique = guid();

                            var template = "";

                            if (objdata.contract == "like" || objdata.contract == "unlike" || objdata.contract == "spend" || objdata.contract == "spend" || objdata.contract == "x2x" || objdata.contract == "acceptoffer" || objdata.contract == "multiaddress" || objdata.contract == "sponsor") {
                                template = "./cblock/show/like.html";
                            } else {
                                template = "./cblock/show/media.html"
                            }


                            $("#output").append("<div id='" + idunique + "' class='publication'> ");
                            $("#" + idunique).load(template, function() {
                                $("#" + idunique + " div").each(function() {
                                    $(this).attr({
                                        id: $(this).attr("id") + idunique
                                    });
                                });
                                $("#" + idunique + " a").each(function() {
                                    $(this).attr({
                                        id: $(this).attr("id") + idunique
                                    });
                                });
                                $("#" + idunique + " h2").each(function() {
                                    $(this).attr({
                                        id: $(this).attr("id") + idunique
                                    });
                                });
                                $("#" + idunique + " .ctx").each(function() {
                                    if ($(this).attr("id") == "likebutton") {
                                        console.log("Like button", value);
                                        $(this).attr({
                                            onClick: 'like(\"' + ref + '\")'
                                        }).text(value.like || 0)
                                    }
                                    if ($(this).attr("id") == "unlikebutton") {
                                        $(this).attr({
                                            onClick: 'unlike(\"' + ref + '\")'
                                        }).text(value.unlike || 0);
                                    }
                                    if ($(this).attr("id") == "smartaction") {
                                        $(this).attr({
                                            onClick: 'smartaction(\"' + ref + '\")'
                                        });
                                    }
                                    if ($(this).attr("id") == "torrent") {

                                        $(this).attr({
                                            href: 'cblock/show/torrent.html?ref=' + ref
                                        });
                                    }

                                    if ($(this).attr("id") == "share-facebook") {
                                        $(this).print("hola");
                                        $(this).attr({
                                            href: 'https://www.facebook.com/sharer/sharer.php?u=https://creativechain.net/cblock/show/content.html?ref=' + ref + '&search=' + objdata.title + ''
                                        });
                                    }
                                });



                                //$( "#ref"+idunique ).append("<p class='address'><a href='content.html?ref="+ref+"'>"+ref+"</a></p>");
                                $.each(objdata, function(key, value) {
                                    // console.log(key, value);
                                    if (key == 'title') {
                                        $("#title" + idunique).append("<a href='cblock/show/content.html?ref=" + ref + "&search=" + value + "' class='title-navbar-social'>" + value + "</a>");
                                    } else if (is_link(key)) {
                                        $("#workref" + idunique).append("<p class='address'><b>Reference Work: </b><a target='_blank' href='" + value + "'>" + value.substr(0, 50) + "</a></p>");
                                    } else if (is_torrent(key)) {
                                        $("#torrent" + idunique).append("<p class='address'><b>" + key + ": </b><a href='" + value + "'>" + value.substr(0, 50) + "</a></p>");
                                    } else if (key == 'donation') {
                                        if (value !== "") {
                                            $("#" + idunique).append("<p class='address'><b>" + key + ": </b><a target='_blank' href='https://creativechain.net/cblock/show/donate.php?address=" + value + "'>" + value.substr(0, 50) + "</a></p>");
                                        }

                                    }
                                    else if (key == 'magnetUncompressed') {
                                        console.log('Has torrent', objdata, objdata.torrentId);
                                        $("#media" + idunique).text('Loading...')
                                        // console.log("PATH NAME: ", path.resolve(__dirname)+'./torrents/'+objdata.torrentName);
                                        let fpath = './torrents/'+objdata.torrentName;
                                        if (fs.existsSync(fpath)) {
                                            client.add(value, { path: './torrents' },
                                                function (torrent) {
                                                    console.log("Tore");
                                                    torrent.on('done', function () {
                                                        torrent.files.forEach(function (file) {
                                                            client.seed(new Buffer(file), function () {
                                                                console.log("seeding");
                                                            })
                                                        })
                                                    })
                                                })
                                            console.log("ASDASDSD");
                                            $("#media" + idunique).html('<p class="address"><a href="" target="_blank" id="media-content'+idunique+'"><img src="'+fpath+'"></a></p>')
                                        }
                                        else if (client.get(objdata.torrentId)) {
                                            torrent.files.forEach(function (file) {
                                                client.seed(new Buffer(file), function () {
                                                    console.log("seeding");
                                                })
                                                console.log("file", file);
                                                $("#media" + idunique).text('')
                                                $("#media" + idunique).append('<p class="address"><a href="" target="_blank" id="media-content'+idunique+'"></a></p>')
                                                file.appendTo("#media-content" + idunique)
                                            })
                                        }
                                        else {
                                            client.add(value, { path: './torrents' },
                                                function (torrent) {
                                                    console.log("Torrent", torrent);
                                                    torrent.on('done', function () {
                                                        //  clearInterval(interval)
                                                        console.log('Progress: 100%')
                                                        //  $loading.hide(200);
                                                        torrent.files.forEach(function (file) {
                                                            console.log("file", file);
                                                            $("#media" + idunique).text('')
                                                            $("#media" + idunique).append('<p class="address"><a href="" target="_blank" id="media-content'+idunique+'"></a></p>')
                                                            file.appendTo("#media-content" + idunique)
                                                        })
                                                    })

                                                })
                                        }
                                    }
                                    else if (key == 'data') {
                                        // console.log("Data: "+key+": ", value);
                                        if (value !== null) {
                                            if (value.split('.ogg').length == 2 || value.split('.ogv').length == 2 || value.split('.flv').length == 2 || value.split('.mp4').length == 2 || value.split('.mov').length == 2) {

                                                var htmlprov = ' <video id="my-video" width="660px" class="video-js" controls preload="auto"' +
                                                    ' data-setup="{}">' +
                                                    '<source width="100%" src="https://www.creativechain.net/' + value + '" type="video/mp4">'

                                                    +
                                                    '<p class="vjs-no-js">' +
                                                    ' To view this video please enable JavaScript, and consider upgrading to a web browser that' +
                                                    '  <a href="https://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>' +
                                                    ' </p>' +
                                                    '</video>';
                                                $("#media" + idunique).append(htmlprov);
                                            } else {
                                                if (value.split('.svg').length == 2 || value.split('.png').length == 2 || value.split('.jpg').length == 2 || value.split('.bmp').length == 2 || value.split('.tif').length == 2 || value.split('.jpeg').length == 2) {
                                                    $("#media" + idunique).append("<p class='address'><a href='https://www.creativechain.net/" + value + "' target='_blank'><img src='https://www.creativechain.net/" + value + "'></a></p>");
                                                } else {
                                                    $("#media" + idunique).append("<p class='address'><a href='https://www.creativechain.net/" + value + "' target='_blank'><img width='265px' src='img/text.png'></a></p>");
                                                }
                                            }
                                        }
                                    } else if (key == 'description') {
                                        $("#blockdown" + idunique).append("<p class='address short-description'>" + value + "</p>");
                                    } else if (key == 'author') {
                                        $("#author" + idunique).append("<h4 class='sub-title'>" + value + "</h4>");
                                    } else if (key == 'number') {
                                        $("#edition" + idunique).append("<h4>" + value + "</h4><p>Edition</p>");
                                    } else if (key == 'year') {
                                        $("#year" + idunique).append("<h4>" + value + "</h4><p>Year</p>");
                                    } else if (key == 'filetype') {
                                        $("#format" + idunique).append("<h4>" + value + "</h4><p>Format</p>");
                                    } else if (key == 'license') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>License: </b><a href='httpss://creativecommons.org/licenses/'>" + value + "</a></p>");
                                    } else if (key == 'comment') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Comment: </b>" + value + "</p>");
                                    } else if (key == 'tx') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Tx: </b><a href='cblock/show/content.html?ref=" + value + "'>" + value + "</a></p>");
                                    } else if (key == 'creapack') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Amount of CREA buyed: </b>" + value + "</p>");
                                    } else if (key == 'btcaddress') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Owner address: </b>" + value + "</p>");
                                    } else if (key == 'contact') {
                                        if (value !== "") {
                                            $("#blockdown" + idunique).append("<p class='address'><b>Contact info: </b>" + value + "</p>");
                                        }
                                    } else if (key == 'contract') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Contract: </b>" + value + "</p>");
                                    } else if (key == 'pubkey') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Contractor Public Key: </b>" + value + "</p>");
                                    } else if (key == 'time') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Time in days: </b>" + value + "</p>");
                                    } else if (key == 'amount') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>CREA amount: </b>" + value + "</p>");
                                    } else if (key == 'sponsorlink') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Sponsor Link: </b><a href='" + value||'#' + "'>" + value + "</a></p>");
                                    } else if (key == 'address') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>CREA Address: </b><a href='https://search.creativechain.net/address/" + value + "'>" + value + "</a></p>");
                                    } else if (key == 'contractoraddr') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Contractor Address: </b><a href='https://search.creativechain.net/address/" + value + "'>" + value + "</a></p>");
                                    } else if (key == 'pubkey2') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Author Public Key: </b>" + value + "</p>");
                                    } else if (key == 'redeemscript') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Redeem Script: </b><pre id='redeemscript'>" + value + "</pre></p>");
                                    } else if (key == 'multiaddress') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Multisignature address: </b><a href='https://search.creativechain.net/address/" + value + "'>" + value + "</a></p>");
                                    } else if (key == 'rawtx') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Raw transaction: </b><pre>" + value + "</pre></p>");
                                    } else if (key.indexOf("member") !== -1) {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Member: </b><pre>" + value + "</pre></p>");
                                    } else {
                                        //$( "#"+idunique ).append("<p class='address'><b>"+key+": </b>"+value+"</p>");
                                    }


                                });


                                // console.log("Social", $("#" + idunique+" #buttons"));
                                // let fb = $("#" + idunique+" #buttons").find('.resp-sharing-button__link');
                                // fb.attr('href', fb.attr('href').replace('__URL__', location + '/content.html/'+ref))


                                var campaing = new Array(473749, 473749);
                                $("#blockdown" + idunique).append("<iframe data-aa='" + campaing[Math.floor((1 + Math.random()) * 0x2)] + "' src='//ad.a-ads.com/" + campaing[Math.floor((1 + Math.random()) * 0x2)] + "?size=728x15' scrolling='no' style='width:420px; height:15px; border:0px; padding:0;overflow:hidden' allowtransparency='true'></iframe>");
                                $('#loading').hide();

                            });
                        } catch (err) {
                            console.log(err);

                            $('#loading').hide();
                        }
                    }

                });
            });

            if ($("#page").html() == '1') {
                $("#back").hide();
            } else {
                $("#back").show();
            }

            if (parseInt($("#page").html()) < parseInt($("#totalresults").html())) {

                $("#next").show();
            } else {
                $("#next").hide();
            }

            $('#loading').hide();
            if ($('#output').html() == '') {
                // setTimeout(function() {
                //   findWord("", "");
                // }, 1000);


            }
        } else {
            $('#loading').hide();
            $('#output').html('no results');
        }

    });
}

function book(findword, page) {
    var wallets = localStorage.getItem("wallets");
    wallets = JSON.parse(wallets);
    let addresses = [];
    $.each(wallets, function(wif, address) {
        var keyPairs = bitcoin.ECPair.fromWIF(wif, Networks.MAINNET);
        var buffer = keyPairs.getPublicKeyBuffer();
        // addresses += keyPairs.getAddress()+', '
        addresses.push("'"+keyPairs.getAddress()+"'")
    })


    if (page == 0) {
        $("#page").html('1');
    }
    if ($("#page").html() == '1') {
        $("#back").hide();
    } else {
        $("#back").show();
    }

    if (parseInt($("#page").html()) >= parseInt($("#totalresults").html())) {
        $("#next").hide();
    } else {
        $("#next").show();
    }
    $('#output').html('');
    $('#loading').show();
    console.log("addresses book", addresses);
    trantor.findWord(findword, page, data => {
        console.log("findWord book", page);
        if (data) {
            // console.log(data);
            var objF = new Object();
            //alert(data);
            var datos = data;

            $.each(datos, function(key, value) {
                console.log('data');

                var ref = "";


                $.each(value, function(key2, value2) {
                    console.log(key2, value2);
                    // value2 = JSON.stringify(value2)
                    if (key2 == 'ref') {
                        objF[value2] = value2;
                        ref = value2;
                    }
                    if (key2 == 'count') {
                        $('#totalresults').html(Math.ceil(value2 / 10));
                    }
                    if (key2 == 'content') {
                        console.log("content");
                        var objdata;
                        try {
                            console.log(value2);
                            // console.log(JSON.parse(value2));
                            objdata = value2
                            if (typeof value2 == 'string') {
                                objdata = JSON.parse(value2);
                            }
                            //
                            // if (isObject(value2)) {
                            //   //	alert(value2);
                            // }
                            //alert(value2);
                            var obj2 = objdata;
                            var idunique = '';
                            idunique = guid();

                            var template = "";

                            if (objdata.contract == "like" || objdata.contract == "unlike" || objdata.contract == "spend" || objdata.contract == "spend" || objdata.contract == "x2x" || objdata.contract == "acceptoffer" || objdata.contract == "multiaddress" || objdata.contract == "sponsor") {
                                template = "../show/like.html";
                            } else {
                                template = "../show/media.html"
                            }


                            $("#output").append("<div id='" + idunique + "' class='publication'> ");
                            $("#" + idunique).load(template, function() {
                                $("#" + idunique + " div").each(function() {
                                    $(this).attr({
                                        id: $(this).attr("id") + idunique
                                    });
                                });
                                $("#" + idunique + " a").each(function() {
                                    $(this).attr({
                                        id: $(this).attr("id") + idunique
                                    });
                                });
                                $("#" + idunique + " h2").each(function() {
                                    $(this).attr({
                                        id: $(this).attr("id") + idunique
                                    });
                                });
                                $("#" + idunique + " .ctx").each(function() {
                                    if ($(this).attr("id") == "likebutton") {
                                        $(this).attr('src', '../../img/like.png')
                                        $(this).attr({
                                            onClick: 'like(\"' + ref + '\")'
                                        });
                                    }
                                    if ($(this).attr("id") == "unlikebutton") {
                                        $(this).attr('src', '../../img/unlike.png')
                                        $(this).attr({
                                            onClick: 'unlike(\"' + ref + '\")'
                                        });
                                    }
                                    if ($(this).attr("id") == "smartaction") {
                                        $(this).attr({
                                            onClick: 'smartaction(\"' + ref + '\")'
                                        });
                                    }
                                    if ($(this).attr("id") == "torrent"+ idunique) {
                                        $(this).find('img').attr('src', '../../img/torrent.png')
                                        $(this).attr({
                                            href: '../show/torrent.html?ref=' + ref
                                        });
                                    }

                                    if ($(this).attr("id") == "share-facebook") {
                                        $(this).print("hola");
                                        $(this).attr({
                                            href: 'https://www.facebook.com/sharer/sharer.php?u=https://creativechain.net/cblock/show/content.html?ref=' + ref + '&search=' + objdata.title + ''
                                        });
                                    }
                                });



                                //$( "#ref"+idunique ).append("<p class='address'><a href='content.html?ref="+ref+"'>"+ref+"</a></p>");
                                $.each(objdata, function(key, value) {
                                    // console.log(key, value);
                                    if (key == 'title') {
                                        $("#title" + idunique).append("<a href='cblock/show/content.html?ref=" + ref + "&search=" + value + "' class='title-navbar-social'>" + value + "</a>");
                                    } else if (is_link(key)) {
                                        $("#workref" + idunique).append("<p class='address'><b>Reference Work: </b><a target='_blank' href='" + value + "'>" + value.substr(0, 50) + "</a></p>");
                                    } else if (is_torrent(key)) {
                                        $("#torrent" + idunique).append("<p class='address'><b>" + key + ": </b><a href='" + value + "'>" + value.substr(0, 50) + "</a></p>");
                                    } else if (key == 'donation') {
                                        if (value !== "") {
                                            $("#" + idunique).append("<p class='address'><b>" + key + ": </b><a target='_blank' href='https://creativechain.net/cblock/show/donate.php?address=" + value + "'>" + value.substr(0, 50) + "</a></p>");
                                        }

                                    }
                                    else if (key == 'magnetUncompressed') {
                                        console.log('Has torrent', objdata, objdata.torrentId);
                                        $("#media" + idunique).text('Loading...')
                                        // console.log("PATH NAME: ", path.resolve(__dirname)+'./torrents/'+objdata.torrentName);
                                        let fpath = './torrents/'+objdata.torrentName;
                                        if (fs.existsSync(fpath)) {
                                            client.add(value, { path: './torrents' },
                                                function (torrent) {
                                                    console.log("Tore");
                                                    torrent.on('done', function () {
                                                        torrent.files.forEach(function (file) {
                                                            client.seed(new Buffer(file), function () {
                                                                console.log("seeding");
                                                            })
                                                        })
                                                    })
                                                })
                                            console.log("ASDASDSD");
                                            $("#media" + idunique).html('<p class="address"><a href="" target="_blank" id="media-content'+idunique+'"><img src="'+fpath+'"></a></p>')
                                        }
                                        else if (client.get(objdata.torrentId)) {
                                            torrent.files.forEach(function (file) {
                                                client.seed(new Buffer(file), function () {
                                                    console.log("seeding");
                                                })
                                                console.log("file", file);
                                                $("#media" + idunique).text('')
                                                $("#media" + idunique).append('<p class="address"><a href="" target="_blank" id="media-content'+idunique+'"></a></p>')
                                                file.appendTo("#media-content" + idunique)
                                            })
                                        }
                                        else {
                                            client.add(value, { path: './torrents' },
                                                function (torrent) {
                                                    console.log("Torrent", torrent);
                                                    torrent.on('done', function () {
                                                        //  clearInterval(interval)
                                                        console.log('Progress: 100%')
                                                        //  $loading.hide(200);
                                                        torrent.files.forEach(function (file) {
                                                            console.log("file", file);
                                                            $("#media" + idunique).text('')
                                                            $("#media" + idunique).append('<p class="address"><a href="" target="_blank" id="media-content'+idunique+'"></a></p>')
                                                            file.appendTo("#media-content" + idunique)
                                                        })
                                                    })

                                                })
                                        }
                                    }
                                    else if (key == 'data') {
                                        // console.log("Data: "+key+": ", value);
                                        if (value !== null) {
                                            if (value.split('.ogg').length == 2 || value.split('.ogv').length == 2 || value.split('.flv').length == 2 || value.split('.mp4').length == 2 || value.split('.mov').length == 2) {

                                                var htmlprov = ' <video id="my-video" width="660px" class="video-js" controls preload="auto"' +
                                                    ' data-setup="{}">' +
                                                    '<source width="100%" src="https://www.creativechain.net/' + value + '" type="video/mp4">'

                                                    +
                                                    '<p class="vjs-no-js">' +
                                                    ' To view this video please enable JavaScript, and consider upgrading to a web browser that' +
                                                    '  <a href="https://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>' +
                                                    ' </p>' +
                                                    '</video>';
                                                $("#media" + idunique).append(htmlprov);
                                            } else {
                                                if (value.split('.svg').length == 2 || value.split('.png').length == 2 || value.split('.jpg').length == 2 || value.split('.bmp').length == 2 || value.split('.tif').length == 2 || value.split('.jpeg').length == 2) {
                                                    $("#media" + idunique).append("<p class='address'><a href='https://www.creativechain.net/" + value + "' target='_blank'><img src='https://www.creativechain.net/" + value + "'></a></p>");
                                                } else {
                                                    $("#media" + idunique).append("<p class='address'><a href='https://www.creativechain.net/" + value + "' target='_blank'><img width='265px' src='img/text.png'></a></p>");
                                                }
                                            }
                                        }
                                    } else if (key == 'description') {
                                        $("#blockdown" + idunique).append("<p class='address short-description'>" + value + "</p>");
                                    } else if (key == 'author') {
                                        $("#author" + idunique).append("<h4 class='sub-title'>" + value + "</h4>");
                                    } else if (key == 'number') {
                                        $("#edition" + idunique).append("<h4>" + value + "</h4><p>Edition</p>");
                                    } else if (key == 'year') {
                                        $("#year" + idunique).append("<h4>" + value + "</h4><p>Year</p>");
                                    } else if (key == 'filetype') {
                                        $("#format" + idunique).append("<h4>" + value + "</h4><p>Format</p>");
                                    } else if (key == 'license') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>License: </b><a href='httpss://creativecommons.org/licenses/'>" + value + "</a></p>");
                                    } else if (key == 'comment') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Comment: </b>" + value + "</p>");
                                    } else if (key == 'tx') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Tx: </b><a href='cblock/show/content.html?ref=" + value + "'>" + value + "</a></p>");
                                    } else if (key == 'creapack') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Amount of CREA buyed: </b>" + value + "</p>");
                                    } else if (key == 'btcaddress') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Owner address: </b>" + value + "</p>");
                                    } else if (key == 'contact') {
                                        if (value !== "") {
                                            $("#blockdown" + idunique).append("<p class='address'><b>Contact info: </b>" + value + "</p>");
                                        }
                                    } else if (key == 'contract') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Contract: </b>" + value + "</p>");
                                    } else if (key == 'pubkey') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Contractor Public Key: </b>" + value + "</p>");
                                    } else if (key == 'time') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Time in days: </b>" + value + "</p>");
                                    } else if (key == 'amount') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>CREA amount: </b>" + value + "</p>");
                                    } else if (key == 'sponsorlink') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Sponsor Link: </b><a href='" + value||'#' + "'>" + value + "</a></p>");
                                    } else if (key == 'address') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>CREA Address: </b><a href='https://search.creativechain.net/address/" + value + "'>" + value + "</a></p>");
                                    } else if (key == 'contractoraddr') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Contractor Address: </b><a href='https://search.creativechain.net/address/" + value + "'>" + value + "</a></p>");
                                    } else if (key == 'pubkey2') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Author Public Key: </b>" + value + "</p>");
                                    } else if (key == 'redeemscript') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Redeem Script: </b><pre id='redeemscript'>" + value + "</pre></p>");
                                    } else if (key == 'multiaddress') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Multisignature address: </b><a href='https://search.creativechain.net/address/" + value + "'>" + value + "</a></p>");
                                    } else if (key == 'rawtx') {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Raw transaction: </b><pre>" + value + "</pre></p>");
                                    } else if (key.indexOf("member") !== -1) {
                                        $("#blockdown" + idunique).append("<p class='address'><b>Member: </b><pre>" + value + "</pre></p>");
                                    } else {
                                        //$( "#"+idunique ).append("<p class='address'><b>"+key+": </b>"+value+"</p>");
                                    }


                                });

                                var campaing = new Array(473749, 473749);
                                $("#blockdown" + idunique).append("<iframe data-aa='" + campaing[Math.floor((1 + Math.random()) * 0x2)] + "' src='//ad.a-ads.com/" + campaing[Math.floor((1 + Math.random()) * 0x2)] + "?size=728x15' scrolling='no' style='width:420px; height:15px; border:0px; padding:0;overflow:hidden' allowtransparency='true'></iframe>");
                                $('#loading').hide();

                            });

                        } catch (err) {
                            console.log(err);

                            $('#loading').hide();
                        }
                    }

                });
            });

            if ($("#page").html() == '1') {
                $("#back").hide();
            } else {
                $("#back").show();
            }

            if (parseInt($("#page").html()) < parseInt($("#totalresults").html())) {

                $("#next").show();
            } else {
                $("#next").hide();
            }

            $('#loading').hide();
            if ($('#output').html() == '') {
                // setTimeout(function() {
                //   findWord("", "");
                // }, 1000);


            }
        } else {
            $('#loading').hide();
            $('#output').html('no results');
        }
    }, addresses.join(', '));
}

function opentimestamps(form){
    const OpenTimestamps = require('javascript-opentimestamps');
    var values = {};
    $('#publishbtn').prop("disabled", true );

    $.each(form.serializeArray(), function(i, field) {
        console.log(field);
        values[field.name] = field.value;
    });

    const file = Buffer.from(JSON.stringify(values));
    const stampResultPromise = OpenTimestamps.stamp(file);
    stampResultPromise.then(stampResult => {
        // console.log("stampResult", stampResult);
        const infoResult = OpenTimestamps.info(stampResult);
        console.log(infoResult);
        values.opentimestamp = infoResult;
        sendTxOp(0.002, 0.002, JSON.stringify(values), function (response) {
            $('#loading2').hide();
            $('.message_published').html('<p>Published correctly</p>')
            console.log("response", response);
            if (cback && typeof cback == 'function') {
                cback(response);
            }
        })
    });
}

function is_link(obj) {
    if (obj == 'link') {
        return true;
    } else {
        return false;
    }

}

function is_torrent(obj) {
    if (obj == 'torrent_link') {
        return true;
    } else {
        return false;
    }
}

function is_data(obj) {
    return false;
}

function JSONstringify(json) {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, '\t');
    }

    var
        arr = [],
        _string = 'color:green',
        _number = 'color:darkorange',
        _boolean = 'color:blue',
        _null = 'color:magenta',
        _key = 'color:red';

    json = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
        var style = _number;
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                style = _key;
            } else {
                style = _string;
            }
        } else if (/true|false/.test(match)) {
            style = _boolean;
        } else if (/null/.test(match)) {
            style = _null;
        }
        arr.push(style);
        arr.push('');
        return '%c' + match + '%c';
    });

    arr.unshift(json);
    return arr;
    console.log.apply(console, arr);
}

function addmember() {

    $("#member").append('<div id="member' + (parseFloat($("#nm").html()) + 1) + '" class="member"><input class="custom-input" type="text" name="member' + (parseFloat($("#nm").html()) + 1) + '" placeholder="Name Member ' + (parseFloat($("#nm").html()) + 1) + ' or ID (Not required)"><input class="custom-input" type="text" name="pubkey' + (parseFloat($("#nm").html()) + 1) + '" placeholder="Public Address"></div>');
    $("#nm").html(parseFloat($("#nm").html()) + 1);
}

function addsign() {

    $("#signs").append('<div id="sign' + (parseFloat($("#ns").html()) + 1) + '" class="member"><input class="custom-input" type="text" name="title2" placeholder="Name Member 2 or ID (Not required)"><input class="custom-input" type="text" name="address2" placeholder="Public Address"></div>');

}

function getRef(ref) {
    $("#ns").html(parseFloat($("#ns").html()) + 1);
    // TODO: test trantor.findOp
    // trantor.findOp(ref, function () {
    $.post("https://creativechain.net/api.php", {
        CUR: $("#cur").html(),
        "find": ref,
        "action": "findOp"
    }, function(data) {
        var objdata = JSON.parse(data);
        $('#transactions').html('');
        $("#ref-info-modal").modal();
        $.each(objdata, function(key, value) {
            $('#date').html(value['date']);

            $('#rawcontent').html(value['raw']);
            $('#amount').html(value['raw']['amount']);
            $('#fee').html(value['raw']['fee']);
            $('#txid').html(value['raw']['txid']);
            $('#decoderawi').html("");
            $.each(value['decode']['vin'], function(keyn, valuen) {
                $('#decoderawi').append("<a href='content.html?ref=" + valuen["txid"] + "'>" + valuen["txid"] + "</a><br>");
            });
            //$("#imgraw").qrcode({
            //	fill: "#4C4743",
            //	background: null,
            //	text: value['ref']
            //});
            $('#decoderawo').html("");
            $.each(value['decode']['vout'], function(keyn, valuen) {
                $('#decoderawo').append(valuen["value"] + "<br>");
                if (valuen["scriptPubKey"]["addresses"]) {
                    $.each(valuen["scriptPubKey"]["addresses"], function(keyn, valuen) {
                        $('#decoderawo').append("<a href='address.html?addr=" + valuen + "'>" + valuen + "</a><br>");
                    });
                } else {
                    $('#decoderawo').append("Fee <br>");
                }

            });


            //$('#decoderawo').html(JSON.stringify(value['decode']['vout'][0]));
            //$('#address').html(JSON.stringify(value['decode']['vout']));
        });

        //alert(JSON.stringify(objdata));
    });

}

function getAddr(addr) {
    $("#ns").html(parseFloat($("#ns").html()) + 1);
    $.post( "https://creativechain.net/api.php",{CUR : $("#cur").html() , "find": addr, "action":"findaddr"}, function( data ) {
        // TODO test trantor.findaddr
        // trantor.findaddr(addr, function(data) {

        var objdata = JSON.parse(data);
        $('#transactions').html('');
        $("#ref-info-modal").modal();
        $.each(objdata, function(key, value) {
            $('#date').html(value['date']);

            $('#rawcontent').html(value['raw']);
            $('#amount').html(value['raw']['amount']);
            $('#fee').html(value['raw']['fee']);
            $('#txid').html(value['raw']['txid']);
            $('#decoderawi').html("");
            $.each(value['decode']['vin'], function(keyn, valuen) {
                $('#decoderawi').append("<a href='content.html?ref=" + valuen["txid"] + "'>" + valuen["txid"] + "</a><br>");
            });
            //$("#imgraw").qrcode({
            //	fill: "#4C4743",
            //	background: null,
            //	text: value['ref']
            //});
            $('#decoderawo').html("");
            $.each(value['decode']['vout'], function(keyn, valuen) {
                $('#decoderawo').append(valuen["value"] + "<br>");
                if (valuen["scriptPubKey"]["addresses"]) {
                    $.each(valuen["scriptPubKey"]["addresses"], function(keyn, valuen) {
                        $('#decoderawo').append("<a href='address.html?addr=" + valuen + "'>" + valuen + "</a><br>");
                    });
                } else {
                    $('#decoderawo').append("Fee <br>");
                }

            });


            //$('#decoderawo').html(JSON.stringify(value['decode']['vout'][0]));
            //$('#address').html(JSON.stringify(value['decode']['vout']));
        });

        //alert(JSON.stringify(objdata));
    });

}

function getblocks(blockhash) {
    $("#ns").html(parseFloat($("#ns").html()) + 1);
    $.post("https://creativechain.net/api.php", {
        CUR: $("#cur").html(),
        "find": blockhash,
        "action": "getblocks"
    }, function(data) {
        var objdata = JSON.parse(data);
        console.log(JSON.stringify(objdata));
        $('#blocks').html("");

        $.each(objdata, function(key, value) {

            if (blockhash.length > 10) {
                $('#blocks').append("<span>" + timeConverter(value['date']) + "</span> &nbsp;&nbsp;<a href='https://search.creativechain.net/tx/" + value['tx'] + "'>" + value['tx'] + "</a><br>");
                $('#blocktitle').html("Last transactions in block");
                $('#blocktitle2').html(blockhash);
            } else {
                $('#blocks').append("<span>" + timeConverter(value['date']) + "</span> &nbsp;&nbsp;<a href='block.php?block=" + value['blockhash'] + "'>" + value['blockhash'] + "</a><br>");

            }

        });

    });

}

function timeConverter(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp * 1000);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
    return time;
}

function getData(ref) {
    // TODO: test getData
    trantor.getData(ref, function(data) {
        // $.post( "https://creativechain.net/api.php",{CUR : $("#cur").html() , "ref": ref, "action":"getData"}, function( data ) {
        if (data != '') {
            // alert(data);
            console.log(data);

            var objdata = data;
            //alert(JSON.stringify(objdata.content));
            //var obj2=JSON.parse(objdata.content);
            var obj2 = objdata;
            var idunique = '';
            idunique = guid();
            $.each(objdata['transactions'], function(key, value) {
                $("#certificate").append('<a href="https://search.creativechain.net/tx/' + value + '">' + value + '</a><br>');
            });
            $("#output").prepend("" +
                "<div id='" + idunique + "' class='publication'>" +
                "<div id='reg" + idunique + "'></div>" +
                "<div id='img" + idunique + "'></div>" +
                "<div id='title" + idunique + "'></div>" +
                "<div id='author" + idunique + "'></div>" +
                "<div id='year" + idunique + "'></div>" +
                "<div id='edition" + idunique + "'></div>" +
                "<div id='format" + idunique + "'></div>" +
                "<div id='description" + idunique + "'></div>" +
                "<div id='workref" + idunique + "'></div>" +
                "<div id='license" + idunique + "'></div>" +
                "<div id='date" + idunique + "'></div>" +
                "<div id='contact" + idunique + "'></div>" +
                "<div id='relworks" + idunique + "'></div>" +
                "<div id='donate" + idunique + "'></div>" +
                "</div>" +
                "</div>");

            $("#reg" + idunique).append("<p class='address'><a href='#' onClick='getRef(\"" + ref + "\");'>" + ref + "</a><a href='#' data-toggle='modal' data-target='#cmodal' id='show-ref-modal'><img src='../../img/like.png'></a><img src='../../img/unlike.png'><img src='../../img/certificate-.png' height='20px'></p>");
            $.each(objdata['content'], function(key, value) {
                //alert(idunique);
                if (key == 'title') {
                    $("#title" + idunique).append("<p class='address'><h2><a href='cblock/show/content.html?ref=" + ref + "&search=" + value + "' style='font-size:20px'>" + value + "</a></h2></p>");
                } else if (is_link(key)) {
                    $("#workref" + idunique).append("<p class='address'><b>Reference Work: </b><a target='_blank' href='" + value + "'>" + value.substr(0, 50) + "</a></p>");
                } else if (is_torrent(key)) {
                    $("#torrent" + idunique).append("<p class='address'><b>" + key + ": </b><a href='" + value + "'>" + value.substr(0, 50) + "</a></p>");
                } else if (key == 'donation') {
                    $("#authoraddress").val(value);
                    $("#donate" + idunique).append("<p class='address'><b>" + key + ": </b><a id='addrcontract' target='_blank' href='https://creativechain.net/cblock/show/donate.php?address=" + value + "'>" + value.substr(0, 50) + "</a></p>");
                }
                else if (key == 'magnetUncompressed') {
                    console.log('Has torrent', objdata, objdata.torrentId);
                    $("#img" + idunique).text('Loading...')
                    // console.log("PATH NAME: ", path.resolve(__dirname)+'./torrents/'+objdata.torrentName);
                    let fpath = './torrents/'+objdata.torrentName;
                    if (fs.existsSync(fpath)) {
                        client.add(value, { path: './torrents' },
                            function (torrent) {
                                console.log("Tore");
                                torrent.on('done', function () {
                                    torrent.files.forEach(function (file) {
                                        client.seed(new Buffer(file), function () {
                                            console.log("seeding");
                                        })
                                    })
                                })
                            })
                        console.log("ASDASDSD");
                        $("#img" + idunique).html('<p class="address"><a href="" target="_blank" id="media-content'+idunique+'"><img src="'+fpath+'"></a></p>')
                    }
                    else if (client.get(objdata.torrentId)) {
                        torrent.files.forEach(function (file) {
                            client.seed(new Buffer(file), function () {
                                console.log("seeding");
                            })
                            console.log("file", file);
                            $("#img" + idunique).text('')
                            $("#img" + idunique).append('<p class="address"><a href="" target="_blank" id="media-content'+idunique+'"></a></p>')
                            file.appendTo("#media-content" + idunique)
                        })
                    }
                    else {
                        client.add(value, { path: './torrents' },
                            function (torrent) {
                                console.log("Torrent", torrent);
                                torrent.on('done', function () {
                                    //  clearInterval(interval)
                                    console.log('Progress: 100%')
                                    //  $loading.hide(200);
                                    torrent.files.forEach(function (file) {
                                        console.log("file", file);
                                        $("#img" + idunique).text('')
                                        $("#img" + idunique).append('<p class="address"><a href="" target="_blank" id="media-content'+idunique+'"></a></p>')
                                        file.appendTo("#media-content" + idunique)
                                    })
                                })

                            })
                    }
                }
                else if (key == 'data') {
                    if (value.split('.ogg').length == 2 || value.split('.mp4').length == 2) {

                        var htmlprov = ' <video id="my-video" class="video-js" controls preload="auto" width="655"' +
                            ' data-setup="{}">' +
                            '<source src="https://creativechain.net/' + value + '" type="video/mp4">'

                            +
                            '<p class="vjs-no-js">' +
                            ' To view this video please enable JavaScript, and consider upgrading to a web browser that' +
                            '  <a href="https://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>' +
                            ' </p>' +
                            '</video>';
                        $("#img" + idunique).append(htmlprov);
                    } else {
                        if (value.split('.svg').length == 2 || value.split('.png').length == 2 || value.split('.jpg').length == 2 || value.split('.bmp').length == 2 || value.split('.tif').length == 2 || value.split('.jpeg').length == 2) {
                            $("#img" + idunique).append("<p class='address'><a href='https://www.creativechain.net/" + value + "' target='_blank'><img width='665px' src='https://creativechain.net/" + value + "'></a></p>");
                        } else {
                            $("#img" + idunique).append("<p class='address'><a href='https://www.creativechain.net/" + value + "' target='_blank'><img width='665px' src='../../img/text.png'></a></p>");
                        }
                    }


                } else if (key == 'description') {
                    $("#description" + idunique).append("<p class='address'>" + value + "</p>");
                } else if (key == 'author') {
                    $("#author" + idunique).append("<p class='address'><b>Author: </b>" + value + "</p>");
                } else if (key == 'number') {
                    $("#edition" + idunique).append("<p class='address'><b>Edition: </b>" + value + "</p>");
                } else if (key == 'year') {
                    $("#year" + idunique).append("<p class='address'><b>Year: </b>" + value + "</p>");
                } else if (key == 'filetype') {
                    $("#format" + idunique).append("<p class='address'><b>Format: </b>" + value + "</p>");
                } else if (key == 'license') {
                    $("#license" + idunique).append("<p class='address'><b>License: </b><a href='httpss://creativecommons.org/licenses/'>" + value + "</a></p>");
                } else if (key == 'contact') {
                    $("#" + idunique).append("<p class='address'><b>Contact: </b>" + value + "</p>");
                } else if (key == 'hash') {
                    $("#" + idunique).append("<p class='address'><b>Hash Certificate: </b>" + value + "</p>");
                } else if (key == 'contract') {
                    $("#" + idunique).append("<p class='address'><b>Contract: </b>" + value + "</p>");
                } else if (key == 'pubkey') {
                    $("#" + idunique).append("<p class='address'><b >Contractor Public Key: </b><span id='contractorpubkey'>" + value + "</span></p>");
                } else if (key == 'time') {
                    $("#" + idunique).append("<p class='address'><b>Time in days: </b>" + value + "</p>");
                } else if (key == 'amount') {
                    $("#" + idunique).append("<p class='address'><b>CREA amount: </b>" + value + "</p>");
                } else if (key == 'sponsorlink') {
                    $("#" + idunique).append("<p class='address'><b>Sponsor Link: </b><a href='" + value + "'>" + value + "</a></p>");
                } else if (key == 'address') {
                    $("#" + idunique).append("<p class='address'><b>CREA Address: </b><a id='authoraddr' href='https://search.creativechain.net/address/" + value + "'>" + value + "</a></p>");
                } else if (key == 'contractoraddr') {
                    $("#" + idunique).append("<p class='address'><b>Contractor Address: </b><a href='https://search.creativechain.net/address/" + value + "'>" + value + "</a></p>");
                } else if (key == 'pubkey2') {
                    $("#" + idunique).append("<p class='address'><b>Public Key: </b><span id='pubkey2'>" + value + "</span></p>");
                } else if (key == 'redeemscript') {
                    $("#" + idunique).append("<p class='address'><b>Redeem Script: </b><span><pre id='redeemscript'>" + value + "</pre></span></p>");
                } else if (key == 'multiaddress') {
                    $("#" + idunique).append("<p class='address'><b>Multisignature address: </b><a id='multiaddress' href='https://search.creativechain.net/address/" + value + "'>" + value + "</a></p>");
                } else if (key == 'rawtx') {
                    $("#blockdown" + idunique).append("<p class='address'><b>Raw transaction: </b><pre>" + value + "</pre></p>");
                }
                else if (key == 'members') {
                    $('#members').val(value);
                }
                else {
                    //$( "#"+idunique ).append("<p class='address'><b>"+key+": </b>"+value+"</p>");
                }
            });

        } else {
            $('#output').html('no results');
        }

        if ($("#page").html() == '1') {
            $("#back").hide();
        } else {
            $("#back").show();
        }

        if (parseInt($("#page").html()) < parseInt($("#totalresults").html())) {
            $("#next").show();
        } else {
            $("#next").hide();
        }
        $('#loading').hide();
    });
}

function loading() {
    $("#cmodal").modal();
    $("#modaltitle").html("Uploading content in CREA blockchain ....");
    $(".modal-footer").html("");
    $(".modal-body").html("<img src='img/496.GIF'>");

}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

var data;
var data2;
var time;


function getAddress() {
    $.post('https://creativechain.net/api.php', {
        CUR: $("#cur").html(),
        action: 'getAddress',
        datos: document.getElementById('datos').value
    }, function(data) {
        data = $.parseJSON(data);
        console.log(data);
        $('#address').html(data.address);
        $('#amount').html(data.price);
        $('#price').html(data.price);
        $("#qrmodal-max").qrcode({
            fill: "#4C4743",
            background: null,
            text: "crea:" + data.address + "?amount=" + data.price + "&label=Creativecoin"
        });

        storeData(data.address);
    });

}

var time;

function storeData(address) {
    $.post("https://creativechain.net/api.php", {
        CUR: $("#cur").html(),
        action: 'check',
        address: address,
        datos: $("#datos").val()
    }, function(data) {
        time = setInterval(function() {
            checkPayment();
        }, 30000);
    });
}

function smartdeal() {
    var inputs = new Object();
    $("input").each(function() {

        inputs[$(this).attr("name")] = $(this).val();
    });

    $("select").each(function() {

        inputs[$(this).attr("name")] = $(this).val();
    });
    // TODO: test trantor.smartdeal
    console.log("inputs", inputs);
    trantor.smartdeal(inputs, function (datos) {
        // $.post("https://creativechain.net/api.php", {
        //   CUR: $("#cur").html(),
        //   action: 'smartdeal',
        //   datos: inputs
        // }, function(data) {
        console.log(datos);
        // var datos = JSON.parse(data);
        // var datos = JSON.parse(datos);

        $("#multiaddressshow").html(datos.result['address']);
        $("#redeemscript").html(datos.result.redeemScript);
        $("#multiaddressinput").val(datos.result.address);
        $("#redeeminput").val(datos.result.redeemScript);
        $("#multiaddrqr").qrcode({
            fill: "#4C4743",
            background: null,
            text: datos.result.address
        });
        document.getElementById("multiaddressbody").style = 'display:block';

    });
}

function sponsorcontract() {
    var inputs = new Object();
    $("#contractorpubkeyi").val($("#contractorpubkey").text());
    $("#contractoraddri").val($("#contractoraddr").text());
    $("input").each(function() {

        inputs[$(this).attr("name")] = $(this).val();
    });
    inputs['address2'] = $("#contractoraddr").text();
    //inputs['pubkey2']=$("#contractorpubkey").text();
    // TODO test trantor.smartdeal
    trantor.smartdeal(inputs, function (data) {
        // $.post("https://creativechain.net/api.php", {
        //   CUR: $("#cur").html(),
        //   action: 'smartdeal',
        //   datos: inputs
        // }, function(data) {

        var datos = data
        // datos = JSON.parse(datos);
        document.getElementById("multiaddressbody").style = 'display:block';

        $("#multiaddress").html(datos.result.address);
        $("#redeemscript").html(datos.result.redeemScript);
        $("#multiaddressinput").val(datos.result.address);
        $("#redeeminput").val(datos.result.redeemScript);
        $("#maddressQR").qrcode({
            fill: "#4C4743",
            background: null,
            text: datos.result.address
        });

    });

}

function acceptoffer() {
    sendForm($("#form"), function (result) {
        $('#message').append('<p>Created multiadress successfully</p>')
    })
}

function checkPayment() {

    if (address != '') {
        $.post("https://creativechain.net/api.php", {
            CUR: $("#cur").html(),
            action: 'check'
        }, function(data) {
            data2 = $.parseJSON(data);
            if (data2.btc == 'undefined') {
                data2.btc = "0";
            }

            $('#balance').html(data2.CREA + ' CREA');
            if (data2.payment == 'ok') {

                var transactions = JSON.parse(data2.transactions);
                $.each(transactions.txids, function(key, value) {
                    $("#optx").before("<p>" + value + "</p>");
                });
                //$("#optx").html(JSON.stringify(transactions));
                var ref = JSON.parse(data2.ref);
                $("#opid").html(JSON.stringify(ref.ref));
                $("#waitingPayment").hide();
                $("#paymentOk").show();
                clearInterval(time);
            }

        });
    }


}

function tabs(tab) {
    $("#book").hide();
    $("#cjson").hide();
    $("#multiaddress").hide();
    $("#stealth").hide();
    $("#ots").hide();
    $("#send").hide();
    $("#history").hide();
    $("#wallet").hide();
    $("#" + tab).show();
}

function qrwif(wif) {
    $("#qr").html("");
    $("#qr").qrcode({
        fill: "#4C4743",
        background: null,
        text: wif
    });
    $('#privateKeyTitle').html(wif);

}
//GET WALLETS
function status() {
    $("#wifs").html("");
    $("#addresses").html("");
    if (!localStorage.getItem("wallets")) {
        newWIF()
    }
    console.log(localStorage);
    var wallets = localStorage.getItem("wallets");
    wallets = JSON.parse(wallets);
    $.each(wallets, function(wif, address) {

        var keyPairs = bitcoin.ECPair.fromWIF(wif, Networks.MAINNET);
        var buffer = keyPairs.getPublicKeyBuffer();
        $("#addresses").append("" +
            "<div class='row'>" +
            "<div class='col-md-6'>" +
            "<p>" +
            "<button id='button" + wif + "' type='button' class='btn btn-primary ctx' data-toggle='modal' data-target='#privateKey' onclick='qrwif(\"" + wif + "\")'> Private Key</button>" +
            "<span id='amount" + address + "'></span>" +
            "</p> <span class='pkey' style='font-weight:bold;'>Address:</span><a href='#' onClick='getTransactions(this.innerHTML)'>" + address + "</a> " +
            "<br><span class='pkey' style='font-weight:bold;'>Public Key:</span> " + buffer.toString('hex') +
            "</div>" +
            "<div class='col-md-6 text-right'>" +
            "<div class='img-qr' id='qr" + address + "'></div>" +
            "</div>" +
            "</div>");
        $("#qr" + address).qrcode({
            fill: "#4C4743",
            background: null,
            text: address
        });

        $.get('https://search.creativechain.net/ext/getbalance/' + address, function(data) {
            $('#loading3').hide(200)
            console.log(data);
            $("#amount" + address).html(" <button type='button' class='btn btn-primary ctx' id='amount" + address + "'>" + ((typeof data == 'number') ? data: 0) + " Crea</button>");
        });
    });

}

function delwallets() {

    localStorage.removeItem("wallets");
}
//NEW WALLET ADDRESS
// TODO
function newWIF() {

    var creativecoin = Networks.MAINNET;
    var keyPair = bitcoin.ECPair.makeRandom({
        network: creativecoin
    });
    var wif = keyPair.toWIF();
    var address = keyPair.getAddress();

    //alert(JSON.stringify(localStorage.getItem("wallets")));
    if (localStorage.getItem('wallets') !== null) {
        var wallets = localStorage.getItem("wallets");
        wallets = JSON.parse(wallets);
    } else {
        var wallets = new Object();
    }

    wallets[wif] = address;
    localStorage.setItem("wallets", JSON.stringify(wallets));

    status();
}

//GET TRANSACTIONS FROM ADDRESS
function getTransactions(address) {
    $("#status").html('');
    $("#address").html("");

    tabs('history');
    // trantor.getAddress(address, function(data) {
    $.get('https://search.creativechain.net/ext/getaddress/' + address, function(data) {
        //alert(JSON.stringify(data);
        console.log(data);
        $.each(data, function(key, value) {
            //alert(value);
            if (key == "last_txs") {
                $.each(value, function(key2, value2) {

                    $("#status").append("" +
                        "<div class='row'>" +
                        "<div class='col-md-12 row-tx'>" +
                        "<p class=''><strong>tx: </strong><span class=''>" + value2.addresses + " </span></p>" +
                        "</div>" +
                        "</div>" +
                        "<div class='row'>" +
                        "<div class='col-md-12'>" +
                        "<span class=''> " + value2.type + " </span>" +
                        "<br>" +
                        "<div id='statustx" + value2.addresses + "'><div>" +
                        "</div>" +
                        "</div>");

                    trantor.getDecodedTransaction(value2.addresses, function (data2) {
                        // $.get('https://search.creativechain.net/api/getrawtransaction?txid=' + value2.addresses + '&decrypt=1', function(data2) {

                        $('#statustx' + value2.addresses).jsonViewer(data2, {
                            collapsed: true,
                            withQuotes: true
                        });

                    });
                });

            } else {
                if (key == "address") {
                    $("#address").html("");
                    $("#address").append("<span class=''>Address History </span><span class=''>" + value + " </span><br>");
                }
                if (key == "balance") {
                    $("#balance").html("");
                    $("#balance").append("<h4 class=''>" + key + " </h4><h4 class='color-primary'>" + value + " </h4>");
                }
                if (key == "sent") {
                    $("#sent").html("");
                    $("#sent").append("<h4 class=''>" + key + " </h4><h4 class='color-primary'>" + value + " </h4>");
                }
                if (key == "received") {
                    $("#received").html("");
                    $("#received").append("<h4 class=''>" + key + " </h4><h4 class='color-primary'>" + value + " </h4>");
                }

            }
        });
    });
}

//SEND TRANSACTION
//TODO
function sendTx(addr, amount, fee) {
    //GET UNSPENt TRANSACTIONS FROM WALLETS AS NEW INPUTS
    var wallets = localStorage.getItem("wallets");
    wallets = JSON.parse(wallets);
    var network = Networks.MAINNET;
    var tx = new bitcoin.TransactionBuilder(network);
    var i = 0;
    var sum = 0;
    var lastwif = "";
    var countInputs = 0;
    var wifsigns = new Object();
    $.each(wallets, function(wif, address) {
        console.log("address", wif, address);
        // TODO: needs listunspent
        trantor.listunspent(address, data => {
            console.log(data);
            if (data !== "null") {
                $.each(data, function(key, value) {
                    console.log("Unspent", key, value);
                    if (key !== "total") {
                        //alert(key);
                        //alert(JSON.stringify(value)+ " pepe " + value.amount);
                        console.log("Sum", sum, "amount", amount, "fee", fee, parseFloat(amount) + parseFloat(fee));
                        if (parseFloat(sum) <= (parseFloat(amount) + parseFloat(fee))) {
                            tx.addInput(key, value.index);
                            var creativecoin = Networks.MAINNET;

                            var keyPair = bitcoin.ECPair.fromWIF(wif, creativecoin);
                            //alert(JSON.stringify(keyPair));
                            wifsigns[i] = keyPair;
                            //alert(i);
                            sum = sum + parseFloat(value.amount);
                            i++;
                            lastwif = address;
                            console.log(value.hash + ' ' + address + ' ' + sum + ' ' + i + ' ' + (amount + fee));
                        }
                    }
                });
            }
        });
        countInputs++;
    });

    console.log("available: "+sum, amount);
    setTimeout(function() {
        if (countInputs == Object.keys(wallets).length) {
            if (parseFloat(sum) == (parseFloat(amount) + parseFloat(fee))) {
                tx.addOutput(addr, parseFloat(amount) * 100000000);
            } else {
                tx.addOutput(addr, parseFloat(amount) * 100000000);
                tx.addOutput(lastwif, parseFloat(sum) * 100000000 - (parseFloat(amount) + parseFloat(fee)) * 100000000);
            }
            $.each(wifsigns, function(key, value) {
                tx.sign(parseFloat(key), wifsigns[key]);
            });

            var txBuilt = tx.build();

            alert(tx.build().toHex());
            console.log(tx.build().toHex());
            console.log(txBuilt.getId());

            // TODO: test pushTx
            trantor.pushTx(tx.build().toHex(), function(response){
                // $.post("https://creativechain.net/api.php", {
                //   "action": "sendtransaction",
                //   "tx": tx.build().toHex()
                // }, function(response) {
                //TRANSACTION RESULT AFTER PUSH
                console.log("pushTx response", response);
                // alert(JSON.stringify(response));
                $('#send_message').text('Sent funds correctly, txid ['+response+']')

            });
        }
    }, 10000);
}



//TODO
function sendTxOp(amount, fee, data, cback) {
    var network = Networks.MAINNET;
    var keyPair = bitcoin.ECPair.makeRandom({
        network: network
    });
    var addr = keyPair.getAddress();
    var nTx = Math.ceil(data.length / 1024);
    var hasDoneUnspent = false;
    var iTx = 0;
    console.log("ntx", nTx);
    while (iTx < nTx) {
        let itx_ = iTx+0;
        // setTimeout(function() {
        var dataI = '-CREAv1-'+data.substr(itx_ * 1024, 1016);
        console.log(itx_, dataI, data.substr(itx_ * 1024, 1024));
        //GET UNSPENt TRANSACTIONS FROM WALLETS AS NEW INPUTS
        var wallets = localStorage.getItem("wallets");
        wallets = JSON.parse(wallets);
        var tx = new bitcoin.TransactionBuilder(network);
        var i = 0;
        var sum = 0;
        var lastwif = "";
        var countInputs = 0;
        var wifsigns = new Object();
        if (!hasDoneUnspent) {
            $.each(wallets, function(wif, address) {
                // TODO: needs listunspent
                console.log(wif, address);
                // $.get('https://api.blocktrail.com/v1/BTC/address/'+address+'/unspent-outputs?api_key=bea2c111efdd2e5e19b3e77eff492169b38d843d',function(address_utxo) {
                trantor.listunspent(address, (data) => {
                    hasDoneUnspent = true;
                    console.log('unspent', data);
                    $.each(data, function(key, value) {
                        console.log("key", key, value);
                        if (key !== "total") {
                            //alert(key);
                            //alert(JSON.stringify(value)+ " pepe " + value.amount);
                            if (parseFloat(sum) <= parseFloat(amount + fee)) {
                                tx.addInput(key, value.index);
                                var creativecoin = Networks.MAINNET;

                                var keyPair = bitcoin.ECPair.fromWIF(wif, creativecoin);
                                //alert(JSON.stringify(keyPair));
                                wifsigns[i] = keyPair;
                                //alert(i);
                                sum = sum + parseFloat(value.amount);
                                i++;
                                lastwif = address;
                                console.log(value.hash + ' ' + address + ' ' + sum + ' ' + i + ' ' + (amount + fee));
                            }
                        }
                    });
                    countInputs++;
                });
            });
        }

        setTimeout(function () {
            var datas = new buffer.Buffer(dataI);
            var dataScript = bitcoin.script.nullDataOutput(datas);
            data = data.replace(dataI, "");
            // console.log(data);

            setTimeout(function() {
                if (sum < amount) {
                    throw 'No inputs available'
                }
                // if (countInputs >= Object.keys(wallets).length) {
                if (parseFloat(sum) == (parseFloat(amount) + parseFloat(fee))) {
                    tx.addOutput(addr, parseFloat(amount) * 100000000);
                } else {
                    console.log('Ampunt', amount, parseInt(amount  * 100000000));
                    tx.addOutput(addr, parseInt(amount  * 100000000));
                    tx.addOutput(lastwif, parseInt((parseFloat(sum) * 100000000) - (parseFloat(amount) + parseFloat(fee)) * 100000000));
                }
                tx.addOutput(dataScript, 0);
                $.each(wifsigns, function(key, value) {
                    tx.sign(parseFloat(key), wifsigns[key]);
                });

                var txBuilt = tx.build();
                console.log('Tx hex: '+txBuilt.toHex());
                console.log('Tx id:  '+txBuilt.getId());
                console.log('Sending tx...');

                trantor.pushTx(txBuilt.toHex(), function (response) {
                    if (response) {
                        console.log("Tx sent correctly. TXID: ["+response+"]");
                        if (cback && typeof cback == "function") {


                            trantor.decodeRawTransaction(txBuilt.toHex(), function (decoded) {
                                trantor.saveTransactionToDb(decoded);
                            })

                            cback(response);
                        }
                    }
                    else{
                        throw 'There has been an error sending transaction, please check arguments are correct.'
                    }
                });
            }, 3000);
        }, 3000)
        // }, iTx * 1000);
        iTx++;
    }
}

function generateUrl(url, params) {
    var i = 0, key;
    for (key in params) {
        if (i === 0) {
            url += "?";
        } else {
            url += "&";
        }
        url += key;
        url += '=';
        url += params[key];
        i++;
    }
    console.log("url", url);
    return url;
}

function getSearchParameters() {
    var prmstr = window.location.search.substr(1);
    return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray(prmstr) {
    var params = {};
    var prmarr = prmstr.split("&");
    for (var i = 0; i < prmarr.length; i++) {
        var tmparr = prmarr[i].split("=");
        params[tmparr[0]] = tmparr[1];
    }
    return params;
}

function showValidation() {
    $('#published').modal({
        show: 'true'
    });
}

function sendForm(form, cback) {
    console.log(form);
    $('#loading2').show();
    var values = {};

    $.each(form.serializeArray(), function(i, field) {
        console.log(field);
        values[field.name] = field.value;
    });
    // window.location = generateUrl(__dirname+'/upload.php', values)
    console.log(values);
    sendTxOp(0.002, 0.002, JSON.stringify(values), function (response) {
        $('#loading2').hide();
        $('.message_published').html('<p>Published correctly</p>')
        console.log("response", response);
        if (cback) {
            cback(response);
        }
    })
}

function getSearchParameters() {

    var str = window.location.search;
    var objURL = {};

    str.replace(
        new RegExp("([^?=&]+)(=([^&]*))?", "g"),
        function($0, $1, $2, $3) {
            objURL[$1] = $3;
        }
    );
    return objURL;
};
