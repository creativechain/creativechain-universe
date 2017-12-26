let control = require('electron').remote;
let {dialog} = require('electron').remote;
let {shell, clipboard} = require('electron');
let http = require('request');
let Mime = require('mime-types');
let QRCode = require('qrcode');
const {Coin, CoinUri, ContentData, Notifications, Utils, File, Network, Trantor, CreativeCoin, FileStorage,
    DecodedTransaction, Author, MediaData, Comment, Like, PUBLICATION, Prices, Constants, OS, TorrentMsgCode,
    TransactionBuilder} = require('./lib/trantor');
const crealib = require('bitcoinjs-lib');
let moment = require('moment');
let Worker = require('workerjs');

let trantor = new Trantor();
let lang = control.getGlobal('lang');
let locale = control.getGlobal('locale');
moment.locale(locale);

window.onbeforeunload = function () {
    trantor.stop();
};
let appStorage = FileStorage.load();

let settings = FileStorage.load();
let reqPass = false;
const SESSION_DURATION_MILLIS = settings.getKey('session-time', 1800) * 1000;

let timeout;

let DEFAULT_AVATAR = ['avatar1.png', 'avatar1.png', 'avatar2.png', 'avatar2.png', 'avatar3.png', 'avatar3.png', 'avatar4.png', 'avatar4.png', 'avatar5.png', 'avatar5.png'];

if (!String.format) {
    /**
     *
     * @param {string} format
     * @param args
     * @return {*|void|XML|string}
     */
    String.format = function(format, ...args) {
        let splitter = '%s';
        let parts = format.split(splitter);
        console.log('String format', parts);
        let newFormat = '';

        for (let x in parts) {
            let r = args[x];
            if (!r) {
                r = ''
            }

            newFormat += parts[x];
            newFormat += r;
        }

        return newFormat;

/*        let args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });*/
    };
}

if (!String.hexEncode) {
    /**
     *
     * @param {string} str
     * @return {String}
     */
    String.hexEncode = function (str) {
        return Buffer.from(str, 'utf8').toString('hex');
    }
}

if (!String.hexDecode) {
    /**
     *
     * @param {string} hex
     * @return {String}
     */
    String.hexDecode = function (hex) {
        return Buffer.from(hex, 'hex').toString('utf8');
    }
}

String.prototype.isEmpty = function() {
    return (this.length === 0 || !this.trim());
};

let Colors = {
    WHITE: '#FFFFFF',
    BLUE: '#0073FF',
    YELLOW: '#FFD952',
    RED: '#FF5766',
    GREEN: '#26D87D',
    GREY: '#D5D6D7'
};

/**
 *
 * @param {string} mimeType
 * @param {string} featuredImage
 * @returns {{}}
 */
function getDefaultImageAndColor(mimeType, featuredImage) {
    if (mimeType) {
        mimeType = mimeType.toLowerCase();

        let res = {};
        if (featuredImage && featuredImage.length > 0 && File.exist(featuredImage)) {
            res.image = featuredImage;
            res.color = Colors.WHITE
        } else if (mimeType.indexOf('audio') > -1) {
            res.image = './assets/img/news-audio.png';
            res.color = Colors.BLUE;
        } else if (mimeType.indexOf('video') > -1) {
            res.image = './assets/img/news-video.png';
            res.color = Colors.YELLOW;
        } else if (mimeType.indexOf('image') > -1) {
            res.image = './assets/img/news-picture.png';
            res.color = Colors.RED;
        } else if (mimeType.indexOf('epub') > -1) {
            res.image = './assets/img/news-book.png';
            res.color = Colors.GREEN;
        } else {
            res.image = './assets/img/news-letter.png';
            res.color = Colors.GREY;
        }

        //console.log(mimeType, featuredImage, res);
        return res;
    }
}

function enableSessionControl() {
    document.onmousemove = function () {
        clearTimeout(timeout);
        timeout = setTimeout(function () {
            reqPass = false;
            inputPassword();
        }, SESSION_DURATION_MILLIS);
    };
}

