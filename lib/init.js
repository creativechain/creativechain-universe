let control = require('electron').remote;
let {dialog} = require('electron').remote;
let {shell, clipboard, ipcRenderer} = require('electron');
let cp = require('child_process');
let http = require('request');
let Mime = require('mime-types');
let QRCode = require('qrcode');
const {Coin, CoinUri, ContentData, Notifications, Utils, File, Network, Trantor, CreativeCoin, FileStorage,
    DecodedTransaction, Author, MediaData, Comment, Like, PUBLICATION, Prices, ErrorCodes, Constants, OS, TorrentMsgCode,
    TransactionBuilder} = require('./lib/trantor');
const crealib = require('bitcoinjs-lib');
let filesize = require('file-size');
let moment = require('moment');
let semver = require('semver');
let pjson = require('./package.json');
const IPFS = require('ipfs');


let trantor = new Trantor();
let lang = control.getGlobal('lang');
let locale = control.getGlobal('locale');
moment.locale(locale);

window.onbeforeunload = function () {
    trantor.stop();
};

let Menu = control.Menu;

let template = [
    { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:", role: 'copy' },
    { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:", role: 'paste' },
];

let InputMenu = Menu.buildFromTemplate(template);

document.body.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();

    let node = e.target;

    while (node) {
        if (node.nodeName.match(/^(input|textarea|div|p|span|a)$/i) || node.isContentEditable) {
            InputMenu.popup(control.getCurrentWindow());
            break;
        }
        node = node.parentNode;
    }
});

let appStorage = FileStorage.load();
let settings = FileStorage.load();
let reqPass = false;

const SESSION_DURATION_MILLIS = settings.getKey('session-time', 1800) * 1000;

let timeout;

let FILE = {
    FEATURED_MAX_SIZE: 5 * 1024 * 1024, //5 MB
    PRIVATE_MAX_SIZE: 200 * 1024 * 1024, // 200 MB
};

let addClassMethod = jQuery.fn.addClass;

/*$(document).ready(function () {
    $('body').on('scroll', detectScrollBottom);
});*/

(function () {
    jQuery.fn.addClass = function () {
        let result = addClassMethod.apply(this, arguments);

        jQuery(this).trigger('onClassChanged');

        return result;
    };
})();

document.addEventListener('dragover', function (event) {
    event.preventDefault();
    return false;
}, false);

document.addEventListener('drop', function (event) {
    event.preventDefault();
    return false;
}, false);


/**
 *
 * @param {string} mimeType
 * @param {string} featuredImage
 * @returns {{}}
 */
