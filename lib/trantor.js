
const {app, ipcMain} = require('electron');

const fs = require('fs');
const os = require('os');
const exec = require('child_process').exec;
const request = require('request');
const lzma = require('lzma');

const creativecoin = require('bitcoinjs-lib');
const RpcClient = require('bitcoind-rpc');
const WebTorrent = require('webtorrent');
const sqlite = require('sqlite3');

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
            let isDecimal = isNumber && amount % 1 !== 0;

            let rounded = 0;

            if (!isDecimal) {
                rounded = currency.getScale();
            }

            amount = Math.round(amount * Math.pow(10, currency.getScale() - rounded));
        } else if (typeof amount === 'string' && !isNaN(amount)) {
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

const TX_CONTENT_AMOUNT = Coin.parseCash(0.0001, 'CREA').amount;
const TX_CURRENT_VERSION = 0x0002;
const TX_CONTENT_VERSION = 0x0008;
const TX_DEFAULT_VERSION = TX_CURRENT_VERSION | TX_CONTENT_VERSION;
const COPRESSION_LEVEL = 9;

const CONTENT = {};

CONTENT.START_BLOCK = 17000;
CONTENT.MAGIC_BYTE = 0xB8; //Start flag to read content
CONTENT.VERSION = 0x0000; //Content version
CONTENT.LIMIT = {};
CONTENT.LIMIT.POST_DESCRIPTION  = {
    TEXT: 233,
    BINARY: 466
};
CONTENT.LIMIT.POST_TITLE  = {
    TEXT: 55,
    BINARY: 110
};

CONTENT.LIMIT.COMMENT  = {
    TEXT: 233,
    BINARY: 466
};

CONTENT.LIMIT.NICK = {
    TEXT: 21,
    BINARY: 42
};

CONTENT.LIMIT.WEB = {
    TEXT: 55,
    BINARY: 110
};

CONTENT.LIMIT.USER_DESCRIPTION = {
    TEXT: 144,
    BINARY: 288
};

CONTENT.LIMIT.MAIL = {
    TEXT: 55,
    BINARY: 110,
};

CONTENT.LIMIT.USER_TAG = {
    TEXT: 13,
    BINARY: 26
};

CONTENT.LIMIT.TAG = {
    TEXT: 21,
    BINARY: 42
};

CONTENT.TYPE = {
    EMPTY: 0x00,
    IMAGE: 0x01,
    AUDIO: 0x02,
    VIDEO: 0x03,
    FONT: 0x04,
    CSS: 0x05,
    CSV: 0x06,
    DOC: 0x07,
    HTML: 0x08,
    JS: 0x09,
    JSON: 0x0A,
    MD: 0x0B,
    ODB: 0x0C,
    ODC: 0x0D,
    ODF: 0x0E,
    ODG: 0x0F,
    ODI: 0x10,
    ODP: 0x11,
    ODT: 0x12,
    ODS: 0x13,
    PLAIN: 0x14,
    PPT: 0x15,
    PY: 0x16,
    RTF: 0x17,
    SWF: 0x18,
    XLS: 0x19,
    XML: 0x20,
    USER: 0x80,
    LIKE: 0x81,
    COMMENT: 0x82,
    DONATION: 0x83,
    FOLLOW: 0x84,
    UNFOLLOW: 0x85,
    OTHER: 0xFF,
};

CONTENT.LICENSE = {
    PUBLIC_DOMAIN: 0x00,
};

class ErrorCodes {}
ErrorCodes.INVALID_PLATFORM = 'INVALID_PLATFORM';
ErrorCodes.BINARY_NOT_FOUND = 'BINARY_NOT_FOUND';


class OS {

    static isLinux() {
        return os.platform().toLowerCase().includes('linux');
    };

    static isWindows() {
        return os.platform().toLowerCase().includes('win');
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

    static getCoreBinaryName() {
        if (OS.isLinux()) {
            return OS.is64Bits() ? 'creativecoind-linux64' : 'creativecoind-linux32'
        } else if (OS.isWindows()) {
            return OS.is64Bits() ? 'creativecoind-win64.exe' : 'creativecoind-win32.exe'
        } else if (OS.isMac()) {
            return 'creativecoind-osx.dmg'
        }

        throw ErrorCodes.INVALID_PLATFORM;
    }

    static getClientBinaryName() {
        if (OS.isLinux()) {
            return OS.is64Bits() ? 'creativecoin-cli-linux64' : 'creativecoin-cli-linux32'
        } else if (OS.isWindows()) {
            return OS.is64Bits() ? 'creativecoin-cli-win64.exe' : 'creativecoin-cli-win32.exe'
        } else if (OS.isMac()) {
            return 'creativecoin-cli-osx.dmg'
        }

        throw ErrorCodes.INVALID_PLATFORM;
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

class Constants {}

Constants.DEBUG = true;
Constants.FILE_SEPARATOR = OS.getPathSeparator();
Constants.APP_FOLDER = '.';
Constants.BIN_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'bin';
Constants.LANG_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'assets' + Constants.FILE_SEPARATOR + 'lang' + Constants.FILE_SEPARATOR;
Constants.TORRENT_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'torrents' + Constants.FILE_SEPARATOR;
Constants.STORAGE_FILE = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'app.conf';
Constants.CORE_PATH = Constants.BIN_FOLDER + Constants.FILE_SEPARATOR + OS.getCoreBinaryName();
Constants.CLIENT_PATH = Constants.BIN_FOLDER + Constants.FILE_SEPARATOR + OS.getClientBinaryName();
Constants.BINARIES_URL = 'https://binaries.creativechain.net/stable/';
Constants.DATABASE_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'database' + Constants.FILE_SEPARATOR;
Constants.DATABASE_FILE = Constants.DATABASE_FOLDER + 'index.db';
Constants.DATABASE_CREATION_FILE = Constants.DATABASE_FOLDER + 'index.db.sql';
Constants.CONTENT_PATH = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'content.json';
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
            console.log('File exists', path);
            return true;
        } catch (err) {
            console.log('File not exist', path);
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
        let fd = fs.openSync(path, 'w+');
        fs.writeSync(fd, content, format);
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
        let content = File.read(source);
        File.write(dest, content);
    }

    /**
     *
     * @param {string} path
     * @returns {string}
     */
    static getExtension(path) {
        return path.split('.').pop();
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
        let dirs = path.split(Constants.FILE_SEPARATOR);
        let route = '';
        let length = hasFile ? dirs.length - 1: dirs.length;
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

    static download(url, targetPath, callback) {
        let receivedBytes = 0;
        let totalBytes = 0;

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
            receivedBytes += chunk.length;

            let percentage = (receivedBytes * 100) / totalBytes;
            console.log(percentage + '% | ' + receivedBytes + '/' + totalBytes);
        });

        req.on('end', function () {
            console.log('File downloaded!');
            callback();
        })
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

    static writeUInt64LE (buffer, value, offset) {
        verifuint(value, 0x001fffffffffffff);

        buffer.writeInt32LE(value & -1, offset);
        buffer.writeUInt32LE(Math.floor(value / 0x100000000), offset + 4);
        return offset + 8
    }

    /**
     *
     * @param buffer
     * @param offset
     * @returns {*}
     */
    static readUInt64LE (buffer, offset) {
        let a = buffer.readUInt32LE(offset);
        let b = buffer.readUInt32LE(offset + 4);
        b *= 0x100000000;

        Utils.verifuint(b + a, 0x001fffffffffffff);

        return b + a
    }

    static verifuint (value, max) {
        if (typeof value !== 'number') throw new Error('cannot write a non-number as a number');
        if (value < 0) throw new Error('specified a negative value for writing an unsigned value');
        if (value > max) throw new Error('RangeError: value out of range');
        if (Math.floor(value) !== value) throw new Error('value has a fractional component');
    }

    /**
     *
     * @param str
     * @returns {string}
     */
    static stringToHex(str) {
        let hex, i;

        let result = "";
        for (i=0; i<str.length; i++) {
            hex = str.charCodeAt(i).toString(16);
            result += ("000"+hex).slice(-4);
        }

        return result
    }

    /**
     *
     * @param str
     * @returns {string}
     */
    static hexToString(str) {
        let j;
        let hexes = str.match(/.{1,4}/g) || [];
        let back = "";
        for(j = 0; j<hexes.length; j++) {
            back += String.fromCharCode(parseInt(hexes[j], 16));
        }

        return back;
    }

    /**
     *
     * @param {Buffer} data
     * @param {number} mode
     * @param callback
     */
    static compress(data, mode, callback) {
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
     * @param callback
     */
    static decompress(data, callback) {
        let compressor = new lzma.LZMA();
        compressor.decompress(data, function (result, error) {
            result = Buffer.from(result);
            console.log('Data decompressed:', result.length, result.toString('hex'));
            callback(result, error);
        })
    }

}


class VarInt {
    constructor(buffer, offset = 0) {
        if (typeof buffer === 'number') {
            this.value = buffer;
        } else {
            let first = 0xFF && buffer[offset];

            if (first < 253) {
                this.value = first;
            } else if (first === 253) {
                this.value = (0xFF && buffer[offset + 1]) | ((0xFF && buff[offset + 2]) << 8);
            } else if (first === 254) {
                this.value = buffer.readUInt32BE(offset + 1);
            } else {
                this.value = Utils.readUInt64LE(buffer, offset + 1);
            }
        }

    }

    /**
     *
     * @returns {number}
     */
    size() {
        // if negative, it's actually a very large unsigned long value
        if (this.value < 0) return 9; // 1 marker + 8 data bytes
        if (this.value < 253) return 1; // 1 data byte
        if (this.value <= 0xFFFF) return 3; // 1 marker + 2 data bytes
        if (this.value <= 0xFFFFFFFF) return 5; // 1 marker + 4 data bytes
        return 9; // 1 marker + 8 data bytes

    }

    /**
     * Returns enconded string in Hexadecimal
     * @returns {string}
     */
    encode() {
        let buff;
        switch (this.size()) {
            case 1:
                return Buffer.from(this.value.toString(16)).toString('hex');
            case 3:
                return Buffer.from([253, this.value, this.value >> 8]).toString('hex');
            case 5:
                buff = Buffer.alloc(5);
                buff[0] = 254;
                buff.writeUInt32LE(this.value, 1);
                return buff.toString('hex');
            default:
                buff = Buffer.alloc(9);
                buff[0] = 255;
                Utils.writeUInt64LE(buff, this.value, 1);
                return buff.toString('hex');

        }
    }
}

class ContentData {
    constructor(version = CONTENT.VERSION, type) {
        this.version = version;
        this.type = type;
    }

    /**
     *
     * @return {Number}
     */
    size() {
        return this.serialize().length;
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
     * @param {string} text
     * @param limit
     */
    static serializeText(text, limit) {
        if (text) {
            let textHex = Utils.stringToHex(text);
            let textBuffer = Buffer.from(textHex);
            if (limit) {
                ContentData.checkLimit(text, textBuffer, limit);
            }
            let textVarInt = new VarInt(textBuffer.length);
            return textVarInt.encode() + textHex;
        } else {
            let textVarInt = new VarInt(0);
            return textVarInt.encode();
        }
    }

    /**
     *
     * @param {Buffer} buffer
     * @param {number} offset
     * @return {object}
     */
    static deserializeText(buffer, offset) {
        let varInt = new VarInt(buffer, offset);
        offset += varInt.size();
        let textHex = buffer.slice(offset, offset + varInt.value).toString('hex');
        return {
            text: Utils.hexToString(textHex),
            offset: offset + varInt.value
        }
    }

    /**
     *
     * @param {string} contentType
     * @return {number}
     */
    static serializeContentType(contentType) {
        contentType = contentType.toLowerCase();

        switch (contentType) {
            case 'audio/aac':
            case 'audio/ac3':
            case 'audio/mpa':
            case 'audio/mp4':
            case 'audio/mpeg':
            case 'audio/mpg':
            case 'audio/ogg':
            case 'audio/webm':
            case 'audio/3gpp':
            case 'audio/3gpp2':
                return CONTENT.TYPE.AUDIO;
            case 'image/bmp':
            case 'image/jpeg':
            case 'image/jpg':
            case 'image/png':
            case 'image/svg+xml':
                return CONTENT.TYPE.IMAGE;
            case 'video/3gpp':
            case 'video/3gpp2':
            case 'video/mp4':
            case 'video/ogg':
                return CONTENT.TYPE.VIDEO;
            case 'font/otf':
            case 'font/ttf':
            case 'font/woff':
            case 'font/woff2':
                return CONTENT.TYPE.FONT;
            case 'text/plain':
                return CONTENT.TYPE.PLAIN;
            case 'text/css':
                return CONTENT.TYPE.CSS;
            case 'text/csv':
                return CONTENT.TYPE.CSV;
            case 'text/html':
                return CONTENT.TYPE.HTML;
            case 'text/javascript':
                return CONTENT.TYPE.JS;
            case 'text/markdown':
                return CONTENT.TYPE.MD;
            case 'text/rtf':
                return CONTENT.TYPE.RTF;
            case 'text/xml':
                return CONTENT.TYPE.XML;
            case 'application/msword':
                return CONTENT.TYPE.DOC;
            case 'application/mspowerpoint':
            case 'application/vnd.ms-powerpoint':
            case 'application/powerpoint':
            case 'application/x-mspowerpoint':
                return CONTENT.TYPE.PPT;
            case 'application/excel':
            case 'application/x-excel':
            case 'application/x-msexcel':
            case 'application/msexcel':
            case 'application/vnd.ms-excel':
                return CONTENT.TYPE.XLS;
            case 'application/vnd.oasis.opendocument.database':
                return CONTENT.TYPE.ODB;
                case 'application/vnd.oasis.opendocument.chart':
                return CONTENT.TYPE.ODC;
            case 'application/vnd.oasis.opendocument.formula':
                return CONTENT.TYPE.ODF;
            case 'application/vnd.oasis.opendocument.graphics':
                return CONTENT.TYPE.ODG;
            case 'application/vnd.oasis.opendocument.image':
                return CONTENT.TYPE.ODI;
            case 'application/vnd.oasis.opendocument.text':
                return CONTENT.TYPE.ODT;
            case 'application/vnd.oasis.opendocument.presentation':
                return CONTENT.TYPE.ODP;
            case 'application/vnd.oasis.opendocument.spreadsheet':
                return CONTENT.TYPE.ODS;
            default:
                return CONTENT.TYPE.OTHER;
        }
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
     */
    constructor(address, nick, email, web, description, avatar) {
        super(CONTENT.VERSION, CONTENT.TYPE.USER);
        this.address = address;
        this.nick = nick;
        this.email = email;
        this.web = web;
        this.description = description;
        this.avatar = avatar;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = this.version.toString(16) + this.type.toString(16);
        bufferHex += this.address;

        bufferHex += ContentData.serializeText(this.nick, CONTENT.LIMIT.NICK);
        bufferHex += ContentData.serializeText(this.email, CONTENT.LIMIT.MAIL);
        bufferHex += ContentData.serializeText(this.web, CONTENT.LIMIT.WEB);
        bufferHex += ContentData.serializeText(this.description, CONTENT.LIMIT.USER_DESCRIPTION);
        bufferHex += ContentData.serializeText(this.avatar);
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
     * @param {string} address
     * @param {string} torrent
     */
    constructor(title, description, contentType, license, userAddress, address, torrent) {
        super(CONTENT.VERSION, ContentData.serializeContentType(contentType));
        this.userAddress = userAddress;
        this.contentAddress = address;
        this.license = license;
        this.title = title;
        this.comment = text;
        this.torrent = torrent;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = this.version.toString(16) + this.type.toString(16);
        bufferHex += this.userAddress;
        bufferHex += this.contentAddress;
        bufferHex += this.license.toString(16);
        bufferHex += ContentData.serializeText(this.title, CONTENT.LIMIT.POST_TITLE);
        bufferHex += ContentData.serializeText(this.comment, CONTENT.LIMIT.POST_DESCRIPTION);
        bufferHex += ContentData.serializeText(this.torrent);
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
        offset += 20;

        this.contentAddress = buffer.slice(offset, offset + 20);
        offset += 20;

        this.license = buffer.readInt8(offset);
        offset += 1;

        let desTitle = ContentData.deserializeText(buffer, offset);
        this.title = desTitle.text;
        offset += desTitle.offset;

        let desComment = ContentData.deserializeText(buffer, offset);
        this.comment = desComment.text;
        offset += desComment.offset;

        let desTorrent = ContentData.deserializeText(buffer, offset);
        this.torrent = desTorrent.text;
        offset += desTorrent.offset;

        return offset;
    }
}

class Like extends ContentData {
    constructor(address, contentId) {
        super(CONTENT.VERSION, CONTENT.TYPE.LIKE);
        this.address = address;
        this.contentId = contentId;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = this.version.toString(16) + this.type.toString(16);
        bufferHex += this.address;
        bufferHex += this.contentId;
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
        offset += 20;
        this.contentId = buffer.slice(offset, offset + 32).toString('hex');
        offset += 32;
        return offset;
    }
}

class Comment extends ContentData {
    constructor(address, contentId, comment) {
        super(CONTENT.VERSION, CONTENT.TYPE.COMMENT);
        this.address = address;
        this.contentId = contentId;
        this.comment = comment;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = this.version.toString(16) + this.type.toString(16);
        bufferHex += this.address;
        bufferHex += this.contentId;
        bufferHex += ContentData.serializeText(this.comment, CONTENT.LIMIT.COMMENT);
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
        this.address = buffer.slice(offset, offset + 20).toString('hex');
        offset += 20;
        this.contentId = buffer.slice(offset, offset + 32).toString('hex');
        offset += 32;
        let varInt = new VarInt(buffer, offset);
        offset += varInt.size();
        this.comment = buffer.slice(offset, offset + varInt.value).toString('hex');
        this.comment = Utils.hexToString(this.nick);
        offset += varInt.value;
        return offset;
    }
}

class Donation extends ContentData {
    constructor(address) {
        super(CONTENT.VERSION, CONTENT.TYPE.DONATION);
        this.address = address;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = this.version.toString(16) + this.type.toString(16);
        bufferHex += this.address;
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
        this.address = buffer.slice(offset, offset + 20).toString('hex');
        offset += 20;
        return offset;
    }
}

class Following extends ContentData {
    constructor(type, followerAddress, followedAddress) {
        super(CONTENT.VERSION, type);
        this.followerAddress = followerAddress;
        this.followedAddress = followedAddress;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = this.version.toString(16) + this.type.toString(16);
        bufferHex += this.followerAddress;
        bufferHex += this.followedAddress;
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
        this.followerAddress = buffer.slice(offset, offset + 20).toString('hex');
        offset += 20;
        this.followedAddress = buffer.slice(offset, offset + 20).toString('hex');
        offset += 20;
        return offset;
    }
}
class Follow extends Following {
    constructor(followerAddress, followedAddress) {
        super(CONTENT.VERSION, CONTENT.TYPE.FOLLOW, followerAddress, followedAddress);
    }
}

class Unfollow extends Following {
    constructor(followerAddress, followedAddress) {
        super(CONTENT.VERSION, CONTENT.TYPE.UNFOLLOW, followerAddress, followedAddress);
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

class Spendable {
    constructor(txId, index, amount, confirmations, spendable, scriptPubKey) {
        this.txId = txId;
        this.index = index;
        this.amount = amount;
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
     * @returns {Array}
     */
    static spendablesFrom(amount, spendables) {
        let matches = [];

        //Check if a UTXO match with target amount
        for (let x = 0; x < spendables.length; x++) {
            let spendable = spendables[x];
            if (spendable.matchAmount(amount)) {
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
                if (utxoSumAmount >= amount) {
                    return utxoLessThanAmount;
                }
            }
        }

        //Not Spendable UTXOs, searchin first utxo greater than amount
        let utxoGreaterThanAmount = [];
        for (let x = 0; x < spendables.length; x++) {
            let spendable = spendables[x];
            if (spendable.amount > amount) {
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

        json.forEach(function (spend, index, array) {
            spendables.push(new Spendable(spend.txid, spend.vout, spend.amount, spend.confirmations, spend.spendable, spend.scriptPubKey))
        });

        return spendables;
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
     * @param txHex
     * @returns {DecodedTransaction}
     */
    static fromHex(txHex) {
        let dtx = new DecodedTransaction(txHex);
        let tx = creativecoin.Transaction.fromHex(txHex);

        tx.ins.forEach(function (input, index, array) {
            let txInput = new TxInput(input.hash.toString('hex'), input.index, input.script.toString('hex'), input.sequence, input.witness);
            dtx.inputs.push(txInput);
        });

        tx.outs.forEach(function (output, index, array) {
            let txOutput = new TxOutput(output.script.toString('hex'), output.value, index);
            dtx.outputs.push(txOutput);
        });

        dtx.version = tx.version;
        dtx.locktime = tx.locktime;
        dtx.hash = tx.getId();
        return dtx;
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
        return !this[key];
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

    init() {
        let sqlCreationQueries = File.read(Constants.DATABASE_CREATION_FILE);
        this.database.run(sqlCreationQueries, function (err) {
            console.log(err);
        });
    }

    /**
     *
     * @param {Author} user
     * @param {DecodedTransaction} tx
     * @param callback
     */
    addAuthor(user, tx, callback) {
        let insertUser = this.database.prepare('INSER INTO Author VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        insertUser.run(tx.hash, user.version, tx.locktime, user.nick, user.address, user.email, user.web, user.description, user.avatar, function (err) {
            if (callback) {
                callback(err);
            }
        });
    }

    /**
     *
     * @param torrent
     * @param {string} file
     * @param callback
     */
    addTorrent(torrent, file, callback) {
        let insertTorrent = this.database.prepare('INSER INTO Torrent VALUES (?, ?, ?)');
        insertTorrent.run(torrent.infoHash, torrent.magnet, file, function (err) {
            if (callback) {
                callback(err);
            }
        });
    }

    /**
     *
     * @param {Comment} comment
     * @param {DecodedTransaction} tx
     * @param callback
     */
    addComment(comment, tx, callback) {
        let insertCallback = this.database.prepare('INSER INTO Comment VALUES (?, ?, ?, ?, ?, ?)');
        insertCallback.run(tx.hash, comment.version, comment.address, comment.contentId, comment.comment, tx.locktime, function (err) {
            if (callback) {
                callback(err);
            }
        });
    }

    /**
     *
     * @param {Following} following
     * @param {DecodedTransaction} tx
     * @param callback
     */
    addFollowing(following, tx, callback) {
        let insertFollowing = this.database.prepare('INSER INTO Following VALUES (?, ?, ?, ?, ?, ?)');
        insertFollowing.run(tx.hash, following.version, tx.locktime, following.followerAddress, following.followedAddress, following.type, function (err) {
            if (callback) {
                callback(err);
            }
        });
    }

    /**
     *
     * @param {Like} like
     * @param {DecodedTransaction} tx
     * @param callback
     */
    addLike(like, tx, callback) {
        let insertLike = this.database.prepare('INSER INTO Like VALUES (?, ?, ?)');
        insertLike.run(tx.hash, like.version, like.address, like.contentId, txid, function (err) {
            if (callback) {
                callback(err);
            }
        });
    }

    /**
     *
     * @param {MediaData} media
     * @param {DecodedTransaction} tx
     * @param callback
     */
    addMedia(media, tx, callback) {
        let insertMedia = this.database.prepare('INSER INTO Media VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        insertMedia.run(tx.hash, media.version, tx.locktime, media.contentAddress, media.type, media.title, media.comment, media.torrent, media.userAddress, function (err) {
            if (callback) {
                callback(err);
            }
        });
    }
}


class Trantor {
    constructor(network = NETWORK) {
        this.network = network;
        this.client = null;
        this.torrentClient = new WebTorrent();
        this.database = null;
        this.onError = null;
        this.onTorrentDownloaded = null;
    }

    throwError(error) {
        if (this.onError) {
            this.onError(error);
        }
    }

    checkBinaryExist(binary, callback) {
        OS.run('whereis ' + binary, function (result) {
            result = result.split(binary + ': ');
            if (result.length > 1) {
                callback(true);
            } else {
                callback(false);
            }
        })
    }

    prepareConfiguration() {
        let config = NodeConfiguration.loadFrom(Constants.BIN_FOLDER + '/creativecoin.conf');

        config.setIfNotExist('rpcuser', 'creativecoin');
        config.setIfNotExist('rpcpassword', Utils.randomString(9));
        config.setIfNotExist('rpcworkqueue', 2000);
        config.rpcport = 1188;
        config.txindex = 1;
        config.daemon = 1;
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
        let inits = 2;

        let callCallback = function () {
            console.log('Inits to perform:' + inits);
            inits--;
            if (inits === 0) {
                if (callback) {
                    callback();
                }
            }
        };

        OS.run('creativecoind -datadir=' + Constants.BIN_FOLDER, function (result, stderr) {
            console.log('Starting platform:', result, stderr);
            callCallback();
        });

        this.database = new Storage(Constants.DATABASE_FILE);
        this.database.init();
        callCallback();
    }

    start(callback) {
        let that = this;
        this.checkBinaryExist('creativecoind', function (exists) {
            if (exists) {
                that.prepareConfiguration();
                that.prepareClients();
                that.initClients(callback);
            } else {
                that.throwError(ErrorCodes.BINARY_NOT_FOUND)
            }
        })
    }

    stop(system, datadir) {
        system.run('creativecoin-cli -datadir=' + datadir + ' stop', function (error, result, stderr) {
            console.log(error, result, stderr);
        })
    }

    getSpendables(callback) {
        this.client.listUnspent(function (err, result) {
            console.log(err, result);
            let spendables = Spendable.parseJson(result.result);
            callback(err, spendables);
        })
    }

    /**
     *
     * @param {string} file
     * @param {string} destPath
     * @param callback
     */
    createTorrent(file, destPath, callback) {

        let files = file.split(Constants.FILE_SEPARATOR);
        let name = files[files.length-1];
        let destFile = destPath + name;

        File.cp(file, destFile);

        this.seedFile(destFile, callback);

    }

    /**
     *
     * @param {string} txid
     * @param {string} file
     * @param callback
     */
    createContentTorrent(txid, file, callback) {
        let path = Constants.TORRENT_FOLDER + txid + Constants.FILE_SEPARATOR;
        File.mkpath(path);
        this.createTorrent(file, path, callback);

    }

    /**
     *
     * @param {string} file
     * @param callback
     */
    seedFile(file, callback) {
        this.torrentClient.seed(file, function (torrent) {
            console.log('Seeding ' + destFile + ':', torrent);
            if (callback) {
                callback(torrent);
            }
        })
    }

    /**
     *
     * @param {string} txid
     * @param {string} magnet
     */
    downloadTorrent(txid, magnet) {
        let that = this;
        let path = Constants.TORRENT_FOLDER + txid + Constants.FILE_SEPARATOR;
        File.mkpath(path);

        this.torrentClient.add(magnet, {path: path}, function (torrent) {
            torrent.on('done', function () {
                that.broadcastTorrent(txid, torrent);
            })
        })
    }

    /**
     *
     * @param {string} txid
     * @param torrent
     */
    broadcastTorrent(txid, torrent) {
        let that = this;
        if (this.onTorrentDownloaded) {
            setTimeout(function () {
                that.onTorrentDownloaded(txid, torrent);
            }, 2000);
        }

        setTimeout(function () {
            let path = torrent.path;

            torrent.files.forEach(function (file) {
                that.seedFile(path + file)
            })
        }, 100)
    }

    buildDataOutput(data, callback) {
        Utils.compress(data, COPRESSION_LEVEL, function (compressed, error) {
            compressed = CONTENT.MAGIC_BYTE.toString(16) + compressed.toString('hex');
            if (!error) {
                let ret = creativecoin.script.compile([
                    creativecoin.opcodes.OP_RETURN,
                    compressed
                ]);
                callback(ret);
            } else {
                console.error(error);
            }
        })
    }

    /**
     *
     * @param {string} nick
     * @param {string} email
     * @param {string} web
     * @param {string} description
     * @param {string} avatar
     * @param {string} callback
     */
    register(nick, email, web, description, avatar, callback) {
        let that = this;
        let onBuild = function (txBuilder) {
            let txHex = txBuilder.build().toHex();
        };

        this.client.getNewAddress(function (err, result) {
            let userAddress = result.result;
            that.getSpendables(function (err, spendables) {
                let txBuilder = new creativecoin.TransactionBuilder(NETWORK);
                txBuilder.setLockTime(parseInt(new Date().getTime() / 1000));
                txBuilder.setVersion(TX_CONTENT_VERSION);
                let matchSpendables = Spendable.spendablesFrom(TX_CONTENT_AMOUNT, spendables);
                if (matchSpendables.length > 0) {
                    matchSpendables.forEach(function (spend, index, array) {
                        let txId = Buffer.from(spend.txId, 'hex');
                        let script = Buffer.from(spend.scriptPubKey, 'hex');
                        txBuilder.addInput(txId, spend.index, null, script);
                    });

                    txBuilder.addOutput(userAddress, TX_CONTENT_AMOUNT);

                    that.createTorrent(avatar, Constants.TORRENT_FOLDER + 'user' + Constants.FILE_SEPARATOR, function (torrent) {
                        console.log('Torrent created!', torrent);
                        let userReg = new Author(userAddress, nick, email, web, description, torrent.magnet);
                        let buffUser = userReg.serialize();
                        that.buildDataOutput(buffUser, function (opReturnData) {
                            txBuilder.addOutput(opReturnData, 0);
                            onBuild(txBuilder);
                        });
                    })

                }
            })

        })
    }
}

if (module) {
    module.exports = {Currency, UnknownCurrency, FiatCurrency, CryptoCurrency, Eur, Usd, Mxn, Pln, Btc, Crea, Coin,
        MonetaryFormat, CryptoCoin, EurCoin, BitCoin, CreativeCoin, DollarCoin, PesoCoin, ZlotiCoin, Prices, ErrorCodes,
        OS, File, Constants, Utils, VarInt, ContentData, User: Author, MediaData,Like, Comment, Donation, Following,
        Follow, Unfollow,TxInput, TxOutput, DecodedTransaction, Network, NodeConfiguration, Trantor}
}