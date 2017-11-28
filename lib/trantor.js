
const fs = require('fs');
const os = require('os');
const exec = require('child_process').exec;
const request = require('request');
const lzma = require('lzma');
const varint = require('varint');
const sha256 = require('sha256');
const creativecoin = require('bitcoinjs-lib');
const RpcClient = require('bitcoind-rpc');
const sqlite = require('sqlite3');
const isDev = require('electron-is-dev');
const WebTorrent = require('webtorrent');
//let rem = require('electron').remote;

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
            uri += 'label=' + this.label;
            addedFirst = true;
        }

        if (hasMessage) {
            uri += addedFirst ? '&' : '';
            uri += 'message=' + this.message;
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
PUBLICATION.LIMIT = {};
PUBLICATION.LIMIT.POST_DESCRIPTION  = {
    TEXT: 233,
    BINARY: 466
};
PUBLICATION.LIMIT.POST_TITLE  = {
    TEXT: 55,
    BINARY: 110
};

PUBLICATION.LIMIT.COMMENT  = {
    TEXT: 233,
    BINARY: 466
};

PUBLICATION.LIMIT.NICK = {
    TEXT: 21,
    BINARY: 42
};

PUBLICATION.LIMIT.WEB = {
    TEXT: 55,
    BINARY: 110
};

PUBLICATION.LIMIT.USER_DESCRIPTION = {
    TEXT: 144,
    BINARY: 288
};

PUBLICATION.LIMIT.MAIL = {
    TEXT: 55,
    BINARY: 110,
};

PUBLICATION.LIMIT.USER_TAG = {
    TEXT: 13,
    BINARY: 26
};

PUBLICATION.LIMIT.TAG = {
    TEXT: 21,
    BINARY: 42
};

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


class OS {

    static isLinux() {
        return os.platform().toLowerCase().includes('linux');
    };

    static isWindows() {
        return !OS.isMac() && os.platform().toLowerCase().includes('win');
    };

    static isMac() {
        return os.platform().toLowerCase().includes('darwin');
    }

    static is64Bits() {
        return os.arch().toLowerCase().includes('64');
    }

    /**
     *
     * @returns {string}
     */
    static getPathSeparator() {
        if (OS.isLinux() || OS.isMac()) {
            return '/';
        } else if (OS.isWindows()) {
            return '\\';
        }
    }

    /**
     *
     * @returns {string}
     */
    static getHome() {
        if (OS.isLinux() || OS.isMac()) {
            return process.env.HOME;
        }

        return process.env.HOMEPATH;
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
                    callback(result);
                }
            }
        })
    };
}

class  Constants {}

Constants.DEBUG = true; //isDev
Constants.START_BLOCK = Constants.DEBUG ? 74182 : 82200;
Constants.FILE_SEPARATOR = OS.getPathSeparator();
Constants.APP_FOLDER = OS.getHome() + Constants.FILE_SEPARATOR + '.creative-universe';
Constants.ASAR_FOLDER = global.appPath ? global.appPath : '.';
Constants.EXTRA_FOLDER = Constants.ASAR_FOLDER + Constants.FILE_SEPARATOR + 'extra' + Constants.FILE_SEPARATOR;
Constants.CREDENTIALS_FILE = Constants.EXTRA_FOLDER + 'credentials' + (Constants.DEBUG ? '' : '-prod') + '.json';
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
Constants.TICKER_URL = 'https://api.coinmarketcap.com/v1/ticker/creativecoin/?convert=EUR';


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
                callback(targetPath);
            }
        })

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

        bufferHex += ContentData.serializeText(this.nick, PUBLICATION.LIMIT.NICK);
        bufferHex += ContentData.serializeText(this.email, PUBLICATION.LIMIT.MAIL);
        bufferHex += ContentData.serializeText(this.web, PUBLICATION.LIMIT.WEB);
        bufferHex += ContentData.serializeText(this.description, PUBLICATION.LIMIT.USER_DESCRIPTION);
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
     */
    constructor(title, description, contentType, license, userAddress, contentAddress, tags, price, publicContent, privateContent) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.CONTENT);
        this.userAddress = userAddress;
        this.contentAddress = contentAddress;
        this.license = license;
        this.title = title;
        this.description = description;
        this.contentType = contentType;
        this.tags = tags ? tags : [];
        this.price = price;
        this.publicContent = publicContent;
        this.privateContent = privateContent;
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
        bufferHex += ContentData.serializeText(this.title, PUBLICATION.LIMIT.POST_TITLE);
        bufferHex += ContentData.serializeText(this.description, PUBLICATION.LIMIT.POST_DESCRIPTION);
        bufferHex += ContentData.serializeText(this.contentType);
        let tags = JSON.stringify(this.tags);
        bufferHex += ContentData.serializeText(tags);
        bufferHex += ContentData.serializeNumber(this.price, 8);
        bufferHex += ContentData.serializeText(this.publicContent);
        bufferHex += ContentData.serializeText(this.privateContent);
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
        bufferHex += ContentData.serializeText(this.comment, PUBLICATION.LIMIT.COMMENT);
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

