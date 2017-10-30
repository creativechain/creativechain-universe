let control = require('electron').remote;
const Dialogs = require('dialogs');
let dialogs = Dialogs();

const {Coin, ContentData, Notifications, Utils, File, Network, Trantor, CreativeCoin, FileStorage,
    DecodedTransaction, Author, MediaData, Comment, Like, PUBLICATION, Prices} = require('./lib/trantor');
const Mime = require('mime-types');
let sessionStorage = FileStorage.load('./session.crea');
let trantor = control.getGlobal('trantor');

trantor.localStorage = localStorage;

const SESSION_DURATION_MILLIS = 30 * 60 * 1000; //30 minutes;

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
            rate: rate,
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