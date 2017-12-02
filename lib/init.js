let control = require('electron').remote;
let {dialog} = require('electron').remote;
let http = require('request');
let Mime = require('mime-types');
let QRCode = require('qrcode');
const {Coin, CoinUri, ContentData, Notifications, Utils, File, Network, Trantor, CreativeCoin, FileStorage,
    DecodedTransaction, Author, MediaData, Comment, Like, PUBLICATION, Prices, Constants, Torrents, OS} = require('./lib/trantor');

let trantor = new Trantor();
let lang = control.getGlobal('lang');
let appPath = control.getGlobal('appPath');

window.onbeforeunload = function () {
    trantor.stop();
};
let appStorage = FileStorage.load();
console.log(appPath);
let torrentClient = new Torrents();
let settings = FileStorage.load();
let reqPass = false;
const SESSION_DURATION_MILLIS = settings.getKey('session-time', 1800) * 1000;

let timeout;

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
 * @param {string} optional
 * @param size
 * @return {string}
 */
function resolveAvatar(file, optional, size = 40) {
   return File.exist(file) ? file : 'https://api.adorable.io/avatars/' + size + '/'+ optional;
}

const BUZZ = {
    LIKE_RATE: 0.1,
    COMMENT_RATE: 0.2,
    PUBLICATION_RATE: 0.3,
    ACTION_RATE: 0.5,
    TRAINEE: 0,
    EXPERT: 987,
    INFLUENCER: 1597,
    MASTER: 2584,
    GENIUS: 4181,
    LEVELS: [this.TRAINEE, this.EXPERT, this.INFLUENCER, this.MASTER, this.GENIUS],
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
                return './assets/img/genius.png';
            case this.MASTER:
                return './assets/img/master.png';
            case this.INFLUENCER:
                return './assets/img/influencer.png';
            case this.EXPERT:
                return './assets/img/expert.png';
            default:
                return './assets/img/trainee.png';
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

function getLicenseIcon(license) {
    switch (license) {
        case 0:
            return ['./assets/img/cc-icons/zero.svg'];
        case 1:
            return ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nc.svg', './assets/img/cc-icons/sa.svg'];
        case 2:
            return ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nd.svg'];
        case 3:
            return ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nc.svg', './assets/img/cc-icons/sa.svg'];
        case 4:
            return ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nc.svg'];
        case 5:
            return ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/sa.svg'];
        case 6:
            return ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg', './assets/img/cc-icons/nd.svg'];
        case 7:
            return ['./assets/img/cc-icons/cc.svg', './assets/img/cc-icons/by.svg'];
    }
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
        this.hide();
        $('#modal-title').html(opts.title || '');
        if (opts.loading) {
            $('#modal-message').css('display', 'none');
            $('#modal-qr').css('display', 'none');
            $('#modal-loading').css('display', 'inherit');
        } else if (opts.qr) {
            $('#modal-message').css('display', 'none');
            $('#modal-qr').css('display', 'inherit');
            $('#modal-loading').css('display', 'none');

            QRCode.toCanvas(document.getElementById('modal-qr'), opts.text, opts, function (err) {
                console.log(err)
            })
        } else {
            $('#modal-loading').css('display', 'none');
            $('#modal-qr').css('display', 'none');
            $('#modal-message').css('display', 'inherit');
            $('#modal-message').html(opts.message || '');
        }
        if (opts.cancel) {
            $('#modal-cancel').css('display', 'inherit');
            $('#modal-cancel').html(opts.cancel.text || lang.Cancel);
            $('#modal-cancel').click(function () {
                if (opts.cancel.onclick) {
                    opts.cancel.onclick();
                }
                that.hide();
            });


        } else {
            $('#modal-cancel').css('display', 'none')
        }

        if (opts.ok) {
            $('#modal-ok').css('display', 'inherit');
            $('#modal-ok').html(opts.ok.text || 'Ok');
            $('#modal-ok').click(function () {
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
            $('#modal-ok').css('display', 'none')
        }

        $('#modal-password').css('display', opts.password ? 'inherit' : 'none');

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

        if (opts.show) {
            $('#modal').modal('show');
        }

        return $('#modal');
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
        let defaultOpts = {
            show: true,
            ok: {
                text: 'Ok',
            },
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
    loading: function (opts) {
        let defaultOpts = {
            show: true,
            loading: true,
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

    hide: function () {
        $('#modal').modal('hide');
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
        let htmlTag = '<span onclick="searchTag(\'' + tag + '\')" style="text-decoration: underline; cursor: pointer">' + tag + '</span>'
        htmlTags.push(htmlTag);
    });
    htmlTags = htmlTags.join(', ');
    return htmlTags;
}