class Following extends ContentData {
    /**
     *
     * @param {number} type
     * @param {string} followerAddress
     * @param {string} followedAddress
     */
    constructor(type, followerAddress, followedAddress) {
        super(PUBLICATION.VERSION, type);
        this.followerAddress = followerAddress;
        this.followedAddress = followedAddress;
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
class Follow extends Following {
    /**
     *
     * @param {string} followerAddress
     * @param {string} followedAddress
     */
    constructor(followerAddress, followedAddress) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.FOLLOW, followerAddress, followedAddress);
    }
}

class Unfollow extends Following {
    /**
     *
     * @param {string} followerAddress
     * @param {string} followedAddress
     */
    constructor(followerAddress, followedAddress) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.UNFOLLOW, followerAddress, followedAddress);
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

const NETWORK = Constants.DEBUG ? Network.TESTNET : Network.MAINNET;

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
    constructor(script, value, index) {
        this.script = script;
        this.value = value;
        this.index = index;
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
        this.version = version;
        this.locktime = parseInt(new Date().getTime() / 1000);
        this.feePerKb = feePerKb;
        this.inputs = [];
        this.outputs = [];
        this.extraSize = extraSize;
        this.outputSumAmount = 0;
        this.changeAddress = null;
        this.complete = false;
        this.txFee = 0;
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
     */
    addOutput(address, amount) {

        if (this.isAddressInOutputs(address)) {
            this.outputs.forEach(function (out) {
                if (out.address === address) {
                    out.amount += amount;
                }
            });
        } else {
            let txOut = {
                address: address,
                amount: amount
            };

            this.outputs.push(txOut);
            this.outputSumAmount += txOut.amount;
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
            index: index,
            address: address,
            amount: amount
        };

        this.inputs.push(input);
        this.inputSumAmount += amount;
    }

    /**
     *
     * @param {Array} spendables
     */
    completeTx(spendables) {
        let matchAmount = this.outputSumAmount + Coin.parseCash((181 + 10 + this.extraSize + (this.outputs.length * 34)) * this.feePerKb / 1000, 'CREA').amount;
        //Check if a UTXO match with target amount
        spendables.sort(function (a, b) {
            return a.amount < b.amount ? -1 : 1;
        });

        for (let x = 0; x < spendables.length; x++) {
            if (this.complete) {
                break;
            }
            let spendable = spendables[x];
            if (spendable.matchAmount(matchAmount)) {
                this.addInput(spendable.txId, spendable.index, spendable.address, spendable.amount);
                this.complete = true;
            }
        }

        if (this.complete) {
            return;
        }

        //Check if sum of all UTXOs less than target amount is equal to target amount
        this.inputs = [];
        this.inputSumAmount = 0;
        let utxoSumAmount = 0;
        for (let x = 0; x < spendables.length; x++) {
            let spendable = spendables[x];
            let amountNet = this.outputSumAmount + this.getFee(1);
            let amountChange = this.outputSumAmount + this.getFee(1, 1);
            if (spendable.amount < amountNet) {
                utxoSumAmount += spendable.amount;
                this.addInput(spendable.txId, spendable.index, spendable.address, spendable.amount);
                if (utxoSumAmount === amountNet) {
                    this.complete = true;
                } else if (utxoSumAmount > amountChange) {
                    this.addOutput(this.changeAddress, this.inputSumAmount - amountChange);
                    this.complete = true;
                }
            }
        }

        if (this.complete) {
            return;
        }

        //Not Spendable UTXOs, searching first utxo greater than amount
        this.inputs = [];
        this.inputSumAmount = 0;
        let amountNet = this.outputSumAmount + this.getFee(1);
        let amountChange = this.outputSumAmount + this.getFee(1, 1);
        for (let x = 0; x < spendables.length; x++) {
            if (this.complete) {
                break;
            }
            let spendable = spendables[x];
            if (spendable.amount === amountNet) {
                this.addInput(spendable.txId, spendable.index, spendable.address, spendable.amount);
                this.complete = true;
            } else if (spendable.amount > amountChange) {
                this.addInput(spendable.txId, spendable.index, spendable.address, spendable.amount);
                this.addOutput(this.changeAddress, this.inputSumAmount - amountChange);
                this.complete = true;
            }
        }

        this.txFee = this.getFee();
    }

    /**
     *
     * @param {number} extraInputs
     * @param {number} extraOutputs
     * @returns {Number}
     */
    getFee(extraInputs = 0, extraOutputs = 0) {
        return parseInt(this.size(extraInputs, extraOutputs) * this.feePerKb / 1000);
    }

    /**
     *
     * @return {number}
     */
    size(extraInputs = 0, extraOutputs = 0) {
        return ((this.inputs.length + extraInputs) * 181) + 10 + this.extraSize + ((this.outputs.length + extraOutputs) * 34);
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
     * @param {number} index
     * @param {string} address
     * @param {number} amount
     * @param {number} confirmations
     * @param {boolean} spendable
     * @param {string} scriptPubKey
     */
    constructor(txId, index, address, amount, confirmations, spendable, scriptPubKey) {
        this.txId = txId;
        this.index = index;
        this.address = address;
        this.amount = Coin.parseCash(amount, 'CREA').amount;
        this.confirmations = confirmations;
        this.spendable = spendable;
        this.scriptPubKey = scriptPubKey;
    }

    /**
     *
     * @param {number} amount
     * @returns {boolean}
     */
    matchAmount(amount) {
        return amount === this.amount;
    }

    /**
     *
     * @param {number} amount
     * @param {Array} spendables
     * @param {number} extraSize
     * @returns {Array}
     */
    static spendablesFrom(amount, spendables, extraSize = 0) {
        let matches = [];

        let matchAmount = amount + Coin.parseCash((181 + 10 + extraSize) * TX_FEE_KB / 1000, 'CREA').amount;
        //Check if a UTXO match with target amount
        for (let x = 0; x < spendables.length; x++) {
            let spendable = spendables[x];
            if (spendable.matchAmount(matchAmount)) {
                matches.push(spendable);
                return matches;
            }
        }

        //Check if sum of all UTXOs less than target amount is equal to target amount
        let utxoLessThanAmount = [];
        let utxoSumAmount = 0;
        for (let x = 0; x < spendables.length; x++) {
            let spendable = spendables[x];
            if (spendable.amount < amount) {
                utxoLessThanAmount.push(spendable);
                utxoSumAmount += spendable.amount;
                matchAmount = amount + Coin.parseCash(( (utxoLessThanAmount.length * 181) + 10 + extraSize) * TX_FEE_KB / 1000, 'CREA').amount;
                if (utxoSumAmount >= matchAmount) {
                    return utxoLessThanAmount;
                }
            }
        }

        //Not Spendable UTXOs, searching first utxo greater than amount
        let utxoGreaterThanAmount = [];
        matchAmount = amount + Coin.parseCash((181 + 10 + extraSize) * TX_FEE_KB / 1000, 'CREA').amount;
        for (let x = 0; x < spendables.length; x++) {
            let spendable = spendables[x];
            if (spendable.amount > matchAmount) {
                utxoGreaterThanAmount.push(spendable);
                return utxoGreaterThanAmount;
            }
        }

        //Any utxo was found, return empty array
        return matches;
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

    init() {
        let sqlCreationQueries = File.read(Constants.DATABASE_CREATION_FILE);
        this.database.exec(sqlCreationQueries, function (err) {
            //console.log('Database initialized', err);
        });
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
        console.log('Executing', query);
        this.database.run(query, callback);
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
    }

    /**
     *
     * @param {string} address
     * @param callback
     */
    getAuthorUpdate(address, callback) {
        this.query('SELECT * FROM Author WHERE address = ' + address, callback)
    }

    /**
     *
     * @param {string} address
     * @param callback
     */
    getAuthor(address, callback) {
        this.query("SELECT a.*, (SELECT count(*) FROM 'Like' l WHERE l.author = '" + address + "') AS likes, (SELECT count(*)" +
            " FROM 'Comment' c WHERE c.author = '" + address + "') AS comments, (SELECT count(*) FROM 'Media' m WHERE " +
            "m.author = '" + address + "') AS publications, (SELECT count(*) FROM 'Following' f WHERE f.type = 5 AND f.followed_address = '" + address +
            "') AS followers, (SELECT t.file FROM 'Torrent' t WHERE a.avatar = t.magnet) AS avatarFile From Author a WHERE a.address = '" + address + "'", callback);
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
        let insertCallback = this.database.prepare('REPLACE INTO Comment VALUES (?, ?, ?, ?, ?, ?)');
        insertCallback.run(tx.hash, comment.version, comment.author, comment.contentAddress, comment.comment, date, function (err) {
            if (callback) {
                callback(err);
            }
        });
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
     * @param {Following} following
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
    }

    /**
     *
     * @param {string} userAddress
     * @param callback
     */
    getUserFollowers(userAddress, callback) {
        this.query("SELECT f.follower_address, u.* FROM 'Following' f LEFT JOIN (SELECT a.*, (SELECT t.file FROM 'Torrent'" +
            " t WHERE t.magnet = a.avatar) AS avatarFile FROM 'Author' a) u ON (u.address = f.follower_address) WHERE f.followed_address = '" + userAddress + "' AND f.type = " + PUBLICATION.TYPE.FOLLOW, callback);
    }

    /**
     *
     * @param {string} userAddress
     * @param callback
     */
    getUserFollowing(userAddress, callback) {
        this.query("SELECT f.followed_address, u.* FROM 'Following' f LEFT JOIN (SELECT a.*, (SELECT t.file FROM 'Torrent'" +
            " t WHERE t.magnet = a.avatar) AS avatarFile FROM 'Author' a) u ON (u.address = f.followed_address) WHERE f.follower_address = '" + userAddress + "' AND f.type = " + PUBLICATION.TYPE.FOLLOW, callback);
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
        let insertMedia = this.database.prepare('REPLACE INTO Media VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        insertMedia.run(tx.hash, media.version, date, media.userAddress, media.contentAddress, media.type, media.title,
            media.description, media.contentType, media.license, JSON.stringify(media.tags), media.price, media.publicContent, media.privateContent, function (err) {
            if (callback) {
                callback(err);
            }
        });

        this.insertMediaTags(media.contentAddress, media.tags);
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
    }

    /**
     *
     * @param callback
     */
    getAllMedia(callback) {
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
            "(SELECT count(*) FROM 'Like' l WHERE l.author = a.address) AS user_likes, " +
            "(SELECT count(*) FROM 'Unlike' ul WHERE ul.author = a.address) AS user_unlikes, " +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON " +
            "(u.user_address = m.author) ORDER BY m.creation_date DESC;", callback)
    }

    /**
     *
     * @param {string} contentId
     * @param callback
     */
    getMediaByContentId(contentId, callback) {
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
            "(SELECT count(*) FROM 'Like' l WHERE l.author = a.address) AS user_likes," +
            "(SELECT count(*) FROM 'Unlike' ul WHERE ul.author = a.address) AS user_unlikes," +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON " +
            "(u.user_address = m.author) WHERE m.txid = '" + contentId + "' ORDER BY m.creation_date DESC;", callback)
    }

    /**
     *
     * @param {string} address
     * @param callback
     */
    getMediaByAddress(address, callback) {
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
            "(SELECT count(*) FROM 'Like' l WHERE l.author = a.address) AS user_likes, " +
            "(SELECT count(*) FROM 'Unlike' ul WHERE ul.author = a.address) AS user_unlikes, " +
            "(SELECT count(*) FROM 'Like' ld WHERE ld.author = a.address AND ld.content_id = '" + address + "') AS user_liked, " +
            "(SELECT count(*) FROM 'Unlike' uld WHERE uld.author = a.address AND uld.content_id = '" + address + "') AS user_unliked, " +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON " +
            "(u.user_address = m.author) WHERE m.address = '" + address + "' ORDER BY m.creation_date DESC;", callback)
    }

    /**
     *
     * @param {string} authorAddress
     * @param callback
     */
    getMediaByAuthor(authorAddress, callback) {
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
            "(SELECT count(*) FROM 'Like' l WHERE l.author = a.address) AS user_likes, " +
            "(SELECT count(*) FROM Following f WHERE f.follower_address = a.address AND f.type = 6) AS user_following, " +
            "(SELECT count(*) FROM Following f2 WHERE f2.followed_address = a.address AND f2.type = 6) AS user_followers, " +
            "(SELECT count(*) FROM 'Unlike' ul WHERE ul.author = a.address) AS user_unlikes, " +
            "(SELECT count(*) FROM 'Like' ld WHERE ld.author = a.address AND ld.content_id = m.address) AS user_liked, " +
            "(SELECT count(*) FROM 'Unlike' uld WHERE uld.author = a.address AND uld.content_id = m.address) AS user_unliked, " +
            "(SELECT count(*) FROM 'Media' m2 WHERE m2.author = a.address) AS publications FROM Author a) u ON " +
            "(u.user_address = m.author) WHERE m.author = '" + authorAddress + "' ORDER BY m.creation_date DESC;", callback)
    }

    /**
     *
     * @param {string} authorAddress
     * @param callback
     */
    getMediaAddressByAuthor(authorAddress, callback) {
        this.query("SELECT m.address FROM Media m WHERE m.author = '" + authorAddress + "' ORDER BY m.creation_date DESC", callback);
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
     * @param {string} address
     * @param {number} amount
     * @param {number} creationDate
     * @param {string} label
     * @param {string} message
     * @param callback
     */
    insertPaymentRequest(address, amount, creationDate, label, message, callback) {
        let insertContact = this.database.prepare('REPLACE INTO PaymentRequest VALUES (?, ?, ?, ?, ?)');
        insertContact.run(address, amount, creationDate, label, message, callback);
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
     * @param {Torrent} torrent
     * @param {string} file
     * @param callback
     */
    putTorrent(hash, torrent, file, callback) {
        let insertTorrent = this.database.prepare('REPLACE INTO Torrent VALUES (?, ?, ?, ?)');
        insertTorrent.run(hash, torrent.magnetURI, torrent.path, file, callback);

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
     * @param callback
     */
    getMediaByTags(tags, callback) {
        let that = this;
        let content = [];

        this.getContentTags(tags, function (matches) {
            let ids = Utils.keys(matches);
            ids.sort(function (a, b) {
                return (matches[a] - matches[b]) * -1;
            });

            ids.forEach(function (id, index) {
                that.getMediaByContentId(id, function (result) {
                    if (result) {
                        result = result[0];
                        content.push(result);
                    }

                    if (index === ids.length + 1 && callback) {
                        callback(content);
                    }
                })
            });
        });
    }

    getPayment(userAddress, contentAddress, callback) {
        this.query('SELECT * FROM Payment WHERE content_id = "' + contentAddress + '" AND author = "' + userAddress + '"', callback);
    }

    getDonationFromMedia(mediaAddress, callback) {
        this.query('SELECT * FROM Donation WHERE content_id = "' + mediaAddress + '" ORDER BY creation_date DESC', callback)
    }

    getReceivedDonations(authorAddress, callback) {

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
        let count = 1;
        let onFinish = function () {
            count--;
            if (count === 0 && callback) {
                File.chmod(Constants.BIN_FOLDER + binaryName, "0744"); //Set permissions rwx r-- ---
                that.events.notify('onDaemonDownload', 10, 100);
                callback(true);
            }
        };

        let checksumFile = Constants.BIN_FOLDER + 'sha256sums.txt';
        let binaryFile = Constants.BIN_FOLDER + binaryName;
        let checksum;
        File.download(Constants.CHECKSUMS_URL, checksumFile, null, function () {
            let content = File.read(checksumFile);
            let lines = content.split('\n');
            for (let x in lines) {
                let l = lines[x];
                if (l.includes(binaryName)) {
                    checksum = l.split('  ')[0];
                    break;
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
                    if (checksumBin === checksum) {
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
        config.daemon = OS.isWindows() ? 0 : 1;
        config.testnet = this.network === Network.TESTNET ? 1 : 0;
        config.savedOn(Constants.BIN_FOLDER + "/creativecoin.conf");

    }

    prepareClients() {
        let conf = NodeConfiguration.loadFrom(Constants.BIN_FOLDER + '/creativecoin.conf');
        let conn = {
            protocol: 'http',
            user: conf.rpcuser,
            pass: conf.rpcpassword,
            host: '127.0.0.1',
            port: conf.rpcport
        };

        this.client = new RpcClient(conn);
    }

    initClients(callback) {
        let that = this;
        let inits = 2;

        let callCallback = function () {
            //that.log('Inits to perform:' + inits);
            inits--;
            if (inits === 0) {
                if (callback) {
                    callback();
                }
            }
        };

        let daemon = Constants.BIN_FOLDER + Constants.BINARY_NAME;
        OS.run(daemon + ' -datadir=' + Constants.BIN_FOLDER, function (result, stderr) {
            that.log('Starting daemon', daemon, result, stderr);
            callCallback();
        });

        File.mkpath(Constants.DATABASE_FILE, true);
        this.database = new Storage(Constants.DATABASE_FILE);
        this.database.init();
        callCallback();
    }

    explore() {
        this.isExploring = true;
        let startBlock = this.trantorStorage.getKey('lastExploredBlock', Constants.START_BLOCK);
        startBlock = startBlock < Constants.START_BLOCK ? Constants.START_BLOCK : startBlock;
        this.log('Start exploration at block', startBlock);
        let that = this;

        let onExplore = function () {
            that.client.getBlockCount(function (err, result) {

                if (!err) {
                    that.events.notify('onExploreStart', 10, startBlock);
                    let blockCount = parseInt(result.result);

                    let broadcastProgress = function (currentHeight) {
                        //that.log('broadcasting progress', currentHeight);
                        that.events.notify('onExploreProgress', 10, blockCount, currentHeight);
                    };

                    let processBlock = function (blockHeight) {
                        that.client.getBlockHash(blockHeight, function (err, blockHash) {
                            if (!err) {
                                blockHash = blockHash.result;

                                that.client.getBlock(blockHash, function (err, block) {
                                    block = block.result;
                                    //that.log(block);
                                    let blockTime = block.time * 1000;
                                    let txIds = block.tx;

                                    let count = 0;
                                    let readingIndex = false;
                                    let onReadTx = function () {
                                        //that.log('onReadTx', count, readingIndex, txIds.length);
                                        if (count === txIds.length && !readingIndex) {
                                            broadcastProgress(blockHeight);
                                            that.trantorStorage.setKey('lastExploredBlock', blockHeight);
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
                                                rawTx = rawTx.result;
                                                let tx = DecodedTransaction.fromHex(rawTx);
                                                if (tx.containsData()) {

                                                    let broadcastData = function (data) {
                                                        //that.log('broadcasting data', data);
                                                        that.events.notify('onDataFound', 0, tx, data, blockTime);
                                                    };

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
                                                                result = result.result;
                                                                let decodedTx = DecodedTransaction.fromHex(result);
                                                                hexData += decodedTx.getRawData().toString('hex');
                                                                indexCount++;
                                                                onRaw();
                                                            })
                                                        })
                                                    } else {
                                                        broadcastData(data);
                                                    }

                                                }

                                                count++;
                                                onReadTx();
                                            }
                                        };

                                        that.getRawTransaction(txHash, processTx);

                                    })
                                })
                            } else if (blockHeight >= blockCount) {
                                //Exploration finish
                                that.isExploring = false;
                                that.trantorStorage.setKey('lastExploredBlock', blockHeight);
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
                    }, 5 * 1000);
                }
            });
        };
        setTimeout(function () {
            onExplore();
        }, 100)
    }

    start(callback) {
        let that = this;
        this.checkBinariesExists(function (exists) {
            if (exists) {
                that.prepareConfiguration();
                that.prepareClients();
                that.initClients(function () {
                    that.events.notify('onStart', 10);
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
        this.log('Closing platform');
        this.client.stop(function (err, result) {
            console.log(err, result);
        })
    }

    /**
     *
     * @param {string} password
     * @param callback
     */
    encryptWallet(password, callback) {
        this.client.encryptWallet(password, callback);
    }

    getSpendables(callback) {
        this.client.listUnspent(function (err, result) {
            let spendables = Spendable.parseJson(result.result);
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
        this.client.dumpPrivKey(address, function (err, result) {
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
                    privKeys.push(result.result);
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
     * @param {string} address
     * @param {number} amount
     * @param callback
     */
    createDataTransaction(data, address, amount, callback) {
        amount = amount ? amount : TX_CONTENT_AMOUNT;
        let that = this;
        let onBuild = function (txBuilder, creaBuilder) {
            if (callback) {
                callback(creaBuilder, txBuilder.inputs, txBuilder);
            }
        };

        this.getSpendables(function (err, spendables) {

            if (spendables.length > 0) {
                that.buildDataOutput(data, function (opReturnData) {
                    let dataSize = opReturnData.length;

                    let txBuilder = new TransactionBuilder();
                    let creaBuilder = new creativecoin.TransactionBuilder(NETWORK);

                    txBuilder.extraSize = dataSize;
                    txBuilder.changeAddress = address;
                    txBuilder.addOutput(address, amount);

                    txBuilder.completeTx(spendables);

                    if (txBuilder.complete) {
                        txBuilder.inputs.forEach(function (input) {
                            creaBuilder.addInput(input.txId, input.index);
                        });

                        creaBuilder.addOutput(opReturnData, 0);

                        txBuilder.outputs.forEach(function (output) {
                            creaBuilder.addOutput(output.address, output.amount);
                        });

                        let fee = txBuilder.getFee();
                        that.log('Fee: ', txBuilder.size() + ' at ' + Coin.parseCash(txBuilder.feePerKb, 'CREA').toString() + '/Kb = ' + Coin.parseCash(fee, 'CREA').toString());
                        creaBuilder.txFee = fee;
                        onBuild(txBuilder, creaBuilder);
                    } else {
                        that.error('Tx is incomplete', txBuilder, spendables);
                    }
                });
            } else {
                that.error('Not found spendables for this data', err, spendables);
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
     * @param {Torrent} avatar
     * @param {Array} tags
     */
    register(userAddress, nick, email, web, description, avatar, tags) {
        let that = this;

        setTimeout(function () {
            that.log('Author Torrent created!', avatar);
            let userReg = new Author(userAddress, nick, email, web, description, avatar.magnetURI, tags);
            let buffUser = userReg.serialize();
            that.createDataTransaction(userReg, userAddress, null, function (txBuilder, spendables) {
                that.signTransaction(txBuilder, spendables, function (err, rawTx) {
                    if (err) {
                        that.error(err);
                    } else {
                        let txBuffer = Buffer.from(rawTx, 'hex');
                        let tx = creativecoin.Transaction.fromBuffer(txBuffer);
                        that.events.notify('onBeforeRegister', 10, txBuffer, userReg, avatar);
                    }

                });
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
     * @param {number} contentType
     * @param {number} license
     * @param {Array} tags
     * @param {Torrent} publicTorrent
     * @param {Torrent} privateTorrent
     * @param {number} price
     */
    publish(userAddress, publishAddress, title, description, contentType, license, tags, publicTorrent, privateTorrent, price) {
        let that = this;

        setTimeout(function () {

            let pubUri = publicTorrent ? publicTorrent.magnetURI : '';
            let prvUri = privateTorrent ? privateTorrent.magnetURI : '';
            let mediaPost = new MediaData(title, description, contentType, license, userAddress,
                publishAddress, tags, price, pubUri, prvUri);

            let postBuffer = mediaPost.serialize();

            let deSeedTorrent = function (torrent) {
                if (torrent) {
                    that.events.notify('onDeSeedFile', 10, torrent);
                }
            };

            that.createDataTransaction(mediaPost, publishAddress, null, function (txBuilder, spendables) {
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

            })
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
     * @param callback
     */
    searchByTags(tags, callback) {
        this.database.getMediaByTags(tags, callback);
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
            that.signTransaction(txBuilder, spendables, function (err, rawTx) {
                if (err) {
                    that.error(err);
                } else {
                    let txBuffer = Buffer.from(rawTx, 'hex');
                    let tx = creativecoin.Transaction.fromBuffer(txBuffer);
                    that.events.notify('onBeforeComment', 10, txBuffer, commentData);
                }
            })
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
            that.signTransaction(txBuilder, spendables, function (err, rawTx) {
                if (err) {
                    that.error(err);
                } else {
                    let txBuffer = Buffer.from(rawTx, 'hex');
                    that.events.notify('onBeforeLike', 10, txBuffer, likeData);
                }
            })
        })
    }

    makeContentPayment(userAddress, contentAddress) {
        let that = this;

        setTimeout(function () {
            that.database.getMediaByAddress(contentAddress, function (err, result) {
                if (err) {
                    that.error(err);
                } else {
                    result = result[0];
                    let paymentData = new Payment(userAddress, contentAddress, result.price);
                    that.createDataTransaction(paymentData, contentAddress, result.price, function (creaBuilder, spendables, txBuilder) {
                        that.signTransaction(creaBuilder, spendables, function (err, rawTx) {
                            if (err) {
                                that.error(err);
                            } else {
                                let txBuffer = Buffer.from(rawTx, 'hex');
                                that.events.notify('onBeforePayment', 10, creaBuilder, txBuffer, paymentData, txBuilder);
                            }
                        })
                    })
                }
            })
        }, 10)
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

class Torrents {
    /**
     *
     * @param {Trantor} trantor
     */
    constructor(trantor) {
        this.torrentClient = new WebTorrent();
        this.trantor = trantor;
        this.torrentIds = {};
    }

    /**
     *
     * @param {string} file
     * @param {string} destPath
     * @param callback
     */
    createTorrent(file, destPath, callback) {
        let that = this;
        setTimeout(function () {
            that.trantor.log(file, destPath);
            if (!File.exist(destPath)) {
                File.mkpath(destPath);
            }
            let files = file.split(Constants.FILE_SEPARATOR);
            let name = files[files.length-1];
            let destFile = destPath + name;

            File.cp(file, destFile);

            that.seedFile(destFile, callback);
        }, 10);


    }

    /**
     *
     * @param {string} torrentId
     * @returns {boolean}
     */
    containsTorrent(torrentId) {
        let torrent = this.getTorrent(torrentId);
        return torrent !== undefined && torrent !== null;
    }

    /**
     *
     * @param {string}torrentId
     * @returns {Torrent|null}
     */
    getTorrent(torrentId) {
        if (File.exist(torrentId)) {
            torrentId = this.torrentIds[torrentId];
        }

        return this.torrentClient.get(torrentId);
    }

    /**
     *
     * @param {string} file
     * @param callback
     */
    seedFile(file, callback) {
        let that = this;

        setTimeout(function () {
            let onTorrent = function (torrent) {
                that.trantor.log('Seeding', file);
                that.torrentIds[file] = torrent.infoHash;
                let tHash = Utils.makeHash(torrent.magnetURI);

                that.trantor.database.putTorrent(tHash, torrent, file);
                if (callback) {
                    callback(torrent);
                }
            };

            if (that.containsTorrent(file)) {
                let torrent = that.getTorrent(file);
                onTorrent(torrent);
            } else {
                that.torrentClient.seed(file, function (torrent) {
                    onTorrent(torrent);
                })
            }
        }, 10);
    }

    /**
     *
     * @param {string} contentAddress
     * @param {string} magnet
     * @param {boolean} privateContent
     */
    downloadTorrent(contentAddress, magnet, privateContent = false) {

        if (magnet) {
            let that = this;
            setTimeout(function () {
                let path = Constants.TORRENT_FOLDER + contentAddress + Constants.FILE_SEPARATOR;
                if (privateContent) {
                    path += '-p'
                }
                File.mkpath(path);

                if (!that.containsTorrent(magnet)) {
                    that.torrentClient.add(magnet, {path: path}, function (torrent) {
                        torrent.on('done', function () {
                            that.trantor.events.notify('onTorrentDownloaded', 100, contentAddress, torrent);
                            let tHash = Utils.makeHash(torrent.magnetURI);
                            let file = torrent.path + torrent.name;
                            that.torrentIds[file] = torrent.infoHash;
                            that.trantor.database.putTorrent(tHash, torrent, file, function (err) {
                                that.trantor.error(err);
                            });
                        })
                    })
                } else {
                    let torrent = that.getTorrent(magnet);
                    that.trantor.events.notify('onTorrentDownloaded', 100, contentAddress, torrent);
                }
            }, 10);


        }

    }

    /**
     *
     * @param {string} torrent
     * @param callback
     */
    remove(torrent, callback) {
        let that = this;
        setTimeout(function () {
            if (File.exist(torrent)) {
                torrent = this.torrentIds[torrent];
            }
            that.torrentClient.remove(torrent, callback);
        }, 10);

    }
}

if (module) {
    module.exports = {CoinUri, Currency, UnknownCurrency, FiatCurrency, CryptoCurrency, Eur, Usd, Mxn, Pln, Btc, Crea, Coin,
        MonetaryFormat, CryptoCoin, EurCoin, BitCoin, CreativeCoin, DollarCoin, PesoCoin, ZlotiCoin, Prices, ErrorCodes,
        OS, File, Constants, FileStorage, Utils, PUBLICATION, ContentData, Author, MediaData, Like, Comment, Donation, Following,
        Follow, Unfollow, TxInput, TxOutput, DecodedTransaction, Network, NodeConfiguration, EventHandler, Trantor, Notifications, Torrents}
}