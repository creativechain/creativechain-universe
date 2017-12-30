const { ipcRenderer } = require('electron');
const path = require('path');
const WebTorrent = require('webtorrent');
const torrentCreator = require('create-torrent');
const parseTorrent = require('parse-torrent');
const fs = require('fs');

let client = new WebTorrent();

ipcRenderer.on('main-message', function (oEvent, arg) {
    //console.log('Received data from main', arg);
    let stringData = 'Received from main - ' + JSON.stringify(arg);
    log(stringData)
    processData(arg);
});

client.on('error', function (error) {
    error(error)
});

function log(message) {
    if ( typeof message !== 'string') {
        message = JSON.stringify(message);
    }
    $('#logger').append(`<p style="color: #2e6da4"><b>LOG: </b>${message}</p>`);
    $("html, body").animate({ scrollTop: $(document).height() }, 100);
}

function error(message) {
    if ( typeof message !== 'string') {
        message = JSON.stringify(message);
    }
    $('#logger').append(`<p style="color: #a94442"><b>ERROR:</b>${message}</p>`);
    $("html, body").animate({ scrollTop: $(document).height() }, 100);
}

function info(message) {
    if ( typeof message !== 'string') {
        message = JSON.stringify(message);
    }
    $('#logger').append(`<p style="color: #255625"><b>INFO:</b> ${message}</p>`);
    $("html, body").animate({ scrollTop: $(document).height() }, 100);
}

let torrentIds = {};

let Constants = {};
Constants.FILE_SEPARATOR ='/';
Constants.TORRENT_FOLDER = process.env.HOME + Constants.FILE_SEPARATOR + '.creativechain-platform' + Constants.FILE_SEPARATOR + 'torrents' + Constants.FILE_SEPARATOR;

const TorrentMsgCode = {
    CREATE: 0,
    DOWNLOAD: 1,
    ADD: 2,
    DELETE: 3,
    CONTAINS: 4,
    GET: 5,
    SEED: 6,
    ALL: 7,
    LOG: 8,
    KILL: 9,

};


class File {

    /**
     *
     * @param path
     * @returns {boolean}
     */
    static exist(path) {
        try {
            let stat = fs.statSync(path);
            return true;
        } catch (err) {
        }
        return false;

    }

    /**
     *
     * @param {string} path
     * @param content
     * @param {string} format
     */
    static write(path, content, format = 'utf8') {
        //console.log('Writing', path);
        File.mkpath(path, true);
        let fd = fs.openSync(path, 'w+');
        fs.writeFileSync(fd, content, format);
        fs.closeSync(fd);
    }

    /**
     *
     * @param {string} path
     * @param {string} format
     */
    static read(path, format = 'utf8') {
        return fs.readFileSync(path, format);
    }

    /**
     *
     * @param source
     * @param dest
     */
    static cp(source, dest) {
        console.log('Copying', source, dest);
        fs.createReadStream(source).pipe(fs.createWriteStream(dest));
    }

    /**
     *
     * @param {string} path
     * @returns {string}
     */
    static getExtension(path) {
        return path.split('.').pop();
    }

    /**
     *
     * @param {string} path
     * @returns {string}
     */
    static getName(path) {
        return path.split(Constants.FILE_SEPARATOR).pop();
    }

    static mkdir(path) {
        if (!File.exist(path)) {
            fs.mkdirSync(path);
        }
    }

    /**
     *
     * @param {string} path
     * @param {boolean} hasFile
     */
    static mkpath(path, hasFile = false) {
        //console.log('Making dirs', path);
        let dirs = path.split(Constants.FILE_SEPARATOR);
        let route = '';
        let length = hasFile ? dirs.length - 1 : dirs.length;
        for (let x = 0; x < length; x++) {
            route += dirs[x] + Constants.FILE_SEPARATOR;
            if (!File.exist(route)) {
                File.mkdir(route);
            }
        }
    }

    static chmod(path, permissions) {
        fs.chmodSync(path, permissions);
    }



    /**
     *
     * @param {string} file
     * @returns {*}
     */
    static fileInfo(file) {
        if (File.exist(file)) {
            let stat = fs.statSync(file);
            stat.formatSize = filesize(stat.size);
            return stat;
        }

        return undefined;
    }

    static getParentPath(route) {
        return path.dirname(route);
    }
}

/**
 *
 * @param torrent
 * @returns {{infoHash: *, xt: *, dn: *, name, magnetURI: *, path}}
 */
function normalize(torrent) {
    return {
        infoHash: torrent.infoHash,
        xt: torrent.xt,
        dn: torrent.dn,
        name: torrent.name,
        magnetURI: torrent.magnetURI,
        path: torrent.path,
    };
}

function send(code, id, response) {
    let data = {
        code: code,
        id: id,
        response: response
    };
    info(data);
    ipcRenderer.send('torrent-message', data)
}

function processData(data) {
    let code = data.code;
    switch (code) {
        case TorrentMsgCode.ADD:
            addFile(data.parentFolder, data.file, data.magnetUri, function (torrent) {
                send(code, data.id, normalize(torrent));
            });
            break;
        case TorrentMsgCode.SEED:
            seedFile(data.file, function (torrent, file) {
                send(code, data.id, normalize(torrent));
            });
            break;
        case TorrentMsgCode.CONTAINS:
            containsTorrent(data.torrentId, function (contains) {
                send(code, data.id, contains);
            });
            break;
        case TorrentMsgCode.CREATE:
            createTorrent(data.file, data.destPath, function (torrent, file) {
                let response = {torrent: normalize(torrent), file: file};
               send(code, data.id, response);
            });
            break;
        case TorrentMsgCode.GET:
            getTorrent(data.torrentId, function (torrent) {
                send(code, data.id, normalize(torrent));
            });
            break;
        case TorrentMsgCode.ALL:
            getAllTorrents(function (torrents) {
                send(code, data.id, torrents);
            });
            break;
        case TorrentMsgCode.DOWNLOAD:
            downloadTorrent(data.contentAddress, data.magnet, function (torrent, file, contentAddress) {
                let response = {torrent: normalize(torrent), file: file, contentAddress: contentAddress};
                send(code, data.id, response);
            }, data.privateContent);
            break;
        case TorrentMsgCode.DELETE:
            remove(data.torrent, function (err) {
                send(data.code, data.id, err);
            });
            break;
        case TorrentMsgCode.KILL:
            process.kill();
            break;
        default:
            send(code, data.id, data.data);
    }
}

