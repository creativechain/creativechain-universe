let control = require('electron').remote;
let {dialog} = require('electron').remote;
let {shell, clipboard, ipcRenderer} = require('electron');
let isDev = require('electron-is-dev');
let cp = require('child_process');
let http = require('request');
let open = require('open');
let Mime = require('mime-types');
let QRCode = require('qrcode');
const crealib = require('bitcoinjs-lib');
let filesize = require('file-size');
let moment = require('moment');
let semver = require('semver');
let pjson = require('./package.json');
let creativechainCore = require('creativechain-platform-core');
let trantorJs = require('trantor-js');
let Mousetrap = require('mousetrap');
const {Utils, File, FileStorage, OS, DecodedTransaction, TransactionBuilder, Core, CoreConfiguration, RPCConfiguration, IpfsConfiguration} = creativechainCore;
const {Coin, CoinUri, CreativeCoin} = creativechainCore.Monetary;
const {Notifications, Prices} = require('./lib/utils');
const {ContentData, Author, MediaData, Comment, Like, TrantorNetwork, TrantorUtils} = trantorJs;
const ErrorCodes = creativechainCore.Error;
const CoreConstants = creativechainCore.Constants;
const TrantorConstants = trantorJs.Constants;

const CONSTANTS = false ? CoreConstants.TestnetConstants : CoreConstants.MainnetConstants;

let settings = FileStorage.load(CONSTANTS.APP_CONF_FILE);

const ONE_CREA = Coin.parseCash(100000000, 'CREA');
const TX_CONTENT_AMOUNT = Coin.parseCash(settings.getKey('action-amount', 0.005), 'CREA').amount;
const TX_FEE_KB = Coin.parseCash(0.00405, 'CREA').amount;

let credentials = FileStorage.load(CONSTANTS.CREDENTIALS_FILE).storage;
let urls = [credentials.endpoints.IPFS, credentials.endpoints.IPFS2];
let ipfsConfig = new IpfsConfiguration(CONSTANTS, null, null, urls);

const trantor = new Core(new CoreConfiguration(CONSTANTS, null, ipfsConfig), TX_CONTENT_AMOUNT, TX_FEE_KB);

let lang = control.getGlobal('lang');
let locale = control.getGlobal('locale');

moment.locale(locale);

if (OS.isMac()) {
    //Enable Copy and Paste keyboard Shortcuts on OSX

    Mousetrap.bind('command+c', function () {
        let selectedText = getSelectionText();
        clipboard.writeText(selectedText);
        console.log('Text copied!', selectedText);
        return false;
    });

    Mousetrap.bind('command+v', function () {
        console.log('CMD+V pressed!');
        let pasteText = clipboard.readText();
        let focused = $(document.activeElement);
        let valueText = focused.val();
        let cursorIndex = document.activeElement.selectionStart;

        let subString1 = valueText.substring(0, cursorIndex);
        let subString2 = valueText.substring(cursorIndex, valueText.length);

        let finalText = subString1 + pasteText + subString2;
        console.log(focused);
        focused.val(finalText);
        console.log('Text pasted!', pasteText);

        document.activeElement.selectionEnd = subString1.length + pasteText.length;
        return false;
    });
}


/**
 *
 * @return {string}
 */
function getSelectionText() {
    let text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    return text;
}

function stopClients() {
    trantor.stop();
    setTimeout(function () {
        console.log('Executing close timeout');
        ipcRenderer.send('closedAllClients');
    }, 7000);
}

ipcRenderer.on('stop-clients', function () {
    console.log('Stop clients received!');
    stopClients();
});

/*let Menu = control.Menu;

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
});*/

let reqPass = false;

const SESSION_DURATION_MILLIS = settings.getKey('session-time', 1800) * 1000;


let timeout;

const FILE = {
    AVATAR_MAX_SIZE: 500 * 1024, //500 Kb
    FEATURED_MAX_SIZE: 1 * 1024 * 1024, //1 MB
    PRIVATE_MAX_SIZE: 200 * 1024 * 1024, // 200 MB
};

let addClassMethod = jQuery.fn.addClass;

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

/*document.addEventListener("keydown", function (e) {
    if (e.which === 123) {
        control.getCurrentWindow().toggleDevTools();
    }
});*/

