let control = require('electron').remote;
const Dialogs = require('dialogs');
let dialogs = Dialogs();

const {Coin, ContentData, Notifications, Utils, File, Network, Trantor, CreativeCoin, Globals, FileStorage,
    DecodedTransaction, Author, MediaData, Comment} = require('./lib/trantor');
const Mime = require('mime-types');
let sessionStorage = FileStorage.load('./session.crea');
let trantor = new Trantor();

const SESSION_DURATION_MILLIS = 30 * 60 * 1000; //30 minutes;

if (!String.format) {
    /**
     *
     * @param {string} format
     * @return {*|void|XML|string}
     */
    String.format = function(format) {
        let args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
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

let timeout;

document.onmousemove = function () {
    clearTimeout(timeout);
    timeout = setTimeout(function () {
        let win = remote.getCurrentWindow();
        win.close();
    }, SESSION_DURATION_MILLIS) //Close app on 30 minutes for inactivity
};

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
    LIKE_RATE: 0.3,
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
    getBuzz: function (likes, actions) {
        let rate = (likes * this.LIKE_RATE) + (actions * this.ACTION_RATE);
        let level = this.getLevel(rate);
        let icon = this.getLevelIcon(level);
        let levelText = this.translateLevel(level);
        let buzz = {
            rate: rate,
            level: level,
            icon: icon,
            levelText: levelText
        };

        return buzz;
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