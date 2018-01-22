
const fs = require('fs');
const os = require('os');
const exec = require('child_process').exec;
const request = require('request');
const lzma = require('lzma');
const varint = require('varint');
const sha256 = require('sha256');
const creativecoin = require('bitcoinjs-lib');
const coinselect = require('coinselect');
const RpcClient = require('altcoin-rpc');
const sqlite = require('sqlite3').verbose();
const isDev = require('electron-is-dev');
let filesize = require('file-size');
let path = require('path');
let upath = require('upath');

class CoinUri {

    /**
     *
     * @param {string} address
     * @param {string} amount
     * @param {string} label
     * @param {string} message
     */
    constructor(address, amount, label, message) {
        this.address = address;
        this.amount = amount;
        this.label = label;
        this.message = message;
    }

    /**
     * @return {string}
     */
    toString() {
        let uri = 'creativecoin:';
        let hasAmount = this.amount && this.amount > 0;
        let hasLabel = this.label && this.label.length > 0;
        let hasMessage = this.message && this.message.length > 0;
        let addedFirst = false;

        if (this.address) {
            uri += this.address;
        }

        if (hasAmount ||hasLabel || hasMessage) {
            uri += '?';
        }

        if (hasAmount) {
            uri += addedFirst ? '&' : '';
            uri += 'amount=' + this.amount;
            addedFirst = true;
        }

        if (hasLabel) {
            uri += addedFirst ? '&' : '';
            uri += 'label=' + encodeURIComponent(this.label);
            addedFirst = true;
        }

        if (hasMessage) {
            uri += addedFirst ? '&' : '';
            uri += 'message=' + encodeURIComponent(this.message);
        }

        return uri;
    }
}

class Currency {
    constructor(name, code, symbol, scale) {
        this.name = name;
        this.code = code;
        this.symbol = symbol;
        this.scale = scale;
    };

    getName() {
        return this.name;
    };

    getCode() {
        return this.code;
    };

    getSymbol() {
        return this.symbol;
    };

    getScale() {
        return this.scale;
    };

    /**
     *
     * @param currency
     * @returns {Currency}
     */
    static parseCurrency(currency) {
        if (currency.code && currency.symbol && currency.name) {
            currency = currency.code.toUpperCase();
        }

        if (typeof currency === 'string') {
            currency = currency.toUpperCase();

            switch (currency) {
                case '€':
                case 'EURO':
                case 'EUR':
                    return new Eur();
                case '$':
                case 'DOLLAR':
                case 'USD':
                    return new Usd();
                case 'MXN':
                case 'PESO':
                    return new Mxn();
                case 'ZŁ':
                case 'ZLOTI':
                case 'PLN':
                    return new Pln();
                case 'BTC':
                case 'BITCOIN':
                    return new Btc();
                case 'CREA':
                case 'CREATIVECOIN':
                    return new Crea();
                default:
                    return new UnknownCurrency();
            }
        } else if (currency instanceof Currency) {
            return currency;
        }

        return new UnknownCurrency();
    };
}

class UnknownCurrency extends Currency {

    constructor() {
        super('unknow', 'UNK', 'UNK', 0);
    }
}

class FiatCurrency extends Currency {

    constructor(name, code, symbol) {
        super(name, code, symbol, 2);
    }
}

class CryptoCurrency extends Currency {
    constructor(name, code, symbol) {
        super(name, code, symbol, 8);
    }
}

class Eur extends FiatCurrency {
    constructor() {
        super('euro', 'EUR', '€');
    }
}

class Usd extends FiatCurrency {
    constructor() {
        super('dollar', 'USD', '$');
    }
}

class Mxn extends FiatCurrency {
    constructor() {
        super('peso', 'MXN', 'MXN');
    }
}

class Pln extends FiatCurrency {
    constructor() {
        super('zloti', 'PLN', 'zł');
    }
}

class Btc extends CryptoCurrency {
    constructor() {
        super('bitcoin', 'BTC', 'BTC');
    }
}

class Crea extends CryptoCurrency {
    constructor() {
        super('creativecoin', 'CREA', 'CREA');
    }
}

class Coin {
    constructor(currency, amountInCents) {
        this.amount = amountInCents;
        this.currency = currency;
    };

    add(amount) {
        if (amount instanceof Coin && amount.currency === this.currency) {
            amount = amount.amount;
            this.amount = this.amount + amount;
        } else if (typeof amount === 'number') {
            this.amount = this.amount + amount;
        }
    };

    subtract(amount) {
        if (amount instanceof Coin && amount.currency === this.currency) {
            amount = amount.amount;
            this.amount = this.amount - amount;
        } else if (typeof amount === 'number') {
            this.amount = this.amount - amount;
        }
    };

    multiply(amount) {
        if (amount instanceof Coin && amount.currency === this.currency) {
            amount = amount.amount;
            this.amount = this.amount * amount;
        } else if (typeof amount === 'number') {
            this.amount = this.amount * amount;
        }
    };

    divide(amount) {
        if (amount instanceof Coin && amount.currency === this.currency) {
            amount = amount.amount;
            this.amount = this.amount / amount;
        } else if (typeof amount === 'number') {
            this.amount = this.amount / amount;
        }
    };

    /**
     *
     * @returns {number}
     */
    getScaleValue() {
        return this.amount / Math.pow(10, this.currency.getScale());
    };

    /**
     *
     * @returns {number}
     */
    getAmount() {
        return this.amount;
    };

    /**
     *
     * @returns {Currency}
     */
    getCurrency() {
        return this.currency;
    };

    /**
     *
     * @param maxDecimals
     * @returns {string}
     */
    toPlainString(maxDecimals) {

        if (isNaN(maxDecimals)) {
            maxDecimals = this.currency.getScale();
        }

        let mf = new MonetaryFormat();
        mf.digits(maxDecimals);
        return mf.format(Math.abs(this.amount), this.currency.getScale());
    };

    toFriendlyString(maxDecimals) {
        return this.toPlainString(maxDecimals) + " " + this.currency.getSymbol();
    };

    toString() {
        return this.toFriendlyString(this.currency.getScale());
    };

    /**
     *
     * @param amount
     * @param currency
     * @returns {Coin}
     */
    static parseCash(amount, currency) {
        currency = Currency.parseCurrency(currency);
        let isNumber = typeof amount === 'number';
        if (isNumber) {
            let isDecimal = isNumber && amount.toString().indexOf('.') > 0;

            let rounded = 0;

            if (!isDecimal) {
                rounded = currency.getScale();
            }

            amount = Math.round(amount * Math.pow(10, currency.getScale() - rounded));
        } else if (typeof amount === 'string' && !isNaN(amount)) {
            amount = amount.replace(',', '.');
            if (amount.indexOf('.') > 0) {
                return Coin.parseCash(parseFloat(amount), currency);
            }

            return Coin.parseCash(parseInt(amount), currency);
        } else {
            amount = 0;
        }


        switch (currency.code) {
            case 'EUR':
                return new EurCoin(amount);
            case 'USD':
                return new DollarCoin(amount);
            case 'MXN':
                return new PesoCoin(amount);
            case 'PLN':
                return new ZlotiCoin(amount);
            case 'BTC':
                return new BitCoin(amount);
            case 'CREA':
                return new CreativeCoin(amount);
            default:
                return new Coin(currency, amount);
        }
    }
}

class MonetaryFormat {
    constructor() {
        this.maxDigits = 2;
    };

    digits(maxDigits) {

        if (isNaN(maxDigits)) {
            maxDigits = 2;
        }

        this.maxDigits = maxDigits;
    };

    /**
     *
     * @param {Number} value
     * @param {Number} exponent
     * @returns {string}
     */
    format(value, exponent) {
        if (typeof value !== "number") {
            value = 0;
        }

        if (typeof exponent !== "number") {
            exponent = 2;
        }

        let toFloat = (value / Math.pow(10, exponent)).toFixed(this.maxDigits);
        return String(toFloat);
    };
}

class CryptoCoin extends Coin {
    constructor(currency, amountInCents) {
        super(currency, amountInCents);
    }

    toPlainString(maxDigits) {
        if (isNaN(maxDigits)) {
            maxDigits = this.currency.getScale();
        }

        let digits = maxDigits;
        let stringNumber = (this.amount / Math.pow(10, this.currency.getScale())).toFixed(this.currency.getScale());
        let parts = stringNumber.split('.');
        let decimal = String(parts[1]);

        if (decimal.charAt(0) !== '0') {
            let decimalString = String(parseInt(decimal));
            digits = decimalString.length;

            if (digits > maxDigits) {
                digits = maxDigits;
            }
        } else {
            digits = this.currency.getScale();
        }

        let mf = new MonetaryFormat();
        mf.digits(digits);
        return mf.format(Math.abs(this.amount), this.currency.getScale());
    };
}

class EurCoin extends Coin {
    constructor(amountInCents) {
        super(new Eur(), amountInCents);
    }
}

class BitCoin extends CryptoCoin {
    constructor(amountInCents) {
        super(new Btc(), amountInCents);
    }
}

class CreativeCoin extends CryptoCoin {
    constructor(amountInCents) {
        super(new Crea(), amountInCents);
    }
}

class DollarCoin extends Coin {
    constructor(amountInCents) {
        super(new Usd(), amountInCents);
    }
}

class PesoCoin extends Coin {
    constructor(amountInCents) {
        super(new Mxn(), amountInCents);
    }
}

class ZlotiCoin extends Coin {
    constructor(amountInCents) {
        super(new Pln(), amountInCents);
    }
}

class Prices {
    /**
     *
     * @param amount
     * @param price
     * @returns {Coin}
     */
    static convert(amount, price) {
        let amountConverted = (amount.amount * price.amount) / Math.pow(10, amount.currency.scale + price.currency.scale);
        return Coin.parseCash(amountConverted, price.currency);
    }
}

const ONE_CREA = Coin.parseCash(100000000, 'CREA');
const TX_CONTENT_AMOUNT = Coin.parseCash(0.001, 'CREA').amount;
const TX_FEE_KB = Coin.parseCash(0.00405, 'CREA').amount;
const TX_CURRENT_VERSION = 0x0002;
const TX_CONTENT_VERSION = 0x0008;
const TX_DEFAULT_VERSION = TX_CURRENT_VERSION | TX_CONTENT_VERSION;
const COMPRESSION_LEVEL = 9;

const PUBLICATION = {};
PUBLICATION.MAGIC_BYTE = 0xB8; //Start flag to read content
PUBLICATION.VERSION = 0x0100; //Content version

PUBLICATION.TYPE = {
    EMPTY: 0x00,
    CONTENT: 0x01,
    USER: 0x02,
    LIKE: 0x03,
    COMMENT: 0x04,
    DONATION: 0x05,
    FOLLOW: 0x06,
    UNFOLLOW: 0x07,
    INDEX: 0x08,
    UNLIKE: 0x09,
    PAYMENT: 0x10,
    BLOCK: 0x11,
    OTHER: 0xFF,
};

PUBLICATION.LICENSE = {
    CC010: 0x00, //Creativecoin Commons Public Domain
    PPBYNCSA: 0x01, //CC Peer Production. Attribution-NonCommercial-ShareAlike
    CCBYNCND40: 0x02, //CC Attribution-NonComercial-NoDerivs 4.0 International
    CCBYNCSA40: 0x03, //CC Attribution-NonCommercial-ShareAlike 4.0 International
    CCBYNC40: 0x04, //CC Attribution-NonComercial 4.0 International
    CCBYSA40: 0x05, //CC CC-BY-SA-4.0: Attribution-ShareAlike 4.0 International
    CCBYND40: 0x06, //CC CC-BY-ND-4.0: Attribution-NoDerivs 4.0 International
    CCBY40: 0x07, //CC Attribution 4.0 international
};

class ErrorCodes {}
ErrorCodes.INVALID_PLATFORM = 'INVALID_PLATFORM';
ErrorCodes.BINARY_NOT_FOUND = 'BINARY_NOT_FOUND';
ErrorCodes.CONTACT_EXISTS = 'CONTACT_EXISTS';
ErrorCodes.NOT_SPENDABLES = 'NOT_SPENDABLES';
ErrorCodes.INSUFFICIENT_AMOUNT = 'INSUFFICIENT_AMOUNT';


class OS {

    static getPlatform() {
        return os.platform();
    }

    static getRelease() {
        return os.release();
    }

    static getArch() {
        return os.arch();
    }

    static isLinux() {
        return os.platform().toLowerCase().includes('linux');
    };

    static isWindows() {
        return os.platform().toLowerCase().includes('win32');
    };

    static isMac() {
        return os.platform().toLowerCase().includes('darwin');
    }

    static is64Bits() {
        return os.arch().toLowerCase().includes('64');
    }

    /**
     *
     * @return {string}
     */
    static getAsarFolder() {
        let path = __dirname;
        path = path.replace('\\l', '/l')
            .replace('/lib', '');

        return path;
    }

    /**
     *
     * @returns {string}
     */
    static getPathSeparator() {
        return '/';
    }

    /**
     *
     * @returns {string}
     */
    static getHome() {
        if (OS.isLinux() || OS.isMac()) {
            return process.env.HOME;
        }

        return process.env.USERPROFILE;
    }

    static getFilenameVersion() {
        if (OS.isLinux()) {
            return OS.is64Bits() ? 'linux64' : 'linux32'
        } else if (OS.isMac()) {
            return 'osx'
        } else if (OS.isWindows()) {
            return OS.is64Bits() ? 'win64.exe' : 'win32.exe'
        }

        throw ErrorCodes.INVALID_PLATFORM;
    }