function closeApp() {
    control.getCurrentWindow().close();
}

function minimize() {
    control.getCurrentWindow().minimize();
}

function maximize() {
    let win = control.getCurrentWindow();

    if (win.isMaximized()) {
        win.unmaximize();
    } else {
        control.getCurrentWindow().maximize();
    }
}

/**
 *
 * @param {string} file
 * @param {string} address
 * @param size
 * @return {string}
 */
function resolveAvatar(file, address, size = 40) {
    if (File.exist(file)) {
        return file
    }

    let hex = crealib.address.fromBase58Check(address).hash.toString('hex');
    hex = hex.substring(hex.length -1, hex.length);
    hex = '' + parseInt(hex, 16);
    hex = hex.substring(hex.length -1, hex.length);
    hex = parseInt(hex, 16);
    return File.exist(file) ? file : getDefaultAvatar(hex);
}

const BUZZ = {
    LIKE_RATE: 0.1,
    COMMENT_RATE: 0.2,
    PUBLICATION_RATE: 0.3,
    ACTION_RATE: 0.5,
    NOVICE: 0,
    TRAINEE: 144,
    ADVANCED: 233,
    EXPERT: 377,
    INFLUENCER: 610,
    MASTER: 987,
    GURU: 1597,
    GENIUS: 2584,
    LEVELS: [this.NOVICE, this.TRAINEE, this.ADVANCED, this.EXPERT, this.INFLUENCER, this.MASTER, this.GURU, this.GENIUS],
    getLevel: function (buzz) {
        for (let x = this.LEVELS.length -1; x >= 0; x--) {
            let level = this.LEVELS[x];
            if (buzz >= level) {
                return level;
            }
        }

        return this.TRAINEE;
    },
    getLevelIcon: function getLevelIcon(level) {
        switch (level) {
            case this.GENIUS:
                return './assets/img/buzz/buzz_s.svg';
            case this.GURU:
                return './assets/img/buzz/buzz_g.svg';
            case this.MASTER:
                return './assets/img/buzz/buzz_m.svg';
            case this.INFLUENCER:
                return './assets/img/buzz/buzz_i.svg';
            case this.EXPERT:
                return './assets/img/buzz/buzz_e.svg';
            case this.ADVANCED:
                return './assets/img/buzz/buzz_a.svg';
            case this.TRAINEE:
                return './assets/img/buzz/buzz_t.svg';
            default:
                return './assets/img/buzz/buzz_n.svg';
        }
    },
    getBuzz: function (likes, comments = 0, publications = 0, actions = 0) {
        let rate = 0;
        rate += (likes * this.LIKE_RATE);
        rate += (comments * this.COMMENT_RATE);
        rate += (publications * this.PUBLICATION_RATE);
        rate += (actions * this.ACTION_RATE);
        let level = this.getLevel(rate);
        let icon = this.getLevelIcon(level);
        let levelText = this.translateLevel(level);
        return {
            rate: rate.toFixed(2),
            level: level,
            icon: icon,
            levelText: levelText
        };
    },
    translateLevel: function(level) {
        switch (level) {
            case BUZZ.GENIUS:
                return lang.GeniusLevel;
            case BUZZ.MASTER:
                return lang.MasterLevel;
            case BUZZ.INFLUENCER:
                return lang.InfluencerLevel;
            case BUZZ.EXPERT:
                return lang.ExpertLevel;
            default:
                return lang.TraineeLevel;
        }
    }
};

/**
 *
 * @param {number} licenseType
 * @returns {{icons: *, name: *, link: *}}
 */
