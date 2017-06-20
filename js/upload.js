if (typeof WebTorrent !== 'undefined') {
  const WebTorrent = require('webtorrent')
}
const dragDrop   = require('drag-drop')

const imagemin         = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');
const lzma             = require("lzma");
const hbjs             = require("handbrake-js");

var $loading = $('#loading');
var $publish = $('#publish');

// var fs = require('fs')
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}
var client = new WebTorrent()

client.on('error', function (err) {
  console.error('ERROR: ' + err.message)
})

function onTorrent (torrent) {
  console.log('Got torrent metadata!')
  console.log(
    'Torrent info hash: ' + torrent.infoHash + ' ' +
    '<a href="' + torrent.magnetURI + '" target="_blank">[Magnet URI]</a> ' +
    '<a href="' + torrent.torrentFileBlobURL + '" target="_blank" download="' + torrent.name + '.torrent">[Download .torrent]</a>'
  )

  // Print out progress every 5 seconds
  var interval = setInterval(function () {
    console.log('Progress: ' + (torrent.progress * 100).toFixed(1) + '%')
  }, 5000)

  torrent.on('done', function () {
    clearInterval(interval)
    console.log('Progress: 100%')
    $loading.hide(200);
    torrent.files.forEach(function (file) {
      console.log("file");
      file.appendTo('#drop-area')
    })
  })
}
function compressImage(input, output, cback) {
  imagemin([input], output, {
  	plugins: [
  		imageminJpegtran(),
  		imageminPngquant({quality: '65-80'})
  	]
  }).then(_ => {
    cback(_[0].path);
  });
}
function compressVideo(videoPath, outputPath, cback) {
  console.log(videoPath, outputPath);
  hbjs.spawn({
    input: videoPath,
    output: outputPath,
    preset: 'Very Fast 480p30'
  })
    .on('error', function(err){
      // invalid user input, no video found etc
      console.log("error", err);
      cback(err);
    })
    .on('progress', function(progress){
      console.log(
        'Percent complete: %s, ETA: %s',
        progress.percentComplete,
        progress.eta
      );
    })
    .on('end', function(res){
      console.log("Finalized compressing video", res);
      cback(outputPath);
    });
}

function compressFile(file, name, type, cback) {
  console.log("file: ", file);
  console.log("name: ", name);
  console.log("type: ", type);

  switch (type.split('/')[0]) {
    case 'image':
      compressImage(file, file.replace(name, 'compressed'), cback);
      break;
    case 'video':
      let outputPath = file.replace(name, name.replace(/(\..*)/, "compressed.mp4"));
      compressVideo(file, outputPath, cback)
      break;
    default:

  }
}

$(document).ready(function () {

  console.log('afas');
  $('#loading').hide();
  $('#loading2').hide();
  $('#publish').prop("disabled", true );

  var params = getSearchParameters();

  dragDrop('#drop-area', function (files) {
    console.log("Dropped", files);
    $('#loading').show(200);
    let compressed = files[0].path.replace(files[0].name, 'compressed');
    // compressFile(files[0].path, files[0].name, files[0].type, function (compressedFilePath) {
    //   // client.seed(compressedFilePath, {}, function (torrent) {
    //   //       console.log('Client is seeding compres:', torrent)
    //   //       $('#torrent_magnet').attr('value', torrent.magnetURI);
    //   //       $('#loading').hide(200);
    //   //       $('#publish').prop( "disabled", false );
    //   //     })
    // })
    // imagemin([files[0].path], compressed, {
    // 	plugins: [
    // 		imageminJpegtran(),
    // 		imageminPngquant({quality: '65-80'})
    // 	]
    // }).then(files_ => {
    // 	console.log(files_);
    //     client.seed(files_[0].path, {}, function (torrent) {
    //       console.log('Client is seeding compres:', torrent)
    //       // $('#loading').hide(200);
    //       $('#torrent_magnet').attr('value', torrent.magnetURI);
    //       $('#publish').prop( "disabled", false );
    //     })
    // });

    client.seed(files[0].path, {}, function (torrent) {
      console.log('Client is seeding:', torrent)
      $('#torrent_magnet_uncompressed').attr('value', torrent.magnetURI);
      $('#torrent_id').val(torrent.infoHash)
      $('#torrent_name').val(torrent.name)
      $('#publish').prop( "disabled", false );
    })
  })
})