    static getOSTag() {
        if (OS.isLinux()) {
            return 'linux64';
        } else if (OS.isMac()) {
            return 'osx'
        } else if (OS.isWindows()) {
            return OS.is64Bits() ? 'win64' : 'win32';
        }

        throw ErrorCodes.INVALID_PLATFORM;
    }

    static getExecutableExtension() {
        if (OS.isLinux() || OS.isMac()) {
            return '';
        }

        return '.exe';
    }

    /**
     *
     * @param command
     * @param callback
     */
    static run(command, callback) {
        exec(command, function (error, result, stderr) {
            if (callback !== null) {
                if (error) {
                    callback(error, stderr);
                } else {
                    callback(result, null);
                }
            }
        })
    };
}

class  Constants {}

Constants.DEBUG = true;
Constants.START_BLOCK = Constants.DEBUG ? 5961 : 100000;
Constants.FILE_SEPARATOR = OS.getPathSeparator();
Constants.APP_FOLDER = OS.getHome() + Constants.FILE_SEPARATOR + '.creativechain-platform';
Constants.ASAR_FOLDER = isDev ? '.' : OS.getAsarFolder();
Constants.EXTRA_FOLDER = Constants.ASAR_FOLDER + Constants.FILE_SEPARATOR + 'extra' + Constants.FILE_SEPARATOR;
Constants.DBMIGRATIONS_FOLDER = Constants.EXTRA_FOLDER + 'dbmigrations' + Constants.FILE_SEPARATOR;
Constants.CREDENTIALS_FILE = Constants.EXTRA_FOLDER + 'credentials.json';
Constants.DATABASE_CREATION_FILE = Constants.EXTRA_FOLDER + 'index.db.sql';
Constants.BIN_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'bin' + Constants.FILE_SEPARATOR;
Constants.LANG_FOLDER = Constants.ASAR_FOLDER + Constants.FILE_SEPARATOR + 'assets' + Constants.FILE_SEPARATOR + 'lang' + Constants.FILE_SEPARATOR;
Constants.TORRENT_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'torrents' + Constants.FILE_SEPARATOR;
Constants.TORRENT_DATA_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'torrents' + Constants.FILE_SEPARATOR + 'data' + Constants.FILE_SEPARATOR;
Constants.STORAGE_FILE = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'app.conf';
Constants.SESSION_FILE = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'session.crea';
Constants.TRANTOR_FILE = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'trantor.dat';
Constants.BINARIES_URL = 'https://binaries.creativechain.net/latest/';
Constants.DAEMON_URL = Constants.BINARIES_URL + 'creativecoind-';
Constants.CHECKSUMS_URL = Constants.BINARIES_URL + 'sha256sums.txt';
Constants.CLIENT_URL = Constants.BINARIES_URL + 'creativecoin-cli-';
Constants.BINARY_NAME = 'creativecoind' + '-' + OS.getOSTag() + OS.getExecutableExtension();
Constants.DATABASE_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'database' + Constants.FILE_SEPARATOR;
Constants.DATABASE_FILE = Constants.DATABASE_FOLDER + 'index.db';
Constants.TICKER_URL = 'https://api.coinmarketcap.com/v1/ticker/creativecoin/?convert=';


class File {


    /**
     *
     * @param path
     * @return {XMLList|XML|string}
     */
    static normalizePath(path) {
        return upath.normalize(path);
    }

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
     * @return {string|Buffer}
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
        path = File.normalizePath(path);
        return path.split(Constants.FILE_SEPARATOR).pop();
    }

    static mkdir(path) {
        path = File.normalizePath(path);
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
        path = File.normalizePath(path);
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
     * @param {string} url
     * @param {string} targetPath
     * @param progressCallback
     * @param callback
     */
    static download(url, targetPath, progressCallback, callback) {
        let receivedBytes = 0;
        let totalBytes = 0;

        File.mkpath(targetPath, true);
        let req = request({
            method: 'GET',
            uri: url
        });

        let out = fs.createWriteStream(targetPath);
        req.pipe(out);

        req.on('response', function (data) {
            totalBytes = parseInt(data.headers['content-length']);
        });

        req.on('error', function (err) {
            if (callback) {
                callback(err);
            }
        });

        req.on('data', function (chunk) {
            if (progressCallback) {
                receivedBytes += chunk.length;

                let percentage = (receivedBytes * 100) / totalBytes;
                progressCallback(percentage)
            }
        });

        req.on('end', function () {
            console.log('File downloaded!');
            if (callback) {
                callback(null, targetPath);
            }
        })

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

class FileStorage {
    constructor(storage, path) {
        this.storage = storage ? storage : {};
        this.path = path;
    }


    /**
     *
     * @param {string} key
     * @return {boolean}
     */
    hasKey(key) {
        let val = this.storage[key];
        return val !== null && val !== undefined;
    }

    /**
     *
     * @param {string} key
     * @param {*} defaultValue
     * @return {*}
     */
    getKey(key, defaultValue = undefined) {
        if (this.hasKey(key)) {
            return this.storage[key];
        }

        return defaultValue;
    }

    /**
     *
     * @param {string} key
     * @param {*} value
     */
    setKey(key, value) {
        this.storage[key] = value;
        this.save();
    }

    save() {
        let content = JSON.stringify(this.storage, null, 4);
        File.write(this.path, content);
    }

    /**
     *
     * @param {string} path
     * @return {FileStorage}
     */
    static load(path = null) {
        if (!path) {
            path = Constants.STORAGE_FILE;
        }

        if (File.exist(path)) {
            let content = File.read(path);
            content = JSON.parse(content);
            return new FileStorage(content, path);
        }

        return new FileStorage(null, path);
    }
}

class Utils {
    /**
     *
     * @param length
     * @returns {string}
     */
    static randomString(length) {
        let string = "";
        let chars =  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvqxyz";

        for (let x = 0; x < length; x++) {
            string += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return string;
    }

    /**
     *
     * @param {number} min
     * @param {number} max
     * @return {number}
     */
    static randomNumber(min = 0, max = 100) {
        return parseInt(Math.floor(Math.random() * (max - min + 1) + min));
    }

    /**
     *
     * @param {Buffer} data
     * @param {number} mode
     * @param callback
     */
    static compress(data, mode, callback) {
        console.log('Compressing data: ', data.length, data.toString('hex'));
        let compressor = new lzma.LZMA();
        compressor.compress(data, mode, function (result, error) {
            result = Buffer.from(result);
            console.log('Data compressed:', result.length, result.toString('hex'));
            callback(result, error);
        })
    }

    /**
     *
     * @param {Buffer} data
     * @return {Buffer}
     */
    static decompress(data) {
        let compressor = new lzma.LZMA();
        let result = compressor.decompress(data);
        return Buffer.from(result);
    }

    /**
     *
     * @param {string|Buffer} data
     * @return {string}
     */
    static makeHash(data) {
        return sha256(data);
    }

    /**
     *
     * @param {*} obj
     * @return {Array}
     */
    static keys(obj) {
        let keys = [];
        if (obj) {
            for (let k in obj) {
                keys.push(k);
            }
        }

        return keys;
    }

    /**
     *
     * @param {string} query
     * @param {string} key
     * @return {string}
     */
    static getQueryValue(query, key) {
        let params = (new URL(query)).searchParams;
        return params.get(key);
    }

    /**
     *
     * @param ms
     * @returns {Promise}
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}

class ContentData {
    constructor(version = PUBLICATION.VERSION, type) {
        this.version = version;
        this.type = type;
        this.mustBeCompressed = 0;
    }

    /**
     *
     * @return {Number}
     */
    size() {
        return this.serialize().length;
    }

    setCompression() {
        this.mustBeCompressed = 0;
        let length = this.size();
        this.mustBeCompressed = length >= 160 ? 1 : 0;
    }
    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        throw Error('Method Not Supported');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        this.version = buffer.readUInt16BE(offset);
        offset += 2;
        this.type = buffer.readInt8(offset);
        offset +=1;
        return offset;
    }

    /**
     *
     * @param {string} text
     * @param {Buffer} buffer
     * @param limit
     */
    static checkLimit(text, buffer, limit) {
        if (text.length > limit.TEXT || buffer.length > limit.BINARY) {
            throw Error("Text is too large: " + text);
        }
    }

    /**
     *
     * @param {number} number
     * @param {number} length
     * @return {string}
     */
    static serializeNumber(number, length = 0) {
        let numberHex = number.toString(16);
        let pairChars = numberHex.length % 2 === 0;

        let neededChars;
        if (length) {
            neededChars = length * 2;
        } else {
            neededChars = pairChars ? numberHex.length : numberHex.length + 1;
        }

        let leadingZeros = neededChars - numberHex.length;

        for (let x = 0; x < leadingZeros; x++) {
            numberHex = '0' + numberHex;
        }
        return numberHex;
    }

    /**
     * @param {string} text
     * @param limit
     */
    static serializeText(text, limit) {
        if (text && text.length > 0) {
            let textHex = String.hexEncode(text);
            let textBuffer = Buffer.from(textHex, 'hex');
            if (limit) {
                ContentData.checkLimit(text, textBuffer, limit);
            }

            return Buffer.from(varint.encode(textBuffer.length)).toString('hex') + textHex;
        } else {
            return Buffer.from(varint.encode(0)).toString('hex');
        }
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @return {object}
     */
    static deserializeText(buffer, offset) {
        let varInt = varint.decode(buffer, offset);
        offset += varint.decode.bytes;
        let textHex = buffer.slice(offset, offset + varInt).toString('hex');

        return {
            text: String.hexDecode(textHex),
            offset: varInt + varint.decode.bytes
        }
    }

    /**
     *
     * @param {Buffer} data
     * @return {ContentData}
     */
    static deserializeData(data) {
        let buffer = data;
        let compressed = parseInt(buffer.slice(0, 1));

        if (compressed) {
            buffer = Utils.decompress(data.slice(1));
        }

        let type = parseInt(buffer.slice(2, 3).toString('hex'), 16);
        //console.log('data', type, buffer.toString('hex'));
        let contentData = null;
        switch (type) {
            case PUBLICATION.TYPE.CONTENT:
                contentData = new MediaData();
                break;
            case PUBLICATION.TYPE.USER:
                contentData = new Author();
                break;
            case PUBLICATION.TYPE.LIKE:
                contentData = new Like();
                break;
            case PUBLICATION.TYPE.UNLIKE:
                contentData = new Unlike();
                break;
            case PUBLICATION.TYPE.PAYMENT:
                contentData = new Payment();
                break;
            case PUBLICATION.TYPE.COMMENT:
                contentData = new Comment();
                break;
            case PUBLICATION.TYPE.DONATION:
                contentData = new Donation();
                break;
            case PUBLICATION.TYPE.FOLLOW:
                contentData = new Follow();
                break;
            case PUBLICATION.TYPE.UNFOLLOW:
                contentData = new Unfollow();
                break;
            case PUBLICATION.TYPE.BLOCK:
                contentData = new BlockContent();
                break;
            case PUBLICATION.TYPE.INDEX:
                contentData = new Index();
                break;
        }

        if (contentData) {
            contentData.mustBeCompressed = compressed;
            contentData.deserialize(buffer, 0);
            return contentData;
        }

        return null;
    }
}

class Index extends ContentData {
    /**
     *
     * @param {Array} txIds
     */
    constructor(txIds) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.INDEX);
        this.txIds = txIds;
    }

    /**
     *
     * @return {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version);
        bufferHex += ContentData.serializeNumber(this.type);

        bufferHex += Buffer.from(varint.encode(this.txIds.length)).toString('hex');

        this.txIds.forEach(function (txId) {
            let buff = Buffer.from(txId, 'hex');
            if (buff.length !== 32) {
                throw 'Invalid txId: ' + txId;
            }

            bufferHex += buff.toString('hex');
        });

        return Buffer.from(bufferHex, 'hex');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        offset = super.deserialize(buffer, offset);

        let varInt = varint.decode(buffer, offset);
        offset += varint.decode.bytes;

        this.txIds = [];
        for (let x = 0; x < varInt.value; x++) {
            let tx = buffer.slice(offset, offset+32);
            offset += 32;
            this.txIds.push(tx.toString('hex'));
        }

        return offset;
    }
}

class Author extends ContentData {
    /**
     *
     * @param {string} address
     * @param {string} nick
     * @param {string} email
     * @param {string} web
     * @param {string} description
     * @param {string} avatar
     * @param {Array} tags
     */
    constructor(address, nick, email, web, description, avatar, tags) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.USER);
        this.address = address;
        this.nick = nick;
        this.email = email;
        this.web = web;
        this.description = description;
        this.avatar = avatar;
        this.tags = tags ? tags : [];
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version);
        bufferHex += ContentData.serializeNumber(this.type);
        bufferHex += creativecoin.address.fromBase58Check(this.address).hash.toString('hex');

        bufferHex += ContentData.serializeText(this.nick);
        bufferHex += ContentData.serializeText(this.email);
        bufferHex += ContentData.serializeText(this.web);
        bufferHex += ContentData.serializeText(this.description);
        bufferHex += ContentData.serializeText(this.avatar);
        let tags = JSON.stringify(this.tags);
        bufferHex += ContentData.serializeText(tags);
        console.log(bufferHex);
        return Buffer.from(bufferHex, 'hex');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        offset = super.deserialize(buffer, offset);
        this.address = buffer.slice(offset, offset + 20);
        this.address = creativecoin.address.toBase58Check(this.address, NETWORK.pubKeyHash);
        offset += 20;

        let desNick = ContentData.deserializeText(buffer, offset);
        this.nick = desNick.text;
        offset += desNick.offset;

        let desEmail = ContentData.deserializeText(buffer, offset);
        this.email = desEmail.text;
        offset += desEmail.offset;

        let desWeb = ContentData.deserializeText(buffer, offset);
        this.web = desWeb.text;
        offset += desWeb.offset;

        let desDesc = ContentData.deserializeText(buffer, offset);
        this.description = desDesc.text;
        offset += desDesc.offset;

        let desAva = ContentData.deserializeText(buffer, offset);
        this.avatar = desAva.text;
        offset += desAva.offset;

        let desTags = ContentData.deserializeText(buffer, offset);
        this.tags = JSON.parse(desTags.text);
        offset += desTags.offset;
        return offset;
    }
}