$('img').on('dragstart', function (event) {
    event.preventDefault();
    return false;
});

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
            walletPassword = null;
            inputPassword();
        }, SESSION_DURATION_MILLIS);
    };
}

function closeApp() {
    stopClients();
}

function minimize() {
    control.getCurrentWindow().minimize();
}

function maximize() {
    let win = control.getCurrentWindow();

    if (win.isMaximized()) {
        win.unmaximize();
    } else {
        win.maximize();
    }
}

/**
 *
 * @param {string} file
 * @param {string} address
 * @return {string}
 */
function resolveAvatar(file, address) {
    if (!file || !address) {
        //console.log(file, address);
    }

    if (OS.isWindows() && file) {
        file = file.replace(/\\/g, '/');
    }

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
    FOLLOWER_RATE: 0.2,
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
    getBuzz: function (resgistrationTime, likes, comments = 0, publications = 0, followers = 0, actions = 0) {

        //console.log('Buzz', from, likes, comments, publications, followers, actions);
        let rate = 0;
        rate += (likes * this.LIKE_RATE);
        rate += (comments * this.COMMENT_RATE);
        rate += (followers * this.FOLLOWER_RATE);
        rate += (publications * this.PUBLICATION_RATE);
        rate += (actions * this.ACTION_RATE);

        let now = new Date().getTime();
        now = parseInt(now / 1000); //TO SECONDS
        resgistrationTime = parseInt(resgistrationTime / 1000); //TO SECONDS
        let registerTime = resgistrationTime === 0 ? now : resgistrationTime;
        let timeDiff = now - registerTime;
        let days = timeDiff / 86400; //TO DAYS

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
                if (err) {
                    console.error(err);
                }
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
    return input ? input.replace(/<(?:.|\n)*?>/gm, '') : '';
}

/**
 *
 * @param {string} url
 * @return {boolean}
 */
function openUrlInBrowser(url) {
    open(url);
    return false;
}


function followButtonEnter(buttonId, followAddress, isFollowing) {

    let followButton = $('#' + buttonId);

    if (isFollowing) {
        followButton.removeClass('btn-therciary btn-following')
            .addClass('btn-primary-inverse btn-follow');
        followButton.html(lang.Unfollow);
    } else {
        followButton.html(lang.Follow)
            .addClass('btn-primary btn-follow')
            .removeClass('btn-therciary btn-following btn-primary-inverse');
    }
}

function followButtonLeave(buttonId, followAddress, isFollowing) {

    let followButton = $('#' + buttonId);

    if (isFollowing) {
        followButton.removeClass('btn-primary-inverse btn-follow')
            .addClass('btn-therciary btn-following');
        followButton.html(lang.Following);

    } else {
        followButton.html(lang.Follow)
            .addClass('btn-primary btn-follow')
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

trantor.on('core.started', function () {
    if (credentials.devtools) {
        let devs = credentials.devtools.alloweds;
        getUserAddress(function (userAddress) {
            if (devs.includes(userAddress)) {
                Mousetrap.bind(credentials.devtools.key, function () {
                    console.log('Toggling Dev Tools!');
                    control.getCurrentWindow().toggleDevTools();
                })
            }
        })
    }
});

trantor.on('core.stop', function () {
    console.log('onStop received!');
    modal.loading(lang.Stopping);
});

trantor.on('core.bootstrap.download', function () {
    console.log('Donwloading index.db');
    let credentials = FileStorage.load(CONSTANTS.CREDENTIALS_FILE);
    let url = credentials.getKey('base_url') + 'index.db';

    let downloadBootstrap = function (retry) {
        if (retry < 3) {
            File.download(url, CONSTANTS.DATABASE_FILE, null, function (err, file) {

                if (err) {
                    console.error(err);
                    setTimeout(function () {
                        downloadBootstrap(retry++);
                    }, 1000);
                } else {
                    console.log('index downloaded', file);
                    trantor.emit('core.bootstrap', file);
                }

            });
        } else {
            trantor.emit('core.bootstrap', CONSTANTS.DATABASE_FILE);
        }
    };

    downloadBootstrap(0);
});
