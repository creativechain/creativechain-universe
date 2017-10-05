
const {Network, Trantor} = require('./lib/trantor');
const {dialog} = require('electron').remote;

let dragDrop = require('drag-drop');


let trantor = new Trantor(Network.TESTNET);

trantor.onError = function (error) {
    console.error(error);
};

trantor.onDataFound = function (transaction, data) {

};

trantor.onExploreProgress = function (total, current) {

};

function prepareDragDrop() {
    dragDrop('#drag-drop', function (files) {
        console.log(files)
    });
}

trantor.start(function () {
    console.log('Trantor initialized!');
    setTimeout(function () {
        prepareDragDrop();
        init();
    }, 5000);
});

function init() {
    trantor.onTorrentDownloaded = function (txid, torrent) {
        console.log('Torrent downloaded!', torrent);
        trantor[txid](torrent);
    };

/*    trantor.register('ander7agar', 'ander7agar@gmail.com', 'http://owldevelopers.tk', 'Creativechain CTO', '/home/ander/avatar.jpg', function () {

    })*/
}

function showOpenFile() {
    dialog.showOpenDialog((fileNames) => {
        if(fileNames === undefined){
            console.log("No file selected");
            return;
        }

        console.log(fileNames);

    })
}