class MediaData extends ContentData {

    /**
     *
     * @param {string} title
     * @param {string} description
     * @param {string} contentType
     * @param {number} license
     * @param {string} userAddress
     * @param {string} contentAddress
     * @param {Array} tags
     * @param {number} price
     * @param {string} publicContent
     * @param {string} privateContent
     * @param {string} hash
     * @param {number} publicFileSize
     * @param {number} privateFileSize
     */
    constructor(title, description, contentType, license, userAddress, contentAddress, tags, price, publicContent, privateContent, hash, publicFileSize, privateFileSize) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.CONTENT);
        this.userAddress = userAddress;
        this.contentAddress = contentAddress;
        this.license = license;
        this.title = title;
        this.description = description;
        this.contentType = contentType;
        this.tags = tags ? tags : [];
        this.price = price ? price : 0;
        this.publicContent = publicContent;
        this.privateContent = privateContent;
        this.hash = hash;
        this.publicFileSize = publicFileSize ? publicFileSize : 0;
        this.privateFileSize = privateFileSize ? privateFileSize : 0;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version);
        bufferHex += ContentData.serializeNumber(this.type);
        bufferHex += creativecoin.address.fromBase58Check(this.userAddress).hash.toString('hex');
        bufferHex += creativecoin.address.fromBase58Check(this.contentAddress).hash.toString('hex');
        bufferHex += ContentData.serializeNumber(this.license);
        bufferHex += ContentData.serializeText(this.title);
        bufferHex += ContentData.serializeText(this.description);
        bufferHex += ContentData.serializeText(this.contentType);
        let tags = JSON.stringify(this.tags);
        bufferHex += ContentData.serializeText(tags);
        bufferHex += ContentData.serializeNumber(this.price, 8);
        bufferHex += ContentData.serializeText(this.publicContent);
        bufferHex += ContentData.serializeText(this.privateContent);

        bufferHex += this.hash;
        bufferHex += ContentData.serializeNumber(this.publicFileSize, 4);
        bufferHex += ContentData.serializeNumber(this.privateFileSize, 4);

        console.log('Media hex', bufferHex, this);
        return Buffer.from(bufferHex, 'hex');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        offset = super.deserialize(buffer, offset);
        this.userAddress = buffer.slice(offset, offset + 20);
        this.userAddress = creativecoin.address.toBase58Check(this.userAddress, NETWORK.pubKeyHash);
        offset += 20;

        this.contentAddress = buffer.slice(offset, offset + 20);
        this.contentAddress = creativecoin.address.toBase58Check(this.contentAddress, NETWORK.pubKeyHash);
        offset += 20;

        this.license = buffer[offset];
        offset += 1;

        let desTitle = ContentData.deserializeText(buffer, offset);
        this.title = desTitle.text;
        offset += desTitle.offset;

        let desComment = ContentData.deserializeText(buffer, offset);
        this.description = desComment.text;
        offset += desComment.offset;

        let destContentType = ContentData.deserializeText(buffer, offset);
        this.contentType = destContentType.text;
        offset += destContentType.offset;

        let desTags = ContentData.deserializeText(buffer, offset);
        this.tags = JSON.parse(desTags.text);
        offset += desTags.offset;

        this.price = parseInt(buffer.slice(offset, offset + 8).toString('hex'), 16);
        offset += 8;

        let publicContent = ContentData.deserializeText(buffer, offset);
        this.publicContent = publicContent.text;
        offset += publicContent.offset;

        let privateContent = ContentData.deserializeText(buffer, offset);
        this.privateContent = privateContent.text;
        offset += privateContent.offset;

        this.hash = buffer.slice(offset, offset + 32).toString('hex');
        offset += 32;

        this.publicFileSize = parseInt(buffer.slice(offset, offset + 4).toString('hex'), 16);
        offset += 4;

        this.privateFileSize = parseInt(buffer.slice(offset, offset + 4).toString('hex'), 16);
        offset += 4;

        return offset;
    }
}

class Like extends ContentData {
    /**
     *
     * @param {string} author
     * @param {string} contentAddress
     */
    constructor(author, contentAddress) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.LIKE);
        this.author = author;
        this.contentAddress = contentAddress;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version);
        bufferHex += ContentData.serializeNumber(this.type);
        bufferHex += creativecoin.address.fromBase58Check(this.author).hash.toString('hex');
        bufferHex += creativecoin.address.fromBase58Check(this.contentAddress).hash.toString('hex');
        return Buffer.from(bufferHex, 'hex');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        offset = super.deserialize(buffer, offset);
        this.author = buffer.slice(offset, offset + 20);
        this.author =  creativecoin.address.toBase58Check(this.author, NETWORK.pubKeyHash);
        offset += 20;

        this.contentAddress = buffer.slice(offset, offset + 20);
        this.contentAddress =  creativecoin.address.toBase58Check(this.contentAddress, NETWORK.pubKeyHash);
        offset += 20;
        return offset;
    }
}

class Unlike extends ContentData {
    /**
     *
     * @param {string} author
     * @param {string} contentAddress
     */
    constructor(author, contentAddress) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.UNLIKE);
        this.author = author;
        this.contentAddress = contentAddress;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version);
        bufferHex += ContentData.serializeNumber(this.type);
        bufferHex += creativecoin.address.fromBase58Check(this.author).hash.toString('hex');
        bufferHex += creativecoin.address.fromBase58Check(this.contentAddress).hash.toString('hex');
        return Buffer.from(bufferHex, 'hex');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        offset = super.deserialize(buffer, offset);
        this.author = buffer.slice(offset, offset + 20);
        this.author =  creativecoin.address.toBase58Check(this.author, NETWORK.pubKeyHash);
        offset += 20;

        this.contentAddress = buffer.slice(offset, offset + 20);
        this.contentAddress =  creativecoin.address.toBase58Check(this.contentAddress, NETWORK.pubKeyHash);
        offset += 20;
        return offset;
    }
}

class Payment extends ContentData {
    /**
     *
     * @param {string} author
     * @param {string} contentAddress
     * @param {number} amount
     */
    constructor(author, contentAddress, amount) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.PAYMENT);
        this.author = author;
        this.contentAddress = contentAddress;
        this.amount = amount;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version);
        bufferHex += ContentData.serializeNumber(this.type);
        bufferHex += creativecoin.address.fromBase58Check(this.author).hash.toString('hex');
        bufferHex += creativecoin.address.fromBase58Check(this.contentAddress).hash.toString('hex');
        bufferHex += ContentData.serializeNumber(this.amount, 8);
        return Buffer.from(bufferHex, 'hex');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        offset = super.deserialize(buffer, offset);
        this.author = buffer.slice(offset, offset + 20);
        this.author =  creativecoin.address.toBase58Check(this.author, NETWORK.pubKeyHash);
        offset += 20;

        this.contentAddress = buffer.slice(offset, offset + 20);
        this.contentAddress =  creativecoin.address.toBase58Check(this.contentAddress, NETWORK.pubKeyHash);
        offset += 20;

        this.amount = parseInt(buffer.slice(offset, offset + 8).toString('hex'), 16);
        offset += 8;
        return offset;
    }
}

class Comment extends ContentData {
    /**
     *
     * @param {string} author
     * @param {string} contentAddress
     * @param {string} comment
     */
    constructor(author, contentAddress, comment) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.COMMENT);
        this.author = author;
        this.contentAddress = contentAddress;
        this.comment = comment;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version);
        bufferHex += ContentData.serializeNumber(this.type);
        bufferHex += creativecoin.address.fromBase58Check(this.author).hash.toString('hex');
        bufferHex += creativecoin.address.fromBase58Check(this.contentAddress).hash.toString('hex');
        bufferHex += ContentData.serializeText(this.comment);
        return Buffer.from(bufferHex, 'hex');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        offset = super.deserialize(buffer, offset);
        this.author = buffer.slice(offset, offset + 20);
        this.author =  creativecoin.address.toBase58Check(this.author, NETWORK.pubKeyHash);
        offset += 20;

        this.contentAddress = buffer.slice(offset, offset + 20);
        this.contentAddress =  creativecoin.address.toBase58Check(this.contentAddress, NETWORK.pubKeyHash);
        offset += 20;

        let desComment = ContentData.deserializeText(buffer, offset);
        this.comment = desComment.text;
        offset += desComment.offset;
        return offset;
    }
}

class Donation extends ContentData {
    /**
     *
     * @param {string} author
     */
    constructor(author) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.DONATION);
        this.author = author;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version);
        bufferHex += ContentData.serializeNumber(this.type);
        bufferHex += creativecoin.address.fromBase58Check(this.author).hash.toString('hex');
        return Buffer.from(bufferHex, 'hex');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        offset = super.deserialize(buffer, offset);
        this.author = buffer.slice(offset, offset + 20);
        this.author =  creativecoin.address.toBase58Check(this.author, NETWORK.pubKeyHash);
        offset += 20;

        return offset;
    }
}

class AddressRelation extends ContentData {
    /**
     *
     * @param {number} type
     * @param {string} activeAddress
     * @param {string} pasiveAddress
     */
    constructor(type, activeAddress, pasiveAddress) {
        super(PUBLICATION.VERSION, type);
        this.followerAddress = activeAddress;
        this.followedAddress = pasiveAddress;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version);
        bufferHex += ContentData.serializeNumber(this.type);
        bufferHex += creativecoin.address.fromBase58Check(this.followerAddress).hash.toString('hex');
        bufferHex += creativecoin.address.fromBase58Check(this.followedAddress).hash.toString('hex');
        return Buffer.from(bufferHex, 'hex');
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @returns {number}
     */
    deserialize(buffer, offset) {
        offset = super.deserialize(buffer, offset);
        this.followerAddress = buffer.slice(offset, offset + 20);
        this.followerAddress =  creativecoin.address.toBase58Check(this.followerAddress, NETWORK.pubKeyHash);
        offset += 20;

        this.followedAddress = buffer.slice(offset, offset + 20);
        this.followedAddress =  creativecoin.address.toBase58Check(this.followedAddress, NETWORK.pubKeyHash);
        offset += 20;
        return offset;
    }
}
class Follow extends AddressRelation {
    /**
     *
     * @param {string} followerAddress
     * @param {string} followedAddress
     */
    constructor(followerAddress, followedAddress) {
        super(PUBLICATION.TYPE.FOLLOW, followerAddress, followedAddress);
    }
}

class Unfollow extends AddressRelation {
    /**
     *
     * @param {string} followerAddress
     * @param {string} followedAddress
     */
    constructor(followerAddress, followedAddress) {
        super(PUBLICATION.TYPE.UNFOLLOW, followerAddress, followedAddress);
    }
}

class BlockContent extends AddressRelation {
    /**
     *
     * @param {string} userAddress
     * @param {string} blockAddress
     */
    constructor(userAddress, blockAddress) {
        super(PUBLICATION.TYPE.BLOCK, userAddress, blockAddress);
    }
}

class Network {
    constructor(messagePrefix, bip32, pubKeyHash, scriptHash, wif) {
        this.messagePrefix = messagePrefix;
        this.bip32 = bip32;
        this.pubKeyHash = pubKeyHash;
        this.scriptHash = scriptHash;
        this.wif = wif;
    }
}
Network.MAINNET = new Network('\x18Creativecoin Signed Message:\n', {
    public: 0x0488b21e,
    private: 0x0488ade4
}, 0x1c, 0x05, 0xb0);

Network.TESTNET = new Network('\x18Creativecoin Signed Message:\n', {
    public: 0x043587cf,
    private: 0x04358394
}, 0x57, 0xc4, 0xef);

const NETWORK = Network.TESTNET;

class TxInput {
    constructor(hash, index, script, sequence, witness) {
        this.txHash = hash;
        this.txIndex = index;
        this.script = script;
        this.sequence = sequence;
        this.witness = witness;
    }
}

class TxOutput {
    constructor(script, value, vout) {
        this.script = script;
        this.value = value;
        this.vout = vout;
    }

    /**
     *
     * @return {boolean}
     */
    hasData() {
        let scriptBuffer = this.getBufferedScript();
        let asm = creativecoin.script.toASM(scriptBuffer);
        let dataHex = asm.replace('OP_RETURN ', '');
        return this.hasRawData() && dataHex.startsWith(ContentData.serializeNumber(PUBLICATION.MAGIC_BYTE))
    }

    /**
     *
     * @return {boolean}
     */
    hasRawData() {
        let scriptBuffer = this.getBufferedScript();
        let asm = creativecoin.script.toASM(scriptBuffer);
        return asm.startsWith('OP_RETURN');
    }

    /**
     *
     * @return {Buffer}
     */
    getRawData() {
        if (this.hasData()) {
            let scriptBuffer = this.getBufferedScript();
            let asm = creativecoin.script.toASM(scriptBuffer);
            let dataHex = asm.replace('OP_RETURN ', '');
            dataHex = Buffer.from(dataHex, 'hex');
            let compressed = dataHex[1];
            dataHex = dataHex.slice(2);
            if (compressed) {
                return Utils.decompress(dataHex);
            } else {
                return dataHex;
            }
        }

        return null;
    }

    /**
     *
     * @return {ContentData}
     */
    getData() {
        if (this.hasData()) {
            let rawData = this.getRawData();
            return ContentData.deserializeData(rawData);
        }

        return null;
    }