function getLicenseData(licenseType) {

    let icons, name, link;
    switch (licenseType) {
        case 0:
            icons = ['./assets/img/cc-icons/zero.svg'];
            name = 'Creative Commons CC0 1.0';
            link = 'https://creativecommons.org/publicdomain/zero/1.0/';
            break;
        case 1:
            icons = ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nc.svg', './assets/img/cc-icons/sa.svg'];
            name = 'P2P Foundation BY-NC-SA';
            link = 'https://wiki.p2pfoundation.net/Peer_Production_License';
            break;
        case 2:
            icons = ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nd.svg'];
            name = 'Creative Commons BY-NC-ND 4.0';
            link = 'https://creativecommons.org/licenses/by-nc-nd/4.0/';
            break;
        case 3:
            icons = ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nc.svg', './assets/img/cc-icons/sa.svg'];
            name = 'Creative Commons BY-NC-SA 4.0';
            link = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';
            break;
        case 4:
            icons = ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nc.svg'];
            name = 'Creative Commons BY-NC 4.0';
            link = 'https://creativecommons.org/licenses/by-nc/4.0/';
            break;
        case 5:
            icons = ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/sa.svg'];
            name = 'Creative Commons BY-SA 4.0';
            link = 'https://creativecommons.org/licenses/by-sa/4.0/';
            break;
        case 6:
            icons = ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nd.svg'];
            name = 'Creative Commons BY-ND 4.0';
            link = 'https://creativecommons.org/licenses/by-nd/4.0/';
            break;
        case 7:
            icons = ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg'];
            name = 'Creative Commons BY 4.0';
            link = 'https://creativecommons.org/licenses/by/4.0/';
            break;
    }

    return {
         icons: icons,
         name: name,
         link: link
     };
}

let modal = {

    /**
     *
     * @param opts
     * @returns {*|jQuery|HTMLElement}
     */
    build: function (opts) {
        //console.log(opts);
        let that = this;
        //this.hide();
        $('#modal-title').html(opts.title || '');
        if (opts.loading) {
            $('#modal-message').removeClass('hidden');
            $('#modal-qr').addClass('hidden');
            $('#modal-loading').removeClass('hidden');
        } else if (opts.qr) {
            $('#modal-message').addClass('hidden');
            $('#modal-qr').removeClass('hidden');
            $('#modal-loading').addClass('hidden');

            QRCode.toCanvas(document.getElementById('modal-qr'), opts.text, opts, function (err) {
                console.log(err)
            })
        } else {
            $('#modal-loading').addClass('hidden');
            $('#modal-qr').addClass('hidden');
            $('#modal-message').removeClass('hidden')
                .html(opts.message || '');
        }
        if (opts.cancel) {
            $('#modal-cancel').removeClass('hidden')
                .html(opts.cancel.text || lang.Cancel)
                .unbind('click')
                .click(function () {
                    if (opts.cancel.onclick) {
                        opts.cancel.onclick();
                    }
                    that.hide();
                });


        } else {
            $('#modal-cancel').addClass('hidden')
                .unbind('click');
        }

        if (opts.ok) {
            $('#modal-ok').removeClass('hidden')
                .html(opts.ok.text || 'Ok')
                .unbind('click')
                .click(function () {
                    if (opts.ok.onclick) {
                        let pass = undefined;
                        if (opts.password) {
                            pass = $('#modal-password').val();
                        }
                        opts.ok.onclick(pass);
                    }
                    that.hide();
                })
        } else {
            $('#modal-ok').addClass('hidden')
                .unbind('click');
        }

        if (opts.password) {
            $('#modal-password').removeClass('hidden');
        } else {
            $('#modal-password').addClass('hidden');
        }

        $('#modal-password').keydown(function (event) {
            //console.log('Key', event.which);
            if (event.which === opts.enterkey) {
                let pass = $('#modal-password').val();
                if (pass && pass.length > 0) {
                    if (opts.ok && opts.ok.onclick) {
                        opts.ok.onclick(pass);
                    }
                } else {
                    if (opts.cancel && opts.cancel.onclick) {
                        opts.cancel.onclick();
                    }
                }

                that.hide();

                return false;
            }

            return true;
        });

        let modal = $('#modal');
        if (opts.show) {
            modal.modal('show');
        }

        return modal;
    },

    /**
     *
     * @param opts
     * @returns {*|jQuery|HTMLElement}
     */
    password: function (opts) {
        let defaultOpts = {
            show: true,
            password: true,
            title: lang.Password,
            enterkey: 13, //ENTER/INTRO
            ok: {
                text: 'Ok',
            },
            cancel: {
                text: lang.Cancel
            }
        };

        let finalOpts = {};
        Object.assign(finalOpts, defaultOpts, opts);
        return this.build(finalOpts);
    },

    /**
     *
     * @param opts
     * @returns {*|jQuery|HTMLElement}
     */
    alert: function (opts) {
        let that = this;
        let defaultOpts = {
            show: true,
            ok: {
                text: 'Ok',
            }
        };

        let finalOpts = {};
        Object.assign(finalOpts, defaultOpts, opts);
        return this.build(finalOpts);
    },

    error: function (opts) {
        let defaultOpts = {
            title: 'Error'
        };

        let finalOpts = {};
        Object.assign(finalOpts, defaultOpts, opts);
        return this.alert(finalOpts);
    },

    /**
     *
     * @param opts
     * @returns {*|jQuery|HTMLElement}
     */
    qr: function (opts) {
        let defaultOpts = {
            errorCorrectionLevel: 'M',
            show: true,
            qr: true,
            ok: {
                text: 'Ok'
            }
        };

        let finalOpts = {};
        Object.assign(finalOpts, defaultOpts, opts);
        return this.build(finalOpts);
    },

    loading: function () {
        $('#loading').removeClass('hidden');
    },

    hide: function (modal = true) {
        if (modal) {
            $('#modal').modal('hide');
        }

        $('#loading').addClass('hidden');
    }
};

