
const {Network, Trantor} = require('./lib/trantor');

let trantor = new Trantor(Network.TESTNET);

trantor.onError = function (error) {
    console.error(error);
};

trantor.onDataFound = function (transaction, data) {

};

trantor.onExploreProgress = function (total, current) {

};

trantor.start(function () {
    console.log('Trantor initialized!');
    setTimeout(function () {
        init();
    }, 5000);
});

function init() {
    trantor.onTorrentDownloaded = function (txid, torrent) {
        console.log('Torrent downloaded!', torrent);
        trantor[txid](torrent);
    };

    trantor.register('ander7agar', 'ander7agar@gmail.com', 'http://owldevelopers.tk', 'Creativechain CTO', '/home/ander/avatar.jpg', function () {

    })
}