    /**
     *
     * @returns {string}
     */
    getDecodedScript() {
        return creativecoin.script.toASM(creativecoin.script.decompile(this.getBufferedScript()));
    }

    /**
     * @returns {Buffer}
     */
    getBufferedScript() {
        return Buffer.from(this.script, 'hex');
    }

    /**
     *
     * @returns {string}
     */
    getAddress() {
        if (creativecoin.script.pubKeyHash.output.check(this.getBufferedScript())) {
            return creativecoin.address.toBase58Check(creativecoin.script.compile(this.getBufferedScript()).slice(3, 23), NETWORK.pubKeyHash);
        } else  if (creativecoin.script.scriptHash.output.check(this.getBufferedScript())) {
            return creativecoin.address.toBase58Check(creativecoin.script.compile(this.getBufferedScript()).slice(2, 22), NETWORK.scriptHash);
        }

        return null;
    }
}

class TransactionBuilder {
    /**
     *
     * @param {Network} network
     * @param {number} version
     * @param {number} feePerKb
     * @param {number} extraSize
     */
    constructor(network = NETWORK, version = TX_CURRENT_VERSION, feePerKb = TX_FEE_KB, extraSize = 0) {
        this.network = network;
        this.feePerKb = feePerKb;
        this.inputs = [];
        this.outputs = [];
        this.extraSize = extraSize;
        this.changeAddress = null;
        this.complete = false;
        this.txFee = 0;
        this.txb = null;
    }

    /**
     *
     * @param {string} address
     * @return {boolean}
     */
    isAddressInOutputs(address) {
        for (let x = 0; x < this.outputs.length; x++) {
            let out = this.outputs[x];
            if (out.address === address) {
                return true;
            }
        }

        return false;
    }

    /**
     *
     * @param {string} address
     * @param {number} amount
     * @param {boolean} isChange
     */
    addOutput(address, amount, isChange = false) {

        if (this.isAddressInOutputs(address)) {
            this.outputs.forEach(function (out) {
                if (out.address === address) {
                    out.value += amount;
                }
            });
        } else {
            let txOut = {
                address: address,
                value: amount,
                isChange: isChange
            };

            this.outputs.push(txOut);
        }
    }

    /**
     *
     * @param {string} txId
     * @param {number} index
     * @param {string} address
     * @param {number} amount
     */
    addInput(txId, index, address, amount) {
        let input = {
            txId: txId,
            vout: index,
            address: address,
            value: amount
        };

        this.inputs.push(input);
    }

    /**
     *
     * @param {Array} spendables
     */
    completeTx(spendables) {
        let that = this;
        let changeAddress = this.changeAddress;
        let feeRate = this.feePerKb / 1000;
        let {inputs, outputs, fee} = coinselect(spendables, this.outputs, feeRate, this.extraSize);

        if (!inputs || !outputs) {
            this.complete = false;
        } else {
            console.log(inputs, outputs);
            let txb = new creativecoin.TransactionBuilder(NETWORK);
            inputs.forEach(function (input) {
              txb.addInput(input.txId, input.vout);
              that.inputs.push(input);
            });
            outputs.forEach(function (output) {
              if (!output.address) {
                  output.address = changeAddress;
                  output.isChange = true;
                  that.addOutput(output.address, output.value, true);
              }

              txb.addOutput(output.address, output.value);
            });
            this.txb = txb;
            this.txFee = fee;
            this.complete = true;
        }
    }

    getTotalOutput(withMine = false) {
        let total = 0;
        this.outputs.forEach(function (out) {
            if (out.isChange && withMine || !out.isChange) {
                total += out.value;
            }
        });

        return total;
    }
}

class DecodedTransaction {
    constructor(rawTx) {
        this.rawTx = rawTx.replace('\n', '');
        this.hash = '';
        this.inputs = [];
        this.outputs = [];
        this.version = 0;
        this.locktime = 0;
    }

    /**
     *
     * @param index
     * @returns {TxInput}
     */
    getInput(index) {
        return this.inputs[index];
    }

    /**
     *
     * @param index
     * @returns {TxOutput}
     */
    getOutput(index) {
        return this.outputs[index];
    }

    /**
     *
     * @return {boolean}
     */
    containsData() {
        for (let x = 0; x < this.outputs.length; x++) {
            let output = this.outputs[x];
            if (output.hasData()) {
                return true;
            }
        }

        return false;
    }

    /**
     *
     * @return {boolean}
     */
    containsRawData() {
        for (let x = 0; x < this.outputs.length; x++) {
            let output = this.outputs[x];
            if (output.hasRawData()) {
                return true;
            }
        }

        return false;
    }

    /**
     *
     * @return {Buffer}
     */
    getRawData() {
        for (let x = 0; x < this.outputs.length; x++) {
            let output = this.outputs[x];
            if (output.hasRawData()) {
                return output.getRawData();
            }
        }

        return null;
    }
    /**
     *
     * @return {ContentData}
     */
    getData() {
        for (let x = 0; x < this.outputs.length; x++) {
            let output = this.outputs[x];
            if (output.hasData()) {
                return output.getData();
            }
        }

        return null;
    }

    /**
     *
     * @param txHex
     * @returns {DecodedTransaction}
     */
    static fromHex(txHex) {
        let dtx = new DecodedTransaction(txHex);
        let tx = creativecoin.Transaction.fromHex(txHex);

        tx.ins.forEach(function (input) {
            let txInput = new TxInput(input.hash.toString('hex'), input.index, input.script.toString('hex'), input.sequence, input.witness);
            dtx.inputs.push(txInput);
        });

        tx.outs.forEach(function (output, index) {
            let txOutput = new TxOutput(output.script.toString('hex'), output.value, index);
            dtx.outputs.push(txOutput);
        });

        dtx.version = tx.version;
        dtx.locktime = tx.locktime;
        dtx.hash = tx.getId();
        return dtx;
    }
}

class Spendable {

    /**
     *
     * @param {string} txId
     * @param {number} vout
     * @param {string} address
     * @param {number} amount
     * @param {number} confirmations
     * @param {boolean} spendable
     * @param {string} scriptPubKey
     */
    constructor(txId, vout, address, amount, confirmations, spendable, scriptPubKey) {
        this.txId = txId;
        this.vout = vout;
        this.address = address;
        this.value = Coin.parseCash(amount, 'CREA').amount;
        this.confirmations = confirmations;
        this.spendable = spendable;
        this.scriptPubKey = scriptPubKey;
    }

    /**
     *
     * @param {Array} json
     * @returns {Array}
     */
    static parseJson(json) {
        let spendables = [];

        json.forEach(function (spend) {
            //Fix cant convert integer to coin, add a decimal unit to convert to float
            spend.amount = parseFloat(spend.amount) + 0.000000001;
            spendables.push(new Spendable(spend.txid, spend.vout, spend.address, spend.amount, spend.confirmations, spend.spendable, spend.scriptPubKey))
        });

        return spendables;
    }
}

class NodeConfiguration {
    constructor(configuration) {
        let lines = configuration.split('\n');

        for (let x = 0; x < lines.length; x++) {
            let l = lines[x];
            let vals = l.split('=');
            this[vals[0]] = vals[1];
        }
    }

    /**
     *
     * @param {string} key
     * @returns {boolean}
     */
    hasKey(key) {
        return !!this[key];
    }

    /**
     *
     * @param {string} key
     * @param {*} value
     */
    setIfNotExist(key, value) {
        if (!this.hasKey(key)) {
            this[key] = value;
        }
    }

    savedOn(file) {
        File.mkpath(file, true);
        let content = '';
        let keys = Object.keys(this);

        for (let x = 0; x < keys.length; x++) {
            let k = keys[x];
            let val = this[k];
            if (k.length > 0) {
                content += k + '=' + val + '\n';
            }
        }

        File.write(file, content);
        File.chmod(file, '0640'); //Set permissions rw- r-- ---
    }

    /**
     *
     * @param file
     * @returns {NodeConfiguration}
     */
    static loadFrom(file) {
        if (File.exist(file)) {
            let content = File.read(file);

            return new NodeConfiguration(content);
        }

        return new NodeConfiguration('');

    }
}

class Storage {
    constructor(db) {
        this.database = new sqlite.Database(db);
    }

    serialize(callback) {
        this.database.serialize(callback);
    }

    migrate(callback) {
        let that = this;
        this.query('PRAGMA user_version;', function (err, result) {
            if (err) {
                console.error(err);
            } else {
                let migrationsFolder = Constants.DBMIGRATIONS_FOLDER;
                let performMigration = function (version) {
                    let file = migrationsFolder + version + '.sql';
                    console.log('Performin migration', version);
                    if (File.exist(file)) {
                        let queries = File.read(file);
                        that.database.exec(queries, function (err) {
                            if (!err) {
                                performMigration(++version);
                            } else {
                                console.error(err);
                            }
                        })
                    } else if (callback) {
                        console.log('Database initialized');
                        callback()
                    }
                };

                let version = parseInt(result[0].user_version);
                if (version === 0) {
                    let sqlCreationQueries = File.read(Constants.DATABASE_CREATION_FILE);
                    that.database.exec(sqlCreationQueries, function (err) {
                        console.log('Database initialized', err);
                        performMigration(++version);
                    });
                } else {
                    performMigration(version);
                }

            }
        })
    }

    init(callback) {
        let that = this;
        this.serialize(function () {
            that.migrate(callback);
        });
    }

    close(callback) {
        this.database.close();
    }

    /**
     *
     * @param {string} query
     * @param callback
     */
    query(query, callback) {
        //console.log('Executing', query);
        this.database.all(query, callback);
    }

    /**
     *
     * @param {string} query
     * @param callback
     */
    run(query, callback) {
        //console.log('Executing', query);
        this.database.run(query, callback);
    }

    /**
     *
     * @param lastExploredBlock
     * @param callback
     */
    insertLastExploredBlock(lastExploredBlock, callback) {
        let insertPlatform = this.database.prepare('INSERT INTO Platform VALUES (?, ?)');
        insertPlatform.run('', lastExploredBlock, callback);
    }

    updateLastExploredBlock(lastExploredBlock, callback) {
        this.run('UPDATE Platform SET lastExploredBlock = ' + lastExploredBlock + ' WHERE lastExploredBlock >= 0', callback);
    }

    getLastExploredBlock(callback) {
        this.query('SELECT * FROM Platform LIMIT 1', callback);
    }