/**
 *
 * @param {Array} tags
 * @returns {string}
 */
function linkTags(tags) {
    let htmlTags = [];
    tags.forEach(function (tag) {
        let htmlTag = '<span onclick="search(\'' + tag + '\')" style="text-decoration: underline; cursor: pointer; color: ' + Colors.BLUE + ';">' + tag + '</span>';
        htmlTags.push(htmlTag);
    });
    htmlTags = htmlTags.join(', ');
    return htmlTags;
}

/**
 *
 * @param {number} num
 * @returns {string}
 */
function getDefaultAvatar(num) {
    return './assets/img/avatar/' + DEFAULT_AVATAR[num];
}

/**
 *
 * @param {string} input
 * @returns {string}
 */
function removeHtml(input) {
    return input.replace(/<(?:.|\n)*?>/gm, '')
}

function openUrlInBrowser(url) {
    shell.openItem(url);
    return false;
}


function followButtonEnter(buttonId, followAddress, isFollowing) {
    console.log('mouseenter');
    let followButton = $('#' + buttonId);

    if (isFollowing) {
        followButton.removeClass('btn-primary btn-follow')
            .addClass('btn-therciary btn-following');
        followButton.html(lang.Unfollow);
        followButton.html(lang.Unfollow).click(function () {
            unFollowUser(followAddress);
        });
    } else {
        followButton.html(lang.Follow).click(function () {
            followUser(followAddress);
        }).addClass('btn-primary btn-follow')
            .removeClass('btn-therciary btn-following');
    }
}

function followButtonLeave(buttonId, followAddress, isFollowing) {
    console.log('mouseleave');
    let followButton = $('#' + buttonId);

    if (isFollowing) {
        followButton.addClass('btn-primary btn-follow')
            .removeClass('btn-therciary btn-following');
        followButton.html(lang.Following);

    } else {
        followButton.html(lang.Follow).click(function () {
            followUser(followAddress);
        }).addClass('btn-primary btn-follow')
            .removeClass('btn-therciary btn-following');
    }
}

function makeFollowButton(buttonId, isFollowing) {

    let followButton = $('#' + buttonId);

    if (isFollowing) {
        followButton.addClass('btn-primary btn-follow')
            .removeClass('btn-therciary btn-following');
        followButton.html(lang.Following);
    } else {
        followButton.html(lang.Follow)
            .addClass('btn-primary btn-follow')
            .removeClass('btn-therciary btn-following');
    }
}

class Torrents {
    constructor() {
        this.worker = new Worker(__dirname + '/lib/torrent.js', true);
        this.callbacks = {};
    }

    start() {
        let that = this;
        console.log('Starting torrent client');
        this.worker.addEventListener('message', function (event) {
            that.processData(event.data);
        });

        this.worker.postMessage({id: 0, code: TorrentMsgCode.LOG, data: 'start'})
    }

    processData(data) {
        let callback = this.callbacks[data.id];

        if (data.id === TorrentMsgCode.LOG) {
            console.log(data.response);
        } else if (callback) {
            let response = data.response;
            switch (data.code) {
                case TorrentMsgCode.DOWNLOAD:
                    callback(response.torrent, response.file, response.contentAddress);
                    break;
                case TorrentMsgCode.CREATE:
                    callback(response.torrent, response.file);
                    break;
                default:
                    callback(response);
            }

            this.removeCallback(data.id);
        }

    }

    /**
     *
     * @param {Number} id
     * @param callback
     */
    addCallback(id, callback) {
        this.callbacks[id] = callback;
    }

    removeCallback(id) {
        this.callbacks[id] = undefined
    }

    /**
     *
     * @param {string} file
     * @param {string} destPath
     * @param callback
     */
    createTorrent(file, destPath, callback) {
        let data  = {
            id: Utils.randomNumber(100000000, 999999999),
            code: TorrentMsgCode.CREATE,
            file: file,
            destPath: destPath
        };

        this.addCallback(data.id, callback);
        this.worker.postMessage(data);
    }

    /**
     *
     * @param {string} torrentId
     * @param callback
     */
    containsTorrent(torrentId, callback) {
        let data  = {
            id: Utils.randomNumber(100000000, 999999999),
            code: TorrentMsgCode.CONTAINS,
            torrentId: torrentId,
        };

        this.addCallback(data.id, callback);
        this.worker.postMessage(data);
    }

    /**
     *
     * @param {string}torrentId
     * @param callback
     */
    getTorrent(torrentId, callback) {
        let data  = {
            id: Utils.randomNumber(100000000, 999999999),
            code: TorrentMsgCode.GET,
            torrentId: torrentId,
        };

        this.addCallback(data.id, callback);
        this.worker.postMessage(data);
    }

    /**
     *
     * @param {string} parentFolder
     * @param {string} file
     * @param {string} magnetUri
     * @param callback
     */
    addFile(parentFolder, file, magnetUri, callback) {
        let data  = {
            id: Utils.randomNumber(100000000, 999999999),
            code: TorrentMsgCode.ADD,
            parentFolder: parentFolder,
            file: file,
            magnetUri: magnetUri
        };

        this.addCallback(data.id, callback);
        this.worker.postMessage(data);
    }

    /**
     *
     * @param {string} file
     * @param callback
     */
    seedFile(file, callback) {
        let data  = {
            id: Utils.randomNumber(100000000, 999999999),
            code: TorrentMsgCode.SEED,
            file: file,
        };

        this.addCallback(data.id, callback);
        this.worker.postMessage(data);
    }

    /**
     *
     * @param {string} contentAddress
     * @param {string} magnet
     * @param callback
     * @param {boolean} privateContent
     */
    downloadTorrent(contentAddress, magnet, callback, privateContent = false) {
        let data  = {
            id: Utils.randomNumber(100000000, 999999999),
            code: TorrentMsgCode.DOWNLOAD,
            contentAddress: contentAddress,
            magnet: magnet,
            privateContent: privateContent
        };

        this.addCallback(data.id, callback);
        this.worker.postMessage(data);
    }

    /**
     *
     * @param {string} torrent
     * @param callback
     */
    remove(torrent, callback) {
        let data  = {
            id: Utils.randomNumber(100000000, 999999999),
            code: TorrentMsgCode.DELETE,
            torrent: torrent,
        };

        this.addCallback(data.id, callback);
        this.worker.postMessage(data);
    }

    close() {
        this.worker.terminate();
    }
}

let torrentClient = new Torrents();
torrentClient.start();

trantor.events.subscribe('onStop', 'init', function () {
    console.log('Stopping torrent client...');
    torrentClient.close();
});