/**
 *
 * @param {string} file
 * @param {string} destPath
 * @param callback
 */
function createTorrent(file, destPath, callback) {
    console.log(file, destPath);
    if (!File.exist(destPath)) {
        File.mkpath(destPath);
    }
    let files = file.split(Constants.FILE_SEPARATOR);
    let name = files[files.length-1];
    let destFile = destPath + name;

    File.cp(file, destFile);

    seedFile(destFile, callback);
}

/**
 *
 * @param {string} torrentId
 * @param callback
 */
function containsTorrent(torrentId, callback) {
    getTorrent(torrentId, function (torrent) {
        if (callback) {
            callback(torrent !== undefined && torrent !== null, torrent);
        }
    });
}

function getAllTorrents(callback) {
    let torrents = client.torrents;
    let parsedTorrents = [];
    torrents.forEach(function (torrent) {
        torrent = normalize(torrent);
        parsedTorrents.push(torrent);
    });

    callback(parsedTorrents);
}
/**
 *
 * @param {string}torrentId
 * @param callback
 */
function getTorrent(torrentId, callback) {
    let id = null;
    let onGetTorrent = function () {
        if (callback) {
            callback(client.get(id));
        }
    };

    if (File.exist(torrentId)) {
        info('File exsist ' + torrentId)
        torrentCreator(torrentId, function (err, torrent) {
            if (!err) {
                id = torrent.infoHash;
            } else {
                error(err)
            }

            onGetTorrent();

        })
    } else {
        info('File not exist ' + torrentId)
        id = torrentId;
        onGetTorrent();
    }
}

/**
 *
 * @param {string} parentFolder
 * @param {string} file
 * @param {string} magnetUri
 * @param callback
 */
function addFile(parentFolder, file, magnetUri, callback) {
    let privateContent = false;
    if (parentFolder.endsWith(Constants.FILE_SEPARATOR)) {
        parentFolder = parentFolder.substring(0, parentFolder.length - 1);
    }

    if (parentFolder && parentFolder.endsWith('-p')) {
        privateContent = true;
    }

    let onDownloadTorrent = function () {
        let pathParts = parentFolder.split(Constants.FILE_SEPARATOR);
        let contentAddress = pathParts[pathParts.length -1];
        contentAddress = contentAddress.replace('-p', '');
        downloadTorrent(contentAddress, magnetUri, callback, privateContent);
    };

    if (File.exist(file)) {
        torrentCreator(file, function (err, torrent) {
            if (err) {
                error(err)
            } else {
                let fileInfoHash = torrent.infoHash;
                let uriInfoHash = parseTorrent(magnetUri).infoHash;

                if (fileInfoHash === uriInfoHash) {
                    seedFile(file, callback);
                } else {
                    onDownloadTorrent();
                }
            }


        })
    } else if (parentFolder && magnetUri) {
        onDownloadTorrent();
    }
}

/**
 *
 * @param {string} file
 * @param callback
 */
function seedFile(file, callback) {
    info('Seeding file ' + file);
    let onTorrent = function (torrent, file) {
        info('Seeding' + file + ' started!');
        torrentIds[file] = torrent.infoHash;

        if (callback) {
            callback(torrent, file);
        }
    };

    containsTorrent(file, function (contains, torrent) {
        info('Contains seed file ' + contains)
        if (contains) {
            onTorrent(torrent, file);
        } else {
            client.seed(file, function (torrent) {
                onTorrent(torrent, file);
            })
        }
    })
}

/**
 *
 * @param {string} contentAddress
 * @param {string} magnet
 * @param callback
 * @param {boolean} privateContent
 */
function downloadTorrent(contentAddress, magnet, callback, privateContent = false) {

    if (magnet) {
        let path = Constants.TORRENT_FOLDER + contentAddress;
        if (privateContent) {
            path += '-p'
        }

        path += Constants.FILE_SEPARATOR;
        File.mkpath(path);

        containsTorrent(magnet, function (contains, torrent) {
            if (!contains) {
                //console.log('downloading file', path);
                client.add(magnet, {path: path}, function (torrent) {
                    torrent.on('done', function () {
                        let file = torrent.path + torrent.dn;
                        torrentIds[file] = torrent.infoHash;
                        //console.log('downloadTorrent', file, torrent);
                        if (callback) {
                            callback(torrent, file, contentAddress);
                        }
                    })
                })
            } else if (callback) {
                getTorrent(magnet, function (torrent) {
                    let parsedTorrent = parseTorrent(magnet);
                    //console.log('getTorrent', torrent.path, torrent.name, torrent.dn);
                    let file = torrent.path + parsedTorrent.name;
                    //console.log('getTorrent', file, torrent);
                    callback(torrent, file, contentAddress);
                });
            }
        })
    }
}

/**
 *
 * @param {string} torrent
 * @param callback
 */
function remove(torrent, callback) {
    if (File.exist(torrent)) {
        torrent = torrentIds[torrent];
    }
    client.remove(torrent, callback);

}