    /**
     *
     * @param {Author} user
     * @param {DecodedTransaction} tx
     * @param {number} date
     * @param callback
     */
    addAuthor(user, tx, date, callback) {
        let insertUser = this.database.prepare('REPLACE INTO Author VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        insertUser.run(tx.hash, user.version, date, user.nick, user.address, user.email, user.web, user.description, user.avatar, JSON.stringify(user.tags), callback);
        insertUser.finalize();
        this.insertUserTags(user.address, user.tags);
    }

    /**
     *
     *
     * @param {string} userAddress
     * @param {Array} tags
     */
    insertUserTags(userAddress, tags) {
        let insertTag = this.database.prepare('REPLACE INTO UserTags VALUES (?, ?)');
        if (tags) {
            tags.forEach(function (tag) {
                tag = tag.toLowerCase();
                insertTag.run(tag, userAddress);
            })
        }
        insertTag.finalize();
    }

    /**
     *
     * @param {string} address
     * @param callback
     */
    getAuthor(address, callback) {
        this.query("SELECT a.*, " +
            "(SELECT count(*) FROM 'Like' l, Media m WHERE l.content_id = m.address AND m.author = '" + address + "') AS likes, " +
            "(SELECT count(*) FROM 'Comment' c, Media m WHERE c.content_id = m.address AND m.author = '" + address + "') AS comments, " +
            "(SELECT count(*) FROM 'Media' m WHERE m.author = '" + address + "') AS publications, " +
            "(SELECT count(*) FROM 'Following' f WHERE f.type = 6 AND f.followed_address = '" + address +"') AS followers, " +
            "(SELECT t.file FROM 'Torrent' t WHERE a.avatar = t.magnet) AS avatarFile " +
            "From Author a WHERE a.address = '" + address + "'", callback);
    }


    /**
     *
     * @param torrent
     * @param {string} file
     * @param callback
     */
    insertTorrent(torrent, file, callback) {
        let insertTorrent = this.database.prepare('REPLACE INTO Torrent VALUES (?, ?, ?)');
        insertTorrent.run(torrent.infoHash, torrent.magnetURI, file, function (err) {
            if (callback) {
                callback(err);
            }
        });
        insertTorrent.finalize();
    }

    /**
     *
     * @param {string} author
     * @param {number} type
     * @param {string} resource
     * @param {number} date
     * @param callback
     */
    insertNotification(author, type, resource, date, callback) {
        let inserNotification = this.database.prepare('INSERT INTO Notification VALUES (?, ?, ?, ?, ?)');
        inserNotification.run(author, type, resource, date, 0, function (err) {
            if (callback) {
                callback(err);
            }
        });
        inserNotification.finalize();
    }

    /**
     *
     * @param callback
     * @param {number} limit
     */
    getNotifications(callback, limit = 50) {
        this.query('SELECT * FROM Notification ORDER BY on_date DESC LIMIT ' + limit + ';', callback);
    }

    /**
     *
     * @param callback
     * @param {number} limit
     */
    getUnviewedNotifications(callback, limit = 50) {
        this.query('SELECT * FROM Notification WHERE viewed = 0 ORDER BY on_date DESC LIMIT ' + limit + ';', callback);
    }

    setViewedNotifications(callback) {
        this.query('UPDATE Notification SET viewed = 1 WHERE viewed = 0;')
    }

    /**
     *
     * @param {string} torrent
     * @param callback
     */
    getTorrent(torrent, callback) {
        this.query('SELECT * FROM Torrent WHERE hash = ' + torrent, callback);
    }

    /**
     *
     * @param {Comment} comment
     * @param {DecodedTransaction} tx
     * @param {number} date
     * @param callback
     */
    addComment(comment, tx, date, callback) {
        let insertComment = this.database.prepare('REPLACE INTO Comment VALUES (?, ?, ?, ?, ?, ?)');
        insertComment.run(tx.hash, comment.version, comment.author, comment.contentAddress, comment.comment, date, function (err) {
            if (callback) {
                callback(err);
            }
        });
        insertComment.finalize();
    }

    /**
     *
     * @param {string} contentAddress
     * @param callback
     */
    getComments(contentAddress, callback) {
        this.query("SELECT c.*,  u.* FROM Comment c LEFT JOIN (SELECT a.address AS user_address, a.name, a.email, a.web, " +
            "a.description AS user_description, a.avatar, a.tags AS user_tags, (SELECT t.file FROM Torrent t WHERE " +
            "t.magnet = a.avatar) AS avatarFile, (SELECT count(*) FROM Comment c WHERE c.author = a.address) AS " +
            "user_comments, (SELECT count(*) FROM 'Like' l WHERE l.author = a.address) AS user_likes, (SELECT count(*) " +
            "FROM 'Media' m WHERE m.author = a.address) AS publications FROM Author a) u " +
            "ON (u.user_address = c.author) WHERE c.content_id = '" + contentAddress + "' ORDER BY c.creation_date DESC;", callback);
    }

    /**
     *
     * @param {string} userAddress
     * @param callback
     */
    getUserComments(userAddress, callback) {
        this.query('SELECT * FROM Comment WHERE author = ' + userAddress, callback);
    }

    /**
     *
     * @param {AddressRelation} following
     * @param {DecodedTransaction} tx
     * @param {number} date
     * @param callback
     */
    addFollowing(following, tx, date, callback) {
        let insertFollowing = this.database.prepare('REPLACE INTO Following VALUES (?, ?, ?, ?, ?, ?)');
        insertFollowing.run(tx.hash, following.version, date, following.followerAddress, following.followedAddress, following.type, function (err) {
            if (callback) {
                callback(err);
            }
        });
        insertFollowing.finalize();
    }

    /**
     *
     * @param {Unfollow} following
     * @param callback
     */
    removeFollowing(following, callback) {
        this.run("DELETE FROM Following WHERE Following.follower_address = '" + following.followerAddress + "' AND " +
            "Following.followed_address = '" + following.followedAddress + "' AND Following.type = 6;", callback);
    }

    /**
     *
     * @param {string} profileAddress
     * @param userAddress
     * @param callback
     */
    getFollowers(profileAddress, userAddress, callback) {
        this.query("SELECT f.follower_address, " +
            "u.* FROM 'Following' f " +
            "LEFT JOIN (SELECT a.*, " +
            "(SELECT count(*) FROM 'Following' f2 WHERE a.address = f2.followed_address AND f2.follower_address = '" + userAddress + "' AND f2.type = " + PUBLICATION.TYPE.FOLLOW + ") AS is_following," +
            "(SELECT t.file FROM 'Torrent' t WHERE t.magnet = a.avatar) AS avatarFile FROM 'Author' a) u ON " +
            "(u.address = f.follower_address) WHERE f.followed_address = '" + profileAddress + "' AND f.type = " + PUBLICATION.TYPE.FOLLOW, callback);
    }

    /**
     *
     * @param {string} profileAddress
     * @param userAddress
     * @param callback
     */
    getFollowing(profileAddress, userAddress, callback) {
        this.query("SELECT f.followed_address, " +
            "u.* FROM 'Following' f " +
            "LEFT JOIN (SELECT a.*, " +
            "(SELECT count(*) FROM 'Following' f2 WHERE a.address = f2.followed_address AND f2.follower_address = '" + userAddress + "' AND f2.type = " + PUBLICATION.TYPE.FOLLOW + ") AS is_following," +
            "(SELECT t.file FROM 'Torrent' t WHERE t.magnet = a.avatar) AS avatarFile FROM 'Author' a) u ON " +
            "(u.address = f.followed_address) WHERE f.follower_address = '" + profileAddress + "' AND f.type = " + PUBLICATION.TYPE.FOLLOW, callback);
    }

    /**
     *
     * @param {string} userAddress
     * @param {string} followedAddress
     * @param callback
     */
    getFollower(userAddress, followedAddress, callback) {
        this.query("SELECT f.follower_address, u.* FROM 'Following' f LEFT JOIN (SELECT a.*, (SELECT t.file FROM 'Torrent'" +
            " t WHERE t.magnet = a.avatar) AS avatarFile FROM 'Author' a) u ON (u.address = f.follower_address) WHERE f.follower_address = '" + userAddress + "' AND f.followed_address = '" + followedAddress + "' AND f.type = " + PUBLICATION.TYPE.FOLLOW, callback);
    }

    /**
     *
     * @param {string} followerAddress
     * @param {string} followedAddress
     * @param {number} type
     * @param callback
     */
    getFollowingData(followerAddress, followedAddress, type, callback) {
        this.query("SELECT f.*, " +
            "u.* FROM 'Following' f " +
            "LEFT JOIN (SELECT a.*, " +
            "(SELECT count(*) FROM 'Following' f2 WHERE a.address = f2.followed_address AND f2.follower_address = '" + followerAddress + "' AND f2.type = " + PUBLICATION.TYPE.FOLLOW + ") AS is_following," +
            "(SELECT t.file FROM 'Torrent' t WHERE t.magnet = a.avatar) AS avatarFile FROM 'Author' a) u ON " +
            "(u.address = f.followed_address) WHERE f.follower_address = '" + followerAddress + "' AND f.followed_address = '" + followedAddress + "' AND f.type = " + type + ";", callback);
    }

    /**
     *
     * @param {string} author
     * @param {string} resource
     * @param callback
     */
    getBloked(author, resource, callback) {
        this.getFollowingData(author, resource, PUBLICATION.TYPE.BLOCK, callback);
    }

    /**
     *
     * @param {Like} like
     * @param {DecodedTransaction} tx
     * @param callback
     */
    addLike(like, tx, callback) {
        let insertLike = this.database.prepare('REPLACE INTO Like VALUES (?, ?, ?, ?)');
        insertLike.run(tx.hash, like.version, like.author, like.contentAddress, function (err) {
            if (callback) {
                callback(err);
            }
        });
        insertLike.finalize();
    }

    /**
     *
     * @param {Unlike} unlike
     * @param {DecodedTransaction} tx
     * @param callback
     */
    addUnlike(unlike, tx, callback) {
        let insertUnlike = this.database.prepare('REPLACE INTO Unlike VALUES (?, ?, ?, ?)');
        insertUnlike.run(tx.hash, unlike.version, unlike.author, unlike.contentAddress, function (err) {
            if (callback) {
                callback(err);
            }
        });
        insertUnlike.finalize();
    }

    /**
     *
     * @param {Payment} payment
     * @param {DecodedTransaction} tx
     * @param callback
     */
    addPayment(payment, tx, callback) {
        let insertPayment = this.database.prepare('REPLACE INTO Payment VALUES (?, ?, ?, ?, ?)');
        insertPayment.run(tx.hash, payment.version, payment.author, payment.contentAddress, payment.amount, function (err) {
            if (callback) {
                callback(err);
            }
        });
        insertPayment.finalize();
    }

    /**
     *
     * @param {string} contentId
     * @param callback
     */
    getContentLikes(contentId, callback) {
        this.query('SELECT * FROM Like WHERE content_id = ' + contentId, callback);
    }

    /**
     *
     * @param {MediaData} media
     * @param {DecodedTransaction} tx
     * @param {number} date
     * @param callback
     */
    addMedia(media, tx, date, callback) {
        let insertMedia = this.database.prepare('REPLACE INTO Media VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        insertMedia.run(tx.hash, media.version, date, media.userAddress, media.contentAddress, media.type, media.title,
            media.description, media.contentType, media.license, JSON.stringify(media.tags), media.price, media.publicContent,
            media.privateContent, media.hash, media.publicFileSize, media.privateFileSize,  function (err) {
            if (callback) {
                callback(err);
            }
        });
        insertMedia.finalize();
        this.insertMediaTags(media.contentAddress, media.tags);
    }

    /**
     *
     * @param {string} mediaAddress
     */
    removeMedia(mediaAddress) {
        this.query("DELETE FROM Media WHERE address = '" + mediaAddress + "'");
    }

    /**
     *
     * @param {string} authorAddress
     */
    removeMediaByAuthor(authorAddress) {
        this.query("DELETE FROM Media WHERE author = '" + authorAddress + "'");
    }

    /**
     *
     *
     * @param {string} mediaAddress
     * @param {Array} tags
     */
    insertMediaTags(mediaAddress, tags) {
        let insertTag = this.database.prepare('REPLACE INTO MediaTags VALUES (?, ?)');
        if (tags) {
            tags.forEach(function (tag) {
                tag = tag.toLowerCase();
                insertTag.run(tag, mediaAddress);
            })
        }
        insertTag.finalize();
    }

    /**
     *
     * @param {string} userAddress
     * @param {number} page
     * @param callback
     */
    getAllMedia(userAddress, page, callback) {
        if (!page) {
            page = 1;
        }

        let offset = (page * 20) - 20;

        this.query("SELECT m.*, " +
            "(SELECT count(*) FROM 'Like' l WHERE m.address = l.content_id) AS likes, " +
            "(SELECT count(*) FROM 'Unlike' ul WHERE m.address = ul.content_id) AS unlikes, " +
            "(SELECT count(*) FROM Comment c WHERE m.address = c.content_id) AS comments, " +
            "(SELECT t.file FROM Torrent t WHERE t.magnet = m.public_content) AS featured_image, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = m.private_content) AS private_file, " +
            "(SELECT SUM(p.amount) FROM Payment p WHERE p.content_id = m.address GROUP BY p.content_id) AS received_amount, " +
            "u.* FROM Media m " +
            "LEFT JOIN (SELECT a.address AS user_address, a.name, a.email, a.web, a.description AS user_description, a.avatar, a.tags AS user_tags, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = a.avatar) AS avatarFile, " +
            "(SELECT count(*) FROM Comment c WHERE c.author = a.address) AS user_comments, " +
            "(SELECT count(*) FROM Following f WHERE f.follower_address = a.address AND f.type = 6) AS user_following, " +
            "(SELECT count(*) FROM Following f2 WHERE f2.followed_address = a.address AND f2.type = 6) AS user_followers, " +
            "(SELECT count(*) FROM Following f3 WHERE f3.followed_address = a.address AND f3.follower_address = '" + userAddress + "' AND f3.type = 6) AS following, " +
            "(SELECT count(*) FROM 'Like' l, Media m WHERE l.content_id = m.address AND m.author = a.address) AS user_likes, " +
            "(SELECT count(*) FROM 'Unlike' ul, Media m WHERE ul.content_id = m.address AND m.author = a.address) AS user_unlikes, " +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON " +
            "(u.user_address = m.author) ORDER BY m.creation_date DESC LIMIT 20 OFFSET " + offset + ";", callback)
    }

    /**
     *
     * @param {string} contentId
     * @param {string} userAddress
     * @param callback
     */
    getMediaByContentId(contentId, userAddress, callback) {
        this.query("SELECT m.*, " +
            "(SELECT count(*) FROM 'Like' l WHERE m.address = l.content_id) AS likes, " +
            "(SELECT count(*) FROM 'Unlike' ul WHERE m.address = ul.content_id) AS unlikes, " +
            "(SELECT count(*) FROM Comment c WHERE m.address = c.content_id) AS comments, " +
            "(SELECT t.file FROM Torrent t WHERE t.magnet = m.public_content) AS featured_image, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = m.private_content) AS private_file, " +
            "(SELECT SUM(p.amount) FROM Payment p WHERE p.content_id = m.address GROUP BY p.content_id) AS received_amount, " +
            "u.* FROM Media m " +
            "LEFT JOIN (SELECT a.address AS user_address, a.name, a.email, a.web, a.description AS user_description, a.avatar, a.tags AS user_tags, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = a.avatar) AS avatarFile, " +
            "(SELECT count(*) FROM Comment c WHERE c.author = a.address) AS user_comments, " +
            "(SELECT count(*) FROM Following f WHERE f.follower_address = a.address AND f.type = 6) AS user_following, " +
            "(SELECT count(*) FROM Following f2 WHERE f2.followed_address = a.address AND f2.type = 6) AS user_followers, " +
            "(SELECT count(*) FROM Following f3 WHERE f3.followed_address = a.address AND f3.follower_address = '" + userAddress + "' AND f3.type = 6) AS following, " +
            "(SELECT count(*) FROM 'Like' l, Media m WHERE l.content_id = m.address AND m.author = a.address) AS user_likes, " +
            "(SELECT count(*) FROM 'Unlike' ul, Media m WHERE ul.content_id = m.address AND m.author = a.address) AS user_unlikes, " +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON " +
            "(u.user_address = m.author) WHERE m.txid = '" + contentId + "' ORDER BY m.creation_date DESC;", callback)
    }

    /**
     *
     * @param {string} address
     * @param callback
     * @param {string} userAddress
     */
    getMediaByAddress(address, userAddress, callback) {
        this.query("SELECT m.*, " +
            "(SELECT count(*) FROM 'Like' l WHERE m.address = l.content_id) AS likes, " +
            "(SELECT count(*) FROM 'Unlike' ul WHERE m.address = ul.content_id) AS unlikes, " +
            "(SELECT count(*) FROM Comment c WHERE m.address = c.content_id) AS comments, " +
            "(SELECT t.file FROM Torrent t WHERE t.magnet = m.public_content) AS featured_image, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = m.private_content) AS private_file, " +
            "(SELECT SUM(p.amount) FROM Payment p WHERE p.content_id = m.address GROUP BY p.content_id) AS received_amount, " +
            "u.* FROM Media m LEFT JOIN " +
            "(SELECT a.address AS user_address, a.name, a.email, a.web, a.description AS user_description, a.avatar, a.tags AS user_tags, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = a.avatar) AS avatarFile, " +
            "(SELECT count(*) FROM Comment c WHERE c.author = a.address) AS user_comments, " +
            "(SELECT count(*) FROM Following f WHERE f.follower_address = a.address AND f.type = 6) AS user_following, " +
            "(SELECT count(*) FROM Following f2 WHERE f2.followed_address = a.address AND f2.type = 6) AS user_followers, " +
            "(SELECT count(*) FROM Following f3 WHERE f3.followed_address = a.address AND f3.follower_address = '" + userAddress + "' AND f3.type = 6) AS following, " +
            "(SELECT count(*) FROM 'Like' l, Media m WHERE l.content_id = m.address AND m.author = a.address) AS user_likes, " +
            "(SELECT count(*) FROM 'Unlike' ul, Media m WHERE ul.content_id = m.address AND m.author = a.address) AS user_unlikes, " +
            "(SELECT count(*) FROM 'Like' ld WHERE ld.author = '" + userAddress + "' AND ld.content_id = '" + address + "') AS user_liked, " +
            "(SELECT count(*) FROM 'Unlike' uld WHERE uld.author = '" + userAddress + "' AND uld.content_id = '" + address + "') AS user_unliked, " +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON " +
            "(u.user_address = m.author) WHERE m.address = '" + address + "' ORDER BY m.creation_date DESC;", callback)
    }

    /**
     *
     * @param {string} authorAddress
     * @param {string} userAddress
     * @param callback
     */
    getMediaByAuthor(authorAddress, userAddress, callback) {
        this.query("SELECT m.*, " +
            "(SELECT count(*) FROM 'Like' l WHERE m.address = l.content_id) AS likes, " +
            "(SELECT count(*) FROM 'Unlike' ul WHERE m.address = ul.content_id) AS unlikes, " +
            "(SELECT count(*) FROM Comment c WHERE m.address = c.content_id) AS comments, " +
            "(SELECT t.file FROM Torrent t WHERE t.magnet = m.public_content) AS featured_image, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = m.private_content) AS private_file, " +
            "(SELECT SUM(p.amount) FROM Payment p WHERE p.content_id = m.address GROUP BY p.content_id) AS received_amount, " +
            "u.* FROM Media m " +
            "LEFT JOIN (SELECT a.address AS user_address, a.name, a.email, a.web, a.description AS user_description, a.avatar, a.tags AS user_tags, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = a.avatar) AS avatarFile, " +
            "(SELECT count(*) FROM Comment c WHERE c.author = a.address) AS user_comments, " +
            "(SELECT count(*) FROM Following f WHERE f.follower_address = a.address AND f.type = 6) AS user_following, " +
            "(SELECT count(*) FROM Following f2 WHERE f2.followed_address = a.address AND f2.type = 6) AS user_followers, " +
            "(SELECT count(*) FROM Following f3 WHERE f3.followed_address = a.address AND f3.follower_address = '" + userAddress + "' AND f3.type = 6) AS following, " +
            "(SELECT count(*) FROM 'Like' l, Media m WHERE l.content_id = m.address AND m.author = a.address) AS user_likes, " +
            "(SELECT count(*) FROM 'Unlike' ul, Media m WHERE ul.content_id = m.address AND m.author = a.address) AS user_unlikes, " +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON " +
            "(u.user_address = m.author) WHERE m.author = '" + authorAddress + "' ORDER BY m.creation_date DESC;", callback)
    }

    getMediaByFollowerAddress(followerAddress, userAddress, page, callback) {
        if (!page) {
            page = 1;
        }

        let offset = (page * 20) - 20;

        this.query("SELECT f.follower_address, n.* FROM Following f " +
            "LEFT JOIN (SELECT m.*,  " +
            "(SELECT count(*) FROM 'Like' l WHERE m.address = l.content_id) AS likes, " +
            "(SELECT count(*) FROM 'Unlike' ul WHERE m.address = ul.content_id) AS unlikes, " +
            "(SELECT count(*) FROM Comment c WHERE m.address = c.content_id) AS comments, " +
            "(SELECT t.file FROM Torrent t WHERE t.magnet = m.public_content) AS featured_image, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = m.private_content) AS private_file, " +
            "(SELECT SUM(p.amount) FROM Payment p WHERE p.content_id = m.address GROUP BY p.content_id) AS received_amount, " +
            "u.* FROM Media m " +
            "LEFT JOIN (SELECT a.address AS user_address, a.name, a.email, a.web, a.description AS user_description, a.avatar, a.tags AS user_tags, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = a.avatar) AS avatarFile, " +
            "(SELECT count(*) FROM Comment c WHERE c.author = a.address) AS user_comments, " +
            "(SELECT count(*) FROM Following f WHERE f.follower_address = a.address AND f.type = 6) AS user_following, " +
            "(SELECT count(*) FROM Following f2 WHERE f2.followed_address = a.address AND f2.type = 6) AS user_followers, " +
            "(SELECT count(*) FROM Following f3 WHERE f3.followed_address = a.address AND f3.follower_address = '" + userAddress + "' AND f3.type = 6) AS following, " +
            "(SELECT count(*) FROM 'Like' l, Media m WHERE l.content_id = m.address AND m.author = a.address) AS user_likes, " +
            "(SELECT count(*) FROM 'Unlike' ul, Media m WHERE ul.content_id = m.address AND m.author = a.address) AS user_unlikes, " +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON (u.user_address = m.author) " +
            ") n  " +
            "ON (n.author = f.followed_address) WHERE f.follower_address = '" + followerAddress + "' ORDER BY n.creation_date DESC LIMIT 20 OFFSET " + offset + ";", callback)

    }

    getMediaByFollowedAddress(followedAddress, callback) {
        this.query("SELECT f.followed_address, n.* FROM Following f " +
            "LEFT JOIN (SELECT m.*,  " +
            "(SELECT count(*) FROM 'Like' l WHERE m.address = l.content_id) AS likes, " +
            "(SELECT count(*) FROM 'Unlike' ul WHERE m.address = ul.content_id) AS unlikes, " +
            "(SELECT count(*) FROM Comment c WHERE m.address = c.content_id) AS comments, " +
            "(SELECT t.file FROM Torrent t WHERE t.magnet = m.public_content) AS featured_image, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = m.private_content) AS private_file, " +
            "(SELECT SUM(p.amount) FROM Payment p WHERE p.content_id = m.address GROUP BY p.content_id) AS received_amount, " +
            "u.* FROM Media m " +
            "LEFT JOIN (SELECT a.address AS user_address, a.name, a.email, a.web, a.description AS user_description, a.avatar, a.tags AS user_tags, " +
            "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = a.avatar) AS avatarFile, " +
            "(SELECT count(*) FROM Comment c WHERE c.author = a.address) AS user_comments, " +
            "(SELECT count(*) FROM Following f WHERE f.follower_address = a.address AND f.type = 6) AS user_following, " +
            "(SELECT count(*) FROM Following f2 WHERE f2.followed_address = a.address AND f2.type = 6) AS user_followers, " +
            "(SELECT count(*) FROM 'Like' l, Media m WHERE l.content_id = m.address AND m.author = a.address) AS user_likes, " +
            "(SELECT count(*) FROM 'Unlike' ul, Media m WHERE ul.content_id = m.address AND m.author = a.address) AS user_unlikes, " +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON (u.user_address = m.author) " +
            ") n  " +
            "ON (n.author = f.follower_address) WHERE f.followed_address = '" + followedAddress + "' ORDER BY n.creation_date DESC;", callback)
    }

    /**
     *
     * @param {string} authorAddress
     * @param callback
     */
    getMediaAddressByAuthor(authorAddress, callback) {
        this.query("SELECT m.address FROM Media m WHERE m.author = '" + authorAddress + "' ORDER BY m.creation_date ASC", callback);
    }

    /**
     *
     * @param {string} address
     * @param callback
     */
    resolveAddress(address, callback) {
        this.database.all('SELECT * FROM AddressBook WHERE AddressBook.address = "' + address + '";', callback);
    }

    /**
     *
     * @param {string} label
     * @param callback
     */
    resolveLabel(label, callback) {
        this.database.all('SELECT * FROM AddressBook WHERE AddressBook.label = "' + label + '";', callback);
    }

    /**
     *
     * @param {string} label
     * @param {string} address
     * @param callback
     */
    resolveAddressAndLabel(address, label, callback) {
        this.query('SELECT * FROM AddressBook WHERE AddressBook.address = "' + address + '" OR AddressBook.label = "' + label + '";', callback);
    }

    /**
     *
     * @param {string} address
     * @param {string} label
     * @param callback
     */
    insertAddressBook(address, label, callback) {
        let insertContact = this.database.prepare('REPLACE INTO AddressBook VALUES (?, ?)');
        insertContact.run(address, label, callback);
        insertContact.finalize();
    }

    /**
     *
     * @param {string} address
     * @param {string} label
     * @param callback
     */
    updateAddressBook(address, label, callback) {
        let that = this;
        let onCreate = function () {
            that.insertAddressBook(address, label);
        };

        this.resolveAddressAndLabel(address, label, function (err, res) {
            if (res.length > 1) {
                callback(ErrorCodes.CONTACT_EXISTS);
            } else if (res.length === 1) {
                res = res[0];
                if (res.label === label) {
                    that.query('UPDATE AddressBook SET address = "' + address + '" WHERE label = "' + label + '"', callback)
                } else {
                    that.query('UPDATE AddressBook SET label = "' + label + '" WHERE address = "' + address + '"', callback)
                }
            } else {
                onCreate();
            }
        })
    }

    /**
     *
     * @param callback
     */
    getAddressBook(callback) {
        this.query('SELECT * FROM AddressBook;', callback)
    }

    /**
     *
     * @param {string} address
     * @param {number} amount
     * @param {number} creationDate
     * @param {string} label
     * @param {string} message
     * @param callback
     */
    insertPaymentRequest(address, amount, creationDate, label, message, callback) {
        let insertPaymentReq = this.database.prepare('REPLACE INTO PaymentRequest VALUES (?, ?, ?, ?, ?)');
        insertPaymentReq.run(address, amount, creationDate, label, message, callback);
        insertPaymentReq.finalize();
    }

    /**
     *
     * @param {string} address
     * @param callback
     */
    getPaymentRequest(address, callback) {
        this.query('SELECT * FROM PaymentRequest WHERE address = "' + address + '"', callback);
    }
    /**
     *
     * @param callback
     */
    getAllPaymentRequest(callback) {
        this.query('SELECT * FROM PaymentRequest', callback);
    }

    /**
     *
     * @param {string} hash
     * @param {string} magnetURI
     * @param {string} path
     * @param {string} file
     * @param callback
     */
    putTorrent(hash, magnetURI, path, file, callback) {
        //console.log('Inserting torrent on db', hash, magnetURI, path, file);
        let insertTorrent = this.database.prepare('REPLACE INTO Torrent VALUES (?, ?, ?, ?)');
        insertTorrent.run(hash, magnetURI, path, file, function (err) {
            if (err) {
                console.error(err);
            }
            if (callback) {
                callback();
            }
        });
        insertTorrent.finalize();

    }

    getAllTorrents(callback) {
        this.query('SELECT * FROM Torrent', callback)
    }

    /**
     *
     * @param {Array} tags
     * @param callback
     */
    getContentTags(tags, callback) {
        let matches = {};

        tags.forEach(function (tag, index) {
            this.query("SELECT * FROM ContentTags AS t WHERE t.tag LIKE '%" + tag + "%'", function (result) {
                if (result) {
                    result.forEach(function (res) {
                        let dataId = res.data_id;
                        if (matches[dataId]) {
                            matches[dataId] = matches[dataId]++;
                        } else {
                            matches[dataId] = 1;
                        }
                    });
                }

                if (index === tags.length && callback) {
                    callback(matches);
                }
            });
        });
    }

    /**
     *
     * @param {Array} tags
     * @param {string} userAddress
     * @param callback
     */
    getMediaByTags(tags, userAddress, callback) {
        let query = "SELECT m.*, " +
        "(SELECT count(*) FROM 'Like' l WHERE m.address = l.content_id) AS likes, " +
        "(SELECT count(*) FROM 'Unlike' ul WHERE m.address = ul.content_id) AS unlikes, " +
        "(SELECT count(*) FROM Comment c WHERE m.address = c.content_id) AS comments, " +
        "(SELECT t.file FROM Torrent t WHERE t.magnet = m.public_content) AS featured_image, " +
        "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = m.private_content) AS private_file, " +
        "(SELECT SUM(p.amount) FROM Payment p WHERE p.content_id = m.address GROUP BY p.content_id) AS received_amount, " +
        "u.* FROM Media m " +
        "LEFT JOIN (SELECT a.address AS user_address, a.name, a.email, a.web, a.description AS user_description, a.avatar, a.tags AS user_tags, " +
        "(SELECT t2.file FROM Torrent t2 WHERE t2.magnet = a.avatar) AS avatarFile, " +
        "(SELECT count(*) FROM Comment c WHERE c.author = a.address) AS user_comments, " +
        "(SELECT count(*) FROM Following f WHERE f.follower_address = a.address AND f.type = 6) AS user_following, " +
        "(SELECT count(*) FROM Following f2 WHERE f2.followed_address = a.address AND f2.type = 6) AS user_followers, " +
        "(SELECT count(*) FROM Following f3 WHERE f3.followed_address = a.address AND f3.follower_address = '" + userAddress + "' AND f3.type = 6) AS following, " +
        "(SELECT count(*) FROM 'Like' l WHERE l.author = a.address) AS user_likes, " +
        "(SELECT count(*) FROM 'Unlike' ul WHERE ul.author = a.address) AS user_unlikes, " +
        "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON " +
        "(u.user_address = m.author) WHERE ";

        tags.forEach(function (tag, index) {
            query += "m.tags LIKE '%" + tag + "%'";
            if (index < (tags.length -1)) {
                query += " OR ";
            }
        });

        query += " ORDER BY m.creation_date DESC;";
        this.query(query, callback);
    }

    getPayment(userAddress, contentAddress, callback) {
        this.query("SELECT * FROM Payment WHERE content_id = '" + contentAddress + "' AND author = '" + userAddress + "';", callback);
    }

    getDonationFromMedia(mediaAddress, callback) {
        this.query('SELECT * FROM Donation WHERE content_id = "' + mediaAddress + '" ORDER BY creation_date DESC', callback)
    }

}

class EventHandler {
    constructor() {

    }