function getDefaultImageAndColor(mimeType, featuredImage) {
    let res = {};
    if (mimeType) {
        mimeType = mimeType.toLowerCase();

        if (featuredImage && featuredImage.length > 0 && File.exist(featuredImage)) {
            res.image = File.normalizePath(featuredImage);
            res.color = R.COLOR.WHITE
        } else if (mimeType.indexOf('audio') > -1) {
            res.image = R.IMG.PREVIEW.AUDIO;
            res.color = R.COLOR.BLUE;
        } else if (mimeType.indexOf('video') > -1) {
            res.image = R.IMG.PREVIEW.VIDEO;
            res.color = R.COLOR.YELLOW;
        } else if (mimeType.indexOf('image') > -1) {
            res.image = R.IMG.PREVIEW.IMAGE;
            res.color = R.COLOR.RED;
        } else if (mimeType.indexOf('epub') > -1) {
            res.image = R.IMG.PREVIEW.EBOOK;
            res.color = R.COLOR.GREEN;
        } else {
            res.image = R.IMG.PREVIEW.DEFAULT;
            res.color = R.COLOR.SMOKE;
        }

        //console.log(mimeType, featuredImage, res);

    } else {
        res.image = R.IMG.PREVIEW.DEFAULT;
        res.color = R.COLOR.SMOKE;
    }

    return res;
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
 * @return {string}
 */
function resolveAvatar(file, address) {
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
    REGISTER_TIME: 0,
    LIKE_RATE: 0.1,
    COMMENT_RATE: 0.2,
    PUBLICATION_RATE: 0.3,
    ACTION_RATE: 0.5,
    TIME_RATE: 0.5,
    NOVICE: 0,
    TRAINEE: 144,
    ADVANCED: 233,
    EXPERT: 377,
    INFLUENCER: 610,
    MASTER: 987,
    GURU: 1597,
    GENIUS: 2584,
    getLevel: function (buzz) {
        for (let x = this.LEVELS.length -1; x >= 0; x--) {
            let level = this.LEVELS[x];
            if (buzz >= level) {
                return level;
            }
        }

        return this.NOVICE;
    },

    getLevelIcon: function getLevelIcon(level) {
        switch (level) {
            case this.GENIUS:
                return R.IMG.BUZZ.GENIUS;
            case this.GURU:
                return R.IMG.BUZZ.GURU;
            case this.MASTER:
                return R.IMG.BUZZ.MASTER;
            case this.INFLUENCER:
                return R.IMG.BUZZ.INFLUENCER;
            case this.EXPERT:
                return R.IMG.BUZZ.EXPERT;
            case this.ADVANCED:
                return R.IMG.BUZZ.ADVANCED;
            case this.TRAINEE:
                return R.IMG.BUZZ.TRAINEE;
            default:
                return R.IMG.BUZZ.NOVICE;
        }
    },
    getBuzz: function (likes, comments = 0, publications = 0, actions = 0) {
        let rate = 0;
        rate += (likes * this.LIKE_RATE);
        rate += (comments * this.COMMENT_RATE);
        rate += (publications * this.PUBLICATION_RATE);
        rate += (actions * this.ACTION_RATE);

        let now = new Date().getTime();
        now = parseInt(now / 1000); //TO SECONDS
        let registerTime = this.REGISTER_TIME === 0 ? now : this.REGISTER_TIME;
        let timeDiff = now - registerTime;
        let days = parseInt(timeDiff / 86400); //TO DAYS

        let buzzTime = days / 2 * 14 * this.TIME_RATE;

        rate = Math.min(buzzTime, rate);
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
            case BUZZ.GURU:
                return lang.GuruLevel;
            case BUZZ.MASTER:
                return lang.MasterLevel;
            case BUZZ.INFLUENCER:
                return lang.InfluencerLevel;
            case BUZZ.EXPERT:
                return lang.ExpertLevel;
            case BUZZ.ADVANCED:
                return lang.AdvancedLevel;
            case BUZZ.TRAINEE:
                return lang.TraineeLevel;
            default:
                return lang.NoviceLevel;
        }
    }
};
BUZZ.LEVELS = [BUZZ.NOVICE, BUZZ.TRAINEE, BUZZ.ADVANCED, BUZZ.EXPERT, BUZZ.INFLUENCER, BUZZ.MASTER, BUZZ.GURU, BUZZ.GENIUS];

/**
 *
 * @param {number} licenseType
 * @returns {{icons: *, name: *, link: *}}
 */