    /**
     *
     * @param {string} event
     * @param {string} id
     * @param callback
     */
    subscribe(event, id, callback) {
        if (!this[event]) {
            this[event] = {};
        }

        event = this[event];

        event[id] = callback;
    }

    /**
     *
     * @param {string} event
     * @param {string} id
     */
    unsubscribe(event, id) {
        if (this[event] && this[event][id]) {
            delete this[event][id];
        }
    }

    /**
     *
     * @param {string} event
     * @param {number} timeout
     * @param args
     */
    notify(event, timeout, ...args) {
        let that = this;
        let onBind = function(func, args) {
            func(args);
        };

        if (this[event]) {
            event = this[event];
            for (let k in event) {
                if (timeout > 0) {
                    setTimeout(function () {
                        onBind(event[k], args);
                    }, timeout)
                } else {
                    onBind(event[k], args);
                }
            }

        }
    }
}

class Trantor {
    constructor(network = NETWORK) {
        this.network = network;
        this.client = null;
        this.torrentClient = 0;
        this.database = null;
        this.events = new EventHandler();
        this.trantorStorage = FileStorage.load(Constants.TRANTOR_FILE);
        this.isExploring = false;
    }

    checkBinariesExists(callback) {
        let that = this;
        let binPlatform = OS.getFilenameVersion();
        let binaryName = Constants.BINARY_NAME;

        let onFinish = function () {
            that.log('checkBinaryExists - onFinish');
            File.chmod(Constants.BIN_FOLDER + binaryName, "0744"); //Set permissions rwx r-- ---
            that.events.notify('onDaemonDownload', 10, 100);
            callback(true);
        };

        let checksumFile = Constants.BIN_FOLDER + 'sha256sums.txt';
        let binaryFile = Constants.BIN_FOLDER + binaryName;
        let checksum;
        File.download(Constants.CHECKSUMS_URL, checksumFile, null, function (error, file) {
            let content = null;
            if (error) {
                checksum = true;
                that.events.notify('onInternetError', 10);
            } else {
                content = File.read(checksumFile);
                let lines = content.split('\n');
                for (let x in lines) {
                    let l = lines[x];
                    if (l.includes(binaryName)) {
                        checksum = l.split('  ')[0];
                        break;
                    }
                }
            }


            let downloadDaemon = function () {
                File.download(Constants.DAEMON_URL + binPlatform, binaryFile, function (progress) {
                    that.log('Downloading daemon', progress + '%');
                    that.events.notify('onDaemonDownload', 10, progress);
                }, function () {
                    setTimeout(function () {
                        onFinish();
                    }, 500);
                })
            };

            if (checksum) {
                that.log('Checksum found!');

                if (File.exist(binaryFile)) {
                    let binary = File.read(binaryFile, 'hex');
                    binary = Buffer.from(binary, 'hex');
                    let checksumBin = Utils.makeHash(binary);
                    that.log('Comparing checksums', checksumBin, checksum);
                    if (checksum) {
                        that.log('Checksums match');
                        onFinish();
                    } else {
                        that.error('Checksums not match');

                        downloadDaemon()
                    }
                } else {
                    downloadDaemon();
                }
            } else {
                that.error('Checksum not found!!', content);
                if (!File.exist(binaryFile)) {
                    downloadDaemon();
                }
            }

        });
    }

    prepareConfiguration() {
        let config = NodeConfiguration.loadFrom(Constants.BIN_FOLDER + '/creativecoin.conf');

        config.setIfNotExist('rpcuser', 'creativecoin');
        config.setIfNotExist('rpcpassword', Utils.randomString(9));
        config.setIfNotExist('rpcworkqueue', 2000);
        config.setIfNotExist('port', Utils.randomNumber(20000, 65535));
        config.rpcport = 1188;
        config.txindex = 1;
        config.addnode = '144.217.106.112';
        config.daemon = OS.isWindows() ? 0 : 1;
        config.testnet = this.network === Network.TESTNET ? 1 : 0;
        config.savedOn(Constants.BIN_FOLDER + "/creativecoin.conf");

    }

    prepareClients() {
        let conf = NodeConfiguration.loadFrom(Constants.BIN_FOLDER + '/creativecoin.conf');
        let conn = {
            username: conf.rpcuser,
            password: conf.rpcpassword,
            host: '127.0.0.1',
            port: conf.rpcport,
            network: Constants.DEBUG ? 'testnet' : 'mainnet'
        };

        this.client = new RpcClient(conn);
    }

    initClients(callback) {
        let that = this;
        let inits = 2;

        let callCallback = function () {
            that.log('Inits to perform:' + inits);
            inits--;
            if (inits === 0) {
                if (callback) {
                    callback();
                }
            }
        };

        let folder = Constants.BIN_FOLDER.replace(/(\r\n|\n|\r)/gm,"");
        let daemon = folder + Constants.BINARY_NAME.replace(/(\r\n|\n|\r)/gm,"");
        OS.run(daemon + ' -datadir=' + folder, function (result, stderr) {
            callCallback();
            that.log('Starting daemon', daemon, result, stderr);
        });

        let databaseExist = File.exist(Constants.DATABASE_FILE);
        File.mkpath(Constants.DATABASE_FILE, true);
        this.database = new Storage(Constants.DATABASE_FILE);
        this.database.init(function () {
/*            if (databaseExist) {
                callCallback();
            } else {

            }*/
            that.database.insertLastExploredBlock(0, function (err, result) {
                if (err) {
                    console.error(err);
                } else {
                    callCallback();
                }
            });

        });
    }

    explore() {
        this.isExploring = true;
        let that = this;
        this.database.getLastExploredBlock(function (err, result) {
            let startBlock = 0;
            if (err) {
                console.log(err);
            } else if (result.length > 0) {
                result = result[0];
                startBlock = result.lastExploredBlock;
            }

            startBlock = startBlock < Constants.START_BLOCK ? Constants.START_BLOCK : startBlock;
            that.log('Start exploration at block', startBlock);

            let onExplore = function () {
                that.client.getBlockCount(function (err, result) {
                    //that.log('Blockcount', result);
                    if (!err) {
                        that.events.notify('onExploreStart', 10, startBlock);
                        let blockCount = parseInt(result);

                        let broadcastProgress = function (currentHeight) {
                            //that.log('broadcasting progress', currentHeight);
                            that.events.notify('onExploreProgress', 10, blockCount, currentHeight);
                        };

                        let processBlock = function (blockHeight) {
                            that.client.getBlockHash(blockHeight, function (err, blockHash) {
                                if (!err) {
                                    //that.log('BlockHash', blockHash);

                                    that.client.getBlock(blockHash, function (err, block) {
                                        //that.log(block);
                                        if (err) {
                                            console.error(err)
                                        } else {
                                            let blockTime = block.time * 1000;
                                            let txIds = block.tx;

                                            let count = 0;
                                            let readingIndex = false;
                                            let onReadTx = function () {
                                                //that.log('onReadTx', count, readingIndex, txIds.length);
                                                if (count === txIds.length && !readingIndex) {
                                                    broadcastProgress(blockHeight);
                                                    that.database.updateLastExploredBlock(blockHeight, function (err, result) {
                                                        //console.log(err, result);
                                                    });
                                                    //that.trantorStorage.setKey('lastExploredBlock', blockHeight);
                                                    setTimeout(function () {
                                                        processBlock(++blockHeight);
                                                    }, 10);

                                                }
                                            };

                                            //that.log(txIds);
                                            txIds.forEach(function (txHash) {
                                                //that.log(txHash);

                                                let processTx = function (err, rawTx) {
                                                    //that.log(err, rawTx);

                                                    if (err) {
                                                        that.error('Error getting tx', txHash, err);
                                                        //that.getRawTransaction(txHash, processTx);
                                                        count++;
                                                        onReadTx();
                                                    } else {

                                                        let tx = DecodedTransaction.fromHex(rawTx);
                                                        if (tx.containsData()) {

                                                            let broadcastData = function (data) {
                                                                //that.log('broadcasting data', data);
                                                                that.events.notify('onDataFound', 0, tx, data, blockTime);
                                                            };

                                                            try {
                                                                let data = tx.getData();
                                                                if (data.type === PUBLICATION.TYPE.INDEX) {
                                                                    //If the data is an index, the data of the transactions of the index must be recovered.
                                                                    readingIndex = true;
                                                                    let index = data;
                                                                    let hexData = '';
                                                                    let indexTtxIds = index.txIds;
                                                                    let indexCount = 0;

                                                                    let onRaw = function () {
                                                                        if (indexCount === indexTtxIds.length) {
                                                                            let newData = ContentData.deserializeData(Buffer.from(hexData, 'hex'));
                                                                            broadcastData(newData);
                                                                            if (readingIndex) {
                                                                                readingIndex = false;
                                                                                onReadTx();
                                                                            }
                                                                        }
                                                                    };
                                                                    indexTtxIds.forEach(function (txIdHash) {
                                                                        that.getRawTransaction(txIdHash, function (err, result) {
                                                                            //that.log('Raw tx', result);
                                                                            let decodedTx = DecodedTransaction.fromHex(result);
                                                                            hexData += decodedTx.getRawData().toString('hex');
                                                                            indexCount++;
                                                                            onRaw();
                                                                        })
                                                                    })
                                                                } else {
                                                                    broadcastData(data);
                                                                }
                                                            } catch (e) {
                                                                console.error(e);
                                                            }

                                                        }

                                                        count++;
                                                        onReadTx();
                                                    }
                                                };

                                                that.getRawTransaction(txHash, processTx);

                                            })
                                        }

                                    })
                                } else if (blockHeight >= blockCount) {
                                    //Exploration finish
                                    that.isExploring = false;
                                    that.database.updateLastExploredBlock(blockHeight, function (err, result) {
                                        //console.log(err, result);
                                    });
                                    //that.trantorStorage.setKey('lastExploredBlock', blockHeight);
                                    that.events.notify('onExploreFinish', 10, blockCount, blockHeight);
                                } else {
                                    //BlockHash not found or core refused call, try again
                                    that.error(err);
                                    setTimeout(function () {
                                        processBlock(blockHeight);
                                    }, 1000)
                                }

                            })
                        };
                        processBlock(startBlock);
                    } else {
                        setTimeout(function () {
                            onExplore();
                        }, 60 * 1000);
                    }
                });
            };
            setTimeout(function () {
                onExplore();
            }, 100)
        });

    }

    start(callback) {
        let that = this;
        this.checkBinariesExists(function (exists) {
            if (exists) {
                that.prepareConfiguration();
                that.prepareClients();
                that.initClients(function () {
                    that.events.notify('onStart', 100);
                    if (callback) {
                        callback();
                    }
                });
            } else {
                that.events.notify('onError', 10, ErrorCodes.BINARY_NOT_FOUND);
            }
        })
    }

    stop() {
        //this.log('Closing platform');
        console.log('closing platform');
        this.events.notify('onStop', 10);
        this.client.stop(function (err, result) {
            console.log(err, result);
        })
        this.database.close();

    }

    restart(callback) {
        let that = this;
        this.stop();

        setTimeout(function () {
            that.start(callback)
        }, 7 * 1000);
    }

    /**
     *
     * @param {string} password
     * @param callback
     */
    encryptWallet(password, callback) {
        this.client.encryptWallet(password, callback);
    }

    getSpendables(conf = 0, callback) {
        let that = this;
        this.client.listUnspent(conf, function (err, result) {
            //that.log('unspents', result);
            let spendables = Spendable.parseJson(result);
            callback(err, spendables);
        })
    }

    /**
     *
     * @param {ContentData} data
     * @param callback
     */
    buildDataOutput(data, callback) {
        let that = this;
        data.setCompression();
        let dataBuff = data.serialize();

        let buildOutData = function (dataHex, error) {
            let outData = ContentData.serializeNumber(PUBLICATION.MAGIC_BYTE) + ContentData.serializeNumber(data.mustBeCompressed) + dataHex.toString('hex');

            outData = Buffer.from(outData, 'hex');
            if (!error) {
                that.log('Final data:', outData.length, outData.toString('hex'));
                let ret = creativecoin.script.compile([
                    creativecoin.opcodes.OP_RETURN,
                    outData
                ]);
                callback(ret);
            } else {
                that.error(error);
            }
        };

        if (data.mustBeCompressed) {
            Utils.compress(dataBuff, COMPRESSION_LEVEL, function (dataCompressed, error) {
                buildOutData(dataCompressed, error);
            });
        } else {
            buildOutData(dataBuff, false);
        }

    }