function getLicenseData(licenseType) {

    let icons, name, link;
    switch (licenseType) {
        case 0:
            icons = [R.IMG.LICENSE.ZERO];
            name = 'Creative Commons CC0 1.0';
            link = 'https://creativecommons.org/publicdomain/zero/1.0/';
            break;
        case 1:
            icons = [R.IMG.LICENSE.CC, R.IMG.LICENSE.BY, R.IMG.LICENSE.NC, R.IMG.LICENSE.SA];
            name = 'P2P Foundation BY-NC-SA';
            link = 'https://wiki.p2pfoundation.net/Peer_Production_License';
            break;
        case 2:
            icons = [R.IMG.LICENSE.CC, R.IMG.LICENSE.BY, R.IMG.LICENSE.ND];
            name = 'Creative Commons BY-NC-ND 4.0';
            link = 'https://creativecommons.org/licenses/by-nc-nd/4.0/';
            break;
        case 3:
            icons = [R.IMG.LICENSE.CC, R.IMG.LICENSE.BY, R.IMG.LICENSE.NC, R.IMG.LICENSE.SA];
            name = 'Creative Commons BY-NC-SA 4.0';
            link = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';
            break;
        case 4:
            icons = [R.IMG.LICENSE.CC, R.IMG.LICENSE.BY, R.IMG.LICENSE.NC];
            name = 'Creative Commons BY-NC 4.0';
            link = 'https://creativecommons.org/licenses/by-nc/4.0/';
            break;
        case 5:
            icons = [R.IMG.LICENSE.CC, R.IMG.LICENSE.BY, R.IMG.LICENSE.SA];
            name = 'Creative Commons BY-SA 4.0';
            link = 'https://creativecommons.org/licenses/by-sa/4.0/';
            break;
        case 6:
            icons = [R.IMG.LICENSE.CC, R.IMG.LICENSE.BY, R.IMG.LICENSE.ND];
            name = 'Creative Commons BY-ND 4.0';
            link = 'https://creativecommons.org/licenses/by-nd/4.0/';
            break;
        case 7:
            icons = [R.IMG.LICENSE.CC, R.IMG.LICENSE.BY];
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
            $('#modal-qr-message').removeClass('hidden')
                .html(opts.message || '');
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

        if (opts.img) {
            $('#modal-img').attr('src', opts.img)
                .parent().removeClass('hidden');
        } else {
            $('#modal-img').parent().addClass('hidden');
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
            if (!opts.cancelable) {
                modal.modal({
                    backdrop: 'static',
                    keyboard: false
                })
            } else {
                modal.modal('show');
            }
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
            enterkey: 13, //ENTER/INTRO,
            cancelable: true,
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
            cancelable: true,
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
            title: 'Error',
            cancelable: true,
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
            cancelable: true,
            ok: {
                text: 'Ok'
            }
        };

        let finalOpts = {};
        Object.assign(finalOpts, defaultOpts, opts);
        return this.build(finalOpts);
    },

    loading: function (text) {
        if (text) {
            $('#loading-text').html(text)
                .removeClass('hidden');
        } else {
            $('#loading-text').addClass('hidden');
        }
        $('#loading').removeClass('hidden');
    },

    blockLoading: function (message, show = true) {
        if (show) {
            $('#blockchain-sync').removeClass('hidden');
            $('#block-loading-message').html(message);
        } else {
            $('#blockchain-sync').addClass('hidden');
        }
    },

    hide: function (modal = true) {
        if (modal) {
            console.log('hidding modal');
            $('#modal').modal('hide');
            $('.modal-backdrop').remove();
        }

        $('#loading').addClass('hidden');
        $('#task-loading').addClass('hidden');
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
        let htmlTag = '<span onclick="search(\'' + tag + '\')" class="cursor" style="color: ' + R.COLOR.BLUE + ';">' + tag + '</span>';
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
    num = Math.floor(num / 2);
    return R.IMG.DEFAULT_AVATAR[num];
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
    shell.openExternal(url);
    return false;
}


function followButtonEnter(buttonId, followAddress, isFollowing) {
    console.log('mouseenter');
    let followButton = $('#' + buttonId);

    if (isFollowing) {
        followButton.removeClass('btn-therciary btn-following')
            .addClass('btn-primary-inverse btn-follow');
        followButton.html(lang.Unfollow);
        followButton.html(lang.Unfollow).click(function () {
            unFollowUser(followAddress);
        });
    } else {
        followButton.html(lang.Follow).click(function () {
            followUser(followAddress);
        }).addClass('btn-primary btn-follow')
            .removeClass('btn-therciary btn-following btn-primary-inverse');
    }
}

function followButtonLeave(buttonId, followAddress, isFollowing) {
    console.log('mouseleave');
    let followButton = $('#' + buttonId);

    if (isFollowing) {
        followButton.removeClass('btn-primary-inverse btn-follow')
            .addClass('btn-therciary btn-following');
        followButton.html(lang.Following);

    } else {
        followButton.html(lang.Follow).click(function () {
            followUser(followAddress);
        }).addClass('btn-primary btn-follow')
            .removeClass('btn-therciary btn-following btn-primary-inverse');
    }
}

function makeFollowButton(buttonId, isFollowing) {

    let followButton = $('#' + buttonId);

    if (isFollowing) {
        followButton.removeClass('btn-primary btn-follow')
            .addClass('btn-therciary btn-following');
        followButton.html(lang.Following);
    } else {
        followButton.html(lang.Follow)
            .addClass('btn-primary btn-follow')
            .removeClass('btn-therciary btn-following');
    }
}

function makeLikeButton(buttonId, liked, address, icons) {

    if (!icons) {
        icons = {
            NORMAL: './assets/img/modal/icon-like.png',
            FILLED: './assets/img/like2.gif',
            OVER: './assets/img/like1.png'
        }
    }

    let likeButton = $('#' + buttonId);

    if (liked) {
        likeButton.attr('src', icons.FILLED)
            .unbind('mouseenter')
            .unbind('mouseleave');
    } else {
        likeButton.attr('src', icons.NORMAL)
            .mouseenter(function () {
                likeButton.attr('src', icons.OVER);
            })
            .mouseleave(function () {
                likeButton.attr('src', icons.NORMAL);
            })
    }

    likeButton.unbind('click')
        .attr('onclick', "makeLike('" + address + "', " + liked + ")");
}

class FileClient {
    constructor() {
        this.node = null;
    }

    start() {
        let that = this;
        this.node = new IPFS();
        this.node.on('ready', () => {
            that.node.id(function (err, identity) {
                if (err) {
                    console.error(err);
                } else {
                    console.log(identity);
                }
            });

            that.node.swarm.connect('/ip4/213.136.90.245/tcp/4003/ws/ipfs/QmaLx52PxcECmncZnU9nZ4ew9uCyL6ffgNptJ4AQHwkSjU', function (err) {
                if (err) {
                    console.error(err)
                } else {
                    console.log('ipfs connected!');
                }
            });
        })
    }

    /**
     *
     * @param {string} file
     * @param {string} destPath
     * @param callback
     */
    createFile(file, destPath, callback) {
        let that = this;
        if (!File.exist(destPath)) {
            File.mkpath(destPath);
        }

        let name = File.getName(file);
        let destFile = destPath + name;

        let fileBuffer = File.read(file, null);

        File.cp(file, destFile);
        let data = {
            path: destFile,
            content: fileBuffer
        };

        let files = [data];
        this.node.files.add(files, function (err, resultFiles) {
            if (err) {
                console.error(err)
            } else if (callback) {
                if (resultFiles.length > 0) {
                    let ipfsData = resultFiles[0];
                    ipfsData.infoHash = ipfsData.hash;
                    ipfsData.magnetURI = ipfsData.hash + '/' + name;

                    setTimeout(function () {
                        let request = require('request');
                        let credentials = FileStorage.load(Constants.CREDENTIALS_FILE);
                        credentials = credentials.storage;

                        let headers = {
                            'User-Agent': 'Super Agent/0.0.1',
                            'Content-Type': 'application/x-www-form-urlencoded'
                        };

                        let options = {
                            url: credentials.endpoints.IPFS,
                            method: 'POST',
                            headers: headers,
                            form: {'ipfs': ipfsData.hash, }
                        };

                        request(options, function (error, response, body) {
                            console.log(error, response, body)
                        })


                    }, 100);
                    callback(ipfsData, destFile);
                } else {
                    console.error('IPFS not build files', resultFiles)
                }

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
    downloadFile(contentAddress, magnet, callback, privateContent = false) {
        let that = this;
        if (magnet) {
            let path = Constants.TORRENT_FOLDER + contentAddress;
            if (privateContent) {
                path += '-p'
            }

            path += Constants.FILE_SEPARATOR;
            File.mkpath(path);
            let hash = magnet.split('/')[0];
            let name = magnet.split('/')[1];

            this.node.files.get(hash, function (err, files) {
                if (err) {
                    console.error(err);
                } else {
                    console.log('File downloaded!', magnet, files);

                    let data = null;
                    for (let x = 0; x < files.length; x++) {
                        let f = files[x];
                        if (f.type === 'file' && f.content) {
                            data = f;
                            break;
                        }
                    }

                    if (!data) {
                        data = files[0];
                    }
                    let file = path + name;
                    File.write(file, data.content, 'binary');

                    if (callback) {
                        data.infoHash = hash;
                        data.magnetURI = magnet;
                        data.path = path;
                        callback(data, file, contentAddress);
                    }
                }
            })
        }
    }

    close() {
        this.node.stop(function () {
            console.log('IPFS node stopped!')
        });
    }
}

let fileClient = new FileClient();
fileClient.start();

trantor.events.on('onStop', function () {
    fileClient.close();
});