    /**
     *
     * @param {string} address
     * @param callback
     */
    dumpPrivKey(address, callback) {
        let that = this;
        this.client.dumpPrivKey(address, function (err, result) {
            //that.log('privKey', result);
            callback(err, result);
        })
    }

    /**
     *
     * @param {string} txId
     * @param callback
     */
    getRawTransaction(txId, callback) {
        this.client.getRawTransaction(txId, callback);
    }

    /**
     *
     * @param callback
     */
    getChangeAddress(callback) {
        this.client.getRawChangeAddress(callback);
    }

    /**
     *
     * @param {string} rawTx
     * @param callback
     */
    sendRawTransaction(rawTx, callback) {
        let that = this;
        this.client.sendRawTransaction(rawTx, function (err, result) {
            //that.log('send tx', result);
            that.events.notify('onAfterTransactionSend', 10, DecodedTransaction.fromHex(rawTx));
            if (callback) {
                callback(err, result);
            }
        })
    }

    /**
     *
     * @param {string} passphrase
     * @param {number} timeout
     * @param callback
     */
    decryptWallet(passphrase, timeout, callback) {
        this.client.walletPassPhrase(passphrase, timeout, callback);
    }

    /**
     *
     * @param txBuilder
     * @param {Array} spendables
     * @param callback
     */
    signTransaction(txBuilder, spendables, callback) {
        let that = this;
        let privKeys = [];

        let signTx = function () {
            that.log(privKeys);

            for (let x = 0; x < privKeys.length; x++) {
                let pk = privKeys[x];
                privKeys[x] = creativecoin.ECPair.fromWIF(pk, NETWORK);
                txBuilder.sign(x, privKeys[x]);
            }

            let txHex = txBuilder.build().toHex();
            that.log(txHex);
            if (callback) {
                callback(null, txHex);
            }
        };

        spendables.forEach(function (spend) {
            that.dumpPrivKey(spend.address, function (err, result) {
                if (err) {
                    if (callback) {
                        callback(err)
                    }
                } else {
                    privKeys.push(result);
                    if (privKeys.length === spendables.length) {
                        signTx();
                    }
                }

            });
        });
    }

    /**
     *
     * @param {ContentData} data
     * @param {string} destinyAddress
     * @param {number} amount
     * @param callback
     */
    createDataTransaction(data, destinyAddress, amount, callback) {
        this.log(data);
        amount = amount ? amount : TX_CONTENT_AMOUNT;
        let that = this;
        let onBuild = function (txBuilder, creaBuilder) {
            if (callback) {
                callback(creaBuilder, txBuilder.inputs, txBuilder);
            }
        };

        this.getSpendables(0, function (err, spendables) {
            if (err) {
                console.error(err);
            } else if (spendables.length > 0) {
                that.buildDataOutput(data, function (opReturnData) {
                    let dataSize = opReturnData.length;

                    let txBuilder = new TransactionBuilder();

                    that.client.getRawChangeAddress(function (err, result) {
                        if (err) {
                            that.error(err);
                        } else {
                            txBuilder.extraSize = dataSize;
                            txBuilder.changeAddress = result;
                            txBuilder.feePerKb = TX_FEE_KB;
                            txBuilder.addOutput(destinyAddress, amount);

                            txBuilder.completeTx(spendables);

                            if (txBuilder.complete) {
                                let creaBuilder = txBuilder.txb;
                                creaBuilder.addOutput(opReturnData, 0);

                                let fee = txBuilder.txFee;
                                that.log('Fee: ', Coin.parseCash(txBuilder.txFee, 'CREA').toString() + '/B');
                                creaBuilder.txFee = fee;
                                onBuild(txBuilder, creaBuilder);
                            } else {
                                that.error('Tx is incomplete', txBuilder, spendables);
                                if (callback) {
                                    callback(ErrorCodes.INSUFFICIENT_AMOUNT);
                                }
                            }
                        }
                    });

                });
            } else {
                that.error('Not found spendables for this data', err, spendables);
                if (callback) {
                    callback(ErrorCodes.NOT_SPENDABLES)
                }
            }

        })
    }

    /**
     *
     * @param {string} userAddress
     * @param {string} nick
     * @param {string} email
     * @param {string} web
     * @param {string} description
     * @param {string} avatar
     * @param {Array} tags
     */
    register(userAddress, nick, email, web, description, avatar, tags) {
        let that = this;

        setTimeout(function () {
            that.log('Author Torrent created!', avatar);
            let magnetUri = avatar ? avatar.magnetURI : '';
            let userReg = new Author(userAddress, nick, email, web, description, magnetUri, tags);
            let buffUser = userReg.serialize();
            that.createDataTransaction(userReg, userAddress, null, function (txBuilder, spendables) {

                if (txBuilder === ErrorCodes.NOT_SPENDABLES) {
                    that.error(txBuilder);
                } else {
                    that.signTransaction(txBuilder, spendables, function (err, rawTx) {
                        if (err) {
                            that.error(err);
                        } else {
                            let txBuffer = Buffer.from(rawTx, 'hex');
                            let tx = creativecoin.Transaction.fromBuffer(txBuffer);
                            that.events.notify('onBeforeRegister', 10, txBuffer, userReg, avatar);
                        }

                    });
                }

            });
        }, 10)
    }

    insertMedia(media, tx, date, callback) {
        this.database.addMedia(media, tx, date, function (err) {
            if (callback) {
                callback(err);
            }
        })
    }

    /**
     *
     * @param {Comment} comment
     * @param {DecodedTransaction} tx
     * @param {number} date
     * @param callback
     */
    insertComment(comment, tx, date, callback) {
        this.database.addComment(comment, tx, date, callback);
    }

    /**
     *
     * @param {string} userAddress
     * @param {string} publishAddress
     * @param {string} title
     * @param {string} description
     * @param {string} contentType
     * @param {number} license
     * @param {Array} tags
     * @param {*} publicTorrent
     * @param {*} privateTorrent
     * @param {number} price
     * @param {string} hash
     * @param {number} publicFileSize
     * @param {number} privateFileSize
     */
    publish(userAddress, publishAddress, title, description, contentType, license, tags, publicTorrent, privateTorrent, price, hash, publicFileSize, privateFileSize) {
        let that = this;

        setTimeout(function () {

            let pubUri = publicTorrent ? publicTorrent.magnetURI : '';
            let prvUri = privateTorrent ? privateTorrent.magnetURI : '';
            let mediaPost = new MediaData(title, description, contentType, license, userAddress,
                publishAddress, tags, price, pubUri, prvUri, hash, publicFileSize, privateFileSize);

            let postBuffer = mediaPost.serialize();

            let deSeedTorrent = function (torrent) {
                if (torrent) {
                    that.events.notify('onDeSeedFile', 10, torrent);
                }
            };

            that.createDataTransaction(mediaPost, publishAddress, null, function (txBuilder, spendables) {
                if (txBuilder === ErrorCodes.NOT_SPENDABLES) {
                    that.error(txBuilder);
                } else {
                    that.signTransaction(txBuilder, spendables, function (err, rawTx) {
                        if (err) {
                            that.error(err);
                            deSeedTorrent(publicTorrent);
                            deSeedTorrent(privateTorrent);
                        } else {
                            let txBuffer = Buffer.from(rawTx, 'hex');
                            let tx = creativecoin.Transaction.fromBuffer(txBuffer);
                            that.events.notify('onBeforePublish', 10, txBuffer, mediaPost);
                        }

                    });
                }

            });
        }, 10)
    }

    /**
     *
     * @param {string} address
     * @param callback
     */
    getUserData(address, callback) {
        this.database.getAuthor(address, callback)
    }

    /**
     *
     * @param {Array} tags
     * @param {string} userAddress
     * @param callback
     */
    searchByTags(tags, userAddress, callback) {
        this.database.getMediaByTags(tags, userAddress, callback);
    }

    /**
     *
     * @param {string} userAddress
     * @param {string} contentAddress
     * @param {string} comment
     */
    makeComment(userAddress, contentAddress, comment) {
        let that = this;
        let commentData = new Comment(userAddress, contentAddress, comment);
        let commentBuffer = commentData.serialize();
        this.createDataTransaction(commentData, userAddress, null, function (txBuilder, spendables) {
            if (txBuilder === ErrorCodes.NOT_SPENDABLES) {
                that.error(txBuilder);
            } else {
                that.signTransaction(txBuilder, spendables, function (err, rawTx) {
                    if (err) {
                        that.error(err);
                    } else {
                        let txBuffer = Buffer.from(rawTx, 'hex');
                        that.events.notify('onBeforeComment', 10, txBuffer, commentData);
                    }
                });
            }
        })
    }

    /**
     *
     * @param {string} userAddress
     * @param {string} contentAddress
     * @param {number} likeAmount
     */
    makeLike(userAddress, contentAddress, likeAmount) {
        let that = this;
        let likeData = new Like(userAddress, contentAddress);
        let likeBuffer = likeData.serialize();
        this.createDataTransaction(likeData, contentAddress, likeAmount, function (txBuilder, spendables) {
            if (txBuilder === ErrorCodes.NOT_SPENDABLES) {
                that.error(txBuilder);
            } else {
                that.signTransaction(txBuilder, spendables, function (err, rawTx) {
                    if (err) {
                        that.error(err);
                    } else {
                        let txBuffer = Buffer.from(rawTx, 'hex');
                        that.events.notify('onBeforeLike', 10, txBuffer, likeData);
                    }
                });
            }
        })
    }

    makeContentPayment(userAddress, contentAddress) {
        let that = this;

        setTimeout(function () {
            that.database.getMediaByAddress(contentAddress, userAddress, function (err, result) {
                if (err) {
                    that.error(err);
                } else {
                    result = result[0];
                    let paymentData = new Payment(userAddress, contentAddress, result.price);
                    that.createDataTransaction(paymentData, contentAddress, result.price, function (creaBuilder, spendables, txBuilder) {
                        if (txBuilder === ErrorCodes.NOT_SPENDABLES) {
                            that.error(txBuilder);
                        } else {
                            that.signTransaction(creaBuilder, spendables, function (err, rawTx) {
                                if (err) {
                                    that.error(err);
                                } else {
                                    let txBuffer = Buffer.from(rawTx, 'hex');
                                    that.events.notify('onBeforePayment', 10, creaBuilder, txBuffer, paymentData, txBuilder);
                                }
                            });
                        }
                    })

                }
            })
        }, 10)
    }

    makeFollow(userAddress, followedAddress) {
        let that = this;
        let followData = new Follow(userAddress, followedAddress);
        this.createDataTransaction(followData, userAddress, null, function (creaBuilder, spendables, txBuilder) {
            if (txBuilder === ErrorCodes.NOT_SPENDABLES) {
                that.error(txBuilder);
            } else {
                that.signTransaction(creaBuilder, spendables, function (err, rawTx) {
                    if (err) {
                        that.error(err);
                    } else {
                        let txBuffer = Buffer.from(rawTx, 'hex');
                        that.events.notify('onFollow', 10, creaBuilder, txBuffer, followData, txBuilder);
                    }
                })
            }
        })
    }

    makeUnfollow(userAddress, followedAddress) {
        let that = this;
        let followData = new Unfollow(userAddress, followedAddress);
        this.createDataTransaction(followData, userAddress, null, function (creaBuilder, spendables, txBuilder) {
            if (txBuilder === ErrorCodes.NOT_SPENDABLES) {
                that.error(txBuilder);
            } else {
                that.signTransaction(creaBuilder, spendables, function (err, rawTx) {
                    if (err) {
                        that.error(err);
                    } else {
                        let txBuffer = Buffer.from(rawTx, 'hex');
                        that.events.notify('onUnfollow', 10, creaBuilder, txBuffer, followData, txBuilder);
                    }
                })
            }
        })
    }

    makeBlock(userAddress, followedAddress) {
        let that = this;
        let followData = new BlockContent(userAddress, followedAddress);
        this.createDataTransaction(followData, userAddress, null, function (creaBuilder, spendables, txBuilder) {
            if (txBuilder === ErrorCodes.NOT_SPENDABLES) {
                that.error(txBuilder);
            } else {
                that.signTransaction(creaBuilder, spendables, function (err, rawTx) {
                    if (err) {
                        that.error(err);
                    } else {
                        let txBuffer = Buffer.from(rawTx, 'hex');
                        that.events.notify('onBeforeBlockContent', 10, creaBuilder, txBuffer, followData, txBuilder);
                    }
                })
            }
        })
    }

    log(...args) {
        this.events.notify('onLog', 10, args);
    }

    error(...args) {
        this.events.notify('onError', 10, args);
    }
}

class Notifications {

    /**
     *
     * @param {string} title
     * @param {string} body
     * @param {string} icon
     * @param duration
     */
    static notify(title, body, icon, duration = 0) {
        let not = new Notification(title, {body: body, icon: icon});

        //not.show();
        if (duration > 0) {
            setTimeout(function () {
                not.close();
            }, duration * 1000);
        }
    }
}

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

if (module) {
    module.exports = {CoinUri, Currency, UnknownCurrency, FiatCurrency, CryptoCurrency, Eur, Usd, Mxn, Pln, Btc, Crea, Coin,
        MonetaryFormat, CryptoCoin, EurCoin, BitCoin, CreativeCoin, DollarCoin, PesoCoin, ZlotiCoin, Prices, ErrorCodes,
        OS, File, Constants, FileStorage, Utils, PUBLICATION, ContentData, Author, MediaData, Like, Comment, Donation, Following: AddressRelation,
        Follow, Unfollow, BlockContent, TxInput, TxOutput, DecodedTransaction, Network, NodeConfiguration, EventHandler, Trantor, Notifications,
        TorrentMsgCode, TransactionBuilder}
}