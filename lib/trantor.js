
const fs = require('fs');
const os = require('os');
const exec = require('child_process').exec;
const request = require('request');
const lzma = require('lzma');
const bufferReverse = require('buffer-reverse');
const sha256 = require('sha256');
const creativecoin = require('bitcoinjs-lib');
const RpcClient = require('bitcoind-rpc');
const WebTorrent = require('webtorrent');
const sqlite = require('sqlite3');

class CoinUri {

    /**
     *
     * @param {string} address
     * @param {string} amount
     * @param {string} label
     * @param {string} message
     */
    constructor(address, amount, label, message) {
        this.addres = address;
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
            let isDecimal = isNumber && amount % 1 !== 0;

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

const TX_CONTENT_AMOUNT = Coin.parseCash(0.001, 'CREA').amount;
const TX_FEE_KB = Coin.parseCash(405000, 'CREA').amount;
const TX_CURRENT_VERSION = 0x0002;
const TX_CONTENT_VERSION = 0x0008;
const TX_DEFAULT_VERSION = TX_CURRENT_VERSION | TX_CONTENT_VERSION;
const COPRESSION_LEVEL = 9;

const PUBLICATION = {};

PUBLICATION.START_BLOCK = 17000;
PUBLICATION.MAGIC_BYTE = 0xB8; //Start flag to read content
PUBLICATION.VERSION = 0x0000; //Content version
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
    OTHER: 0x09,
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

    static getFilenameVersion() {
        if (OS.isLinux()) {
            return OS.is64Bits() ? 'linux64' : 'linux32'
        } else if (OS.isWindows()) {
            return OS.is64Bits() ? 'win64.exe' : 'win32.exe'
        } else if (OS.isMac()) {
            return 'osx.dmg'
        }

        throw ErrorCodes.INVALID_PLATFORM;
    }

    static getExecutableExtension() {
        if (OS.isLinux()) {
            return '';
        } else if (OS.isWindows()) {
            return '.exe'
        } else if (OS.isMac()) {
            return '.dmg'
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
Constants.BIN_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'bin' + Constants.FILE_SEPARATOR;
Constants.LANG_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'assets' + Constants.FILE_SEPARATOR + 'lang' + Constants.FILE_SEPARATOR;
Constants.TORRENT_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'torrents' + Constants.FILE_SEPARATOR;
Constants.STORAGE_FILE = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'app.conf';
Constants.BINARIES_URL = 'https://binaries.creativechain.net/latest/';
Constants.DAEMON_URL = Constants.BINARIES_URL + 'creativecoind-';
Constants.CLIENT_URL = Constants.BINARIES_URL + 'creativecoin-cli-';
Constants.BINARY_NAME = 'creativecoind' + OS.getExecutableExtension();
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
    constructor(storage) {
        this.storage = storage ? storage : {};
    }


    /**
     *
     * @param {string} key
     * @return {boolean}
     */
    hasKey(key) {
        return !!this.storage[key];
    }

    /**
     *
     * @param {string} key
     * @return {*}
     */
    getKey(key) {
        return this.storage[key];
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
        let content = JSON.stringify(this.storage);
        File.write(Constants.STORAGE_FILE, content);
    }

    /**
     *
     * @return {FileStorage}
     */
    static load() {
        if (File.exist(Constants.STORAGE_FILE)) {
            let content = File.read(Constants.STORAGE_FILE);
            content = JSON.parse(content);
            return new FileStorage(content);
        }

        return new FileStorage();
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
    constructor(version = PUBLICATION.VERSION, type) {
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
     *
     * @param {number} number
     * @param {number} bytes
     * @return {string}
     */
    static serializeNumber(number, bytes) {
        let numberHex = number.toString(16);

        let leadingZeros = (bytes * 2) - numberHex.length;

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
        if (text) {
            let textHex = Utils.stringToHex(text);
            let textBuffer = Buffer.from(textHex, 'hex');
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
            offset: varInt.value
        }
    }

    /**
     *
     * @param {Buffer} data
     * @param {boolean} commpressed
     * @return {ContentData}
     */
    static deserializeData(data, commpressed = true) {
        let buffer = data;
        if (commpressed) {
            let buffer = Utils.decompress(data);
        }

        let type = parseInt(buffer.slice(2, 3).toString('hex'), 16);

        switch (type) {
            case PUBLICATION.TYPE.CONTENT:
                return new MediaData().deserialize(buffer, 0);
            case PUBLICATION.TYPE.USER:
                return new Author().deserialize(buffer, 0);
            case PUBLICATION.TYPE.LIKE:
                return new Like().deserialize(buffer, 0);
            case PUBLICATION.TYPE.COMMENT:
                return new Comment().deserialize(buffer, 0);
            case PUBLICATION.TYPE.DONATION:
                return new Donation().deserialize(buffer, 0);
            case PUBLICATION.TYPE.FOLLOW:
                return new Follow().deserialize(buffer, 0);
            case PUBLICATION.TYPE.UNFOLLOW:
                return new Unfollow().deserialize(buffer, 0);
            case PUBLICATION.TYPE.INDEX:
                return new Index().deserialize(buffer, 0);
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
        let bufferHex = ContentData.serializeNumber(this.version, 2);
        bufferHex += ContentData.serializeNumber(this.type, 1);

        let txVarInt = new VarInt(this.txIds.length);
        bufferHex += txVarInt.encode();

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

        let varInt = new VarInt(buffer, offset);
        offset += varInt.size();

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
        let bufferHex = ContentData.serializeNumber(this.version, 2);
        bufferHex += ContentData.serializeNumber(this.type, 1);
        bufferHex += this.address;

        bufferHex += ContentData.serializeText(this.nick, PUBLICATION.LIMIT.NICK);
        bufferHex += ContentData.serializeText(this.email, PUBLICATION.LIMIT.MAIL);
        bufferHex += ContentData.serializeText(this.web, PUBLICATION.LIMIT.WEB);
        bufferHex += ContentData.serializeText(this.description, PUBLICATION.LIMIT.USER_DESCRIPTION);
        bufferHex += ContentData.serializeText(this.avatar);
        let tags = JSON.stringify(this.tags);
        bufferHex += ContentData.serializeText(tags);
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
        let bufferHex = ContentData.serializeNumber(this.version, 2);
        bufferHex += ContentData.serializeNumber(this.type, 1);
        bufferHex += this.userAddress;
        bufferHex += this.contentAddress;
        bufferHex += ContentData.serializeNumber(this.license, 1);
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
        offset += 20;

        this.contentAddress = buffer.slice(offset, offset + 20);
        offset += 20;

        this.license = buffer.readInt8(offset);
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

        this.price = buffer.slice(offset, offset + 8);
        offset += 8;

        let publicContent = ContentData.deserializeText(buffer, offset);
        this.contentType = publicContent.text;
        offset += publicContent.offset;

        let privateContent = ContentData.deserializeText(buffer, offset);
        this.privateContent = privateContent.text;
        offset += privateContent.offset;

        return offset;
    }
}

class Like extends ContentData {
    constructor(address, contentId) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.LIKE);
        this.address = address;
        this.contentId = contentId;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version, 2);
        bufferHex += ContentData.serializeNumber(this.type, 1);
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
        this.address = buffer.slice(offset, offset + 20).toString('hex');
        offset += 20;
        this.contentId = buffer.slice(offset, offset + 32).toString('hex');
        offset += 32;
        return offset;
    }
}

class Comment extends ContentData {
    /**
     *
     * @param {string} address
     * @param {string} contentId
     * @param {string} comment
     */
    constructor(address, contentId, comment) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.COMMENT);
        this.address = address;
        this.contentId = contentId;
        this.description = comment;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version, 2);
        bufferHex += ContentData.serializeNumber(this.type, 1);
        bufferHex += this.address;
        bufferHex += this.contentId;
        bufferHex += ContentData.serializeText(this.description, PUBLICATION.LIMIT.COMMENT);
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
        this.description = buffer.slice(offset, offset + varInt.value).toString('utf8');
        offset += varInt.value;
        return offset;
    }
}

class Donation extends ContentData {
    /**
     *
     * @param {string} address
     */
    constructor(address) {
        super(PUBLICATION.VERSION, PUBLICATION.TYPE.DONATION);
        this.address = address;
    }

    /**
     *
     * @returns {Buffer}
     */
    serialize() {
        let bufferHex = ContentData.serializeNumber(this.version, 2);
        bufferHex += ContentData.serializeNumber(this.type, 1);
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
        let bufferHex = ContentData.serializeNumber(this.version, 2);
        bufferHex += ContentData.serializeNumber(this.type, 1);
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
        let data = this.getData();
        return data !== null;
    }

    /**
     *
     * @return {boolean}
     */
    hasRawData() {
        let scriptBuffer = this.getBufferedScript();
        let scriptHex = scriptBuffer.toString('hex').toLowerCase();

        return scriptHex.startsWith('6a4d7201' + ContentData.serializeNumber(PUBLICATION.MAGIC_BYTE, 1));
    }

    /**
     *
     * @return {Buffer}
     */
    getRawData() {
        let scriptBuffer = this.getBufferedScript();
        let scriptHex = scriptBuffer.toString('hex').toLowerCase();

        if (this.hasRawData()) {
            let compressData = scriptBuffer.slice(5, scriptBuffer.length-1);
            return Utils.decompress(compressData);
        }

        return null;
    }

    /**
     *
     * @return {ContentData}
     */
    getData() {
        let scriptBuffer = this.getBufferedScript();
        let scriptHex = scriptBuffer.toString('hex').toLowerCase();

        if (scriptHex.startsWith('6a4d7201' + ContentData.serializeNumber(PUBLICATION.MAGIC_BYTE, 1))) {
            let compressData = scriptBuffer.slice(5, scriptBuffer.length-1);
            return ContentData.deserializeData(compressData);
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
                    added = true;
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
    }

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
        let data = this.getData();
        return data !== null;
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
            console.log('Database initialized', err);
        });
    }

    /**
     *
     * @param {string} query
     * @param callback
     */
    query(query, callback) {
        console.log('Executing', query);
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
        let insertUser = this.database.prepare('INSERT INTO Author VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        insertUser.run(tx.hash, user.version, date, user.nick, user.address, user.email, user.web, user.description, user.avatar, callback);
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
            " FROM 'Comment' c WHERE c.author = '" + address + "') AS comments, (SELECT count(*) FROM 'Following' f WHERE f.type = 5 AND f.followed_address = '" + address +
            "') AS followers From Author a WHERE a.address = '" + address + "'", callback);
    }


    /**
     *
     * @param torrent
     * @param {string} file
     * @param callback
     */
    addTorrent(torrent, file, callback) {
        let insertTorrent = this.database.prepare('INSERT INTO Torrent VALUES (?, ?, ?)');
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
        let insertCallback = this.database.prepare('INSERT INTO Comment VALUES (?, ?, ?, ?, ?, ?)');
        insertCallback.run(tx.hash, comment.version, comment.address, comment.contentId, comment.description, date, function (err) {
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
    getComments(contentId, callback) {
        this.query('SELECT * FROM Comment WHERE content_id = ' + contentId, callback);
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
        let insertFollowing = this.database.prepare('INSERT INTO Following VALUES (?, ?, ?, ?, ?, ?)');
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
        this.query('SELECT * FROM Following WHERE followed_address = ' + userAddress + ' AND type = ' + PUBLICATION.TYPE.FOLLOW, callback);
    }

    /**
     *
     * @param {string} userAddress
     * @param callback
     */
    getUsersFollowing(userAddress, callback) {
        this.query('SELECT * FROM Following WHERE follower_address = ' + userAddress + ' AND type = ' + PUBLICATION.TYPE.FOLLOW, callback);
    }

    /**
     *
     * @param {Like} like
     * @param {DecodedTransaction} tx
     * @param callback
     */
    addLike(like, tx, callback) {
        let insertLike = this.database.prepare('INSERT INTO Like VALUES (?, ?, ?, ?)');
        insertLike.run(tx.hash, like.version, like.address, like.contentId, function (err) {
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
        let insertMedia = this.database.prepare('INSERT INTO Media VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        insertMedia.run(tx.hash, media.version, date, media.userAddress, media.contentAddress, media.type, media.title, media.description, media.tags, media, media.price, media.publicContent, media.privateContent, function (err) {
            if (callback) {
                callback(err);
            }
        });
    }

    /**
     *
     * @param callback
     */
    getAllMedia(callback) {
        this.query("SELECT m.*, (SELECT count(*) FROM 'Like' l WHERE m.txid = l.content_id) AS likes,  " +
            "(SELECT count(*) FROM Comment c WHERE m.txid = c.content_id) AS comments FROM Media m ORDER BY m.creation_date DESC;", callback)
    }

    /**
     *
     * @param {string} contentId
     * @param callback
     */
    getMediaByContentId(contentId, callback) {
        this.query("SELECT m.*, (SELECT count(*) FROM 'Like' l WHERE m.txid = l.content_id) AS likes,  " +
            "(SELECT count(*) FROM Comment c WHERE m.txid = c.content_id) AS comments FROM Media m WHERE m.txid = '" + contentId + "';", callback)
    }

    /**
     *
     * @param {string} address
     * @param callback
     */
    getMediaByAddress(address, callback) {
        this.query("SELECT m.*, (SELECT count(*) FROM 'Like' l WHERE m.txid = l.content_id) AS likes,  " +
            "(SELECT count(*) FROM Comment c WHERE m.txid = c.content_id) AS comments FROM Media m WHERE m.address = '" + address + "';", callback)
    }

    /**
     *
     * @param {Array} tags
     * @param callback
     */
    getMediaByTags(tags, callback) {

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
        let insertContact = this.database.prepare('INSERT INTO AddressBook VALUES (?, ?)');
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
        let insertContact = this.database.prepare('INSERT INTO PaymentRequest VALUES (?, ?, ?, ?, ?)');
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
     * @param {string} magnet
     * @param {string} file
     * @param callback
     */
    insertTorrent(hash, magnet, file, callback) {
        let insertTorrent = this.database.prepare('INSERT INTO Torrent VALUES (?, ?, ?)');
        insertTorrent.run(hash, magnet, file, callback);
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

}


class Trantor {
    constructor(network = NETWORK) {
        this.network = network;
        this.client = null;
        this.torrentClient = new WebTorrent();
        this.database = null;
        this.events = {};
    }

    throwError(error) {
        if (this.events.onError) {
            this.events.onError(error);
        }
    }

    checkBinariesExists(callback) {
        let binPlatform = OS.getFilenameVersion();
        let binaryName = Constants.BINARY_NAME;
        let count = 1;
        let onFinish = function () {
            count--;
            if (count === 0 && callback) {
                File.chmod(Constants.BIN_FOLDER + binaryName, 755);
                callback(true);
            }
        };

        if (!File.exist(Constants.BIN_FOLDER + 'creativecoind')) {
            File.download(Constants.DAEMON_URL + binPlatform, Constants.BIN_FOLDER + binaryName , function (progress) {
                console.log('Downloading daemon', progress + '%')
            }, function () {
                setTimeout(function () {
                    onFinish();
                }, 500);
            })
        } else {
            onFinish();
        }
    }

    prepareConfiguration() {
        let config = NodeConfiguration.loadFrom(Constants.BIN_FOLDER + '/creativecoin.conf');

        config.setIfNotExist('rpcuser', 'creativecoin');
        config.setIfNotExist('rpcpassword', Utils.randomString(9));
        config.setIfNotExist('rpcworkqueue', 2000);
        config.setIfNotExist('port', Utils.randomNumber(20000, 65535));
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

        OS.run(Constants.BIN_FOLDER + Constants.BINARY_NAME + ' -datadir=' + Constants.BIN_FOLDER, function (result, stderr) {
            console.log('Starting platform:', result, stderr);
            callCallback();
        });

        this.database = new Storage(Constants.DATABASE_FILE);
        this.database.init();
        callCallback();
    }

    explore(startBlock = 0) {
        let that = this;

        let onStart = function () {
            if (that.events.onExploreStart) {
                that.events.onExploreStart(startBlock);
            }

            that.client.getBlockCount(function (err, result) {

                if (!err) {
                    let blockCount = parseInt(result.result);

                    let broadcastProgress = function (progress) {
                        if (that.events.onExploreProgress) {
                            setTimeout(function () {
                                that.events.onExploreProgress(blockCount, progress);
                            }, 100);
                        }
                    };

                    let processBlock = function (blockHeight) {
                        that.client.getBlockHash(blockHeight, function (err, blockHash) {
                            if (!err) {
                                blockHash = blockHash.result;

                                that.client.getBlock(blockHash, function (err, block) {
                                    block = block.result;
                                    //console.log(block);
                                    let blockTime = block.time * 1000;
                                    let txIds = block.tx;

                                    let count = 0;
                                    let readingIndex = false;
                                    let onReadTx = function () {
                                        if (count === txIds.length && !readingIndex) {
                                            broadcastProgress(blockHeight);
                                            localStorage.setItem('lastExploredBlock', blockHeight);
                                            setTimeout(function () {
                                                processBlock(++blockHeight);
                                            }, 10)

                                        }
                                    };

                                    //console.log(txIds);
                                    txIds.forEach(function (txHash) {

                                        //console.log(txHash);
                                        that.getRawTransaction(txHash, function (err, rawTx) {
                                            //console.log(err, rawTx);
                                            rawTx = rawTx.result;
                                            let tx = DecodedTransaction.fromHex(rawTx);
                                            if (tx.containsData()) {

                                                let broadcastData = function (data) {
                                                    if (that.events.onDataFound) {
                                                        that.events.onDataFound(tx, data, blockTime);
                                                    }
                                                };
                                                let data = tx.getData();
                                                if (data.type === PUBLICATION.TYPE.INDEX) {
                                                    //If the data is an index, the data of the transactions of the index must be recovered.
                                                    readingIndex = true;
                                                    let index = new Index();
                                                    let hexData = '';
                                                    index.deserialize(data.serialize(), 0);
                                                    let indexTtxIds = index.txIds;
                                                    let count = 0;

                                                    let onRaw = function () {
                                                        if (count === indexTtxIds.length) {
                                                            let newData = ContentData.deserializeData(Buffer.from(hexData, 'hex'), false);
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
                                                            count++;
                                                            onRaw();
                                                        })
                                                    })
                                                } else {
                                                    broadcastData(data);
                                                }

                                            } else {
                                                count++;
                                            }

                                            onReadTx();
                                        })

                                    })
                                })
                            } else if (blockHeight >= blockCount) {
                                //Exploration finish
                                localStorage.setItem('lastExploredBlock', blockCount);
                                that.events.onExploreFinish(blockCount);
                            } else {
                                //BlockHash not found or core refused call, try again
                                console.error(err);
                                setTimeout(function () {
                                    processBlock(blockHeight);
                                }, 1000)
                            }

                        })
                    };
                    processBlock(startBlock);
                } else {
                    console.error(err);
                    setTimeout(function () {
                        onStart();
                    }, 60 * 1000);
                }
            });
        };
        setTimeout(function () {
            onStart();
        }, 100)
    }

    start(callback) {
        let that = this;
        this.checkBinariesExists(function (exists) {
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
        console.log('Closing platform');
        system.run('creativecoin-cli -datadir=' + datadir + ' stop', function (error, result, stderr) {
            console.log(error, result, stderr);
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
     * @param {string} file
     * @param {string} destPath
     * @param callback
     */
    createTorrent(file, destPath, callback) {
        console.log(file, destPath);
        let that = this;
        if (!File.exist(destPath)) {
            File.mkpath(destPath);
        }
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
        let that = this;
        this.torrentClient.seed(file, function (torrent) {
            console.log('Seeding', file, torrent);
            let tHash = Utils.makeHash(torrent.magnetURI);
            that.database.insertTorrent(tHash, torrent.magnetURI, file);

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
        if (this.events.onTorrentDownloaded) {
            setTimeout(function () {
                that.events.onTorrentDownloaded(txid, torrent);
            }, 2000);
        }

        setTimeout(function () {
            that.seedFile(torrent.files)
        }, 100)
    }

    buildDataOutput(data, callback) {
        Utils.compress(data, COPRESSION_LEVEL, function (compressed, error) {
            compressed = ContentData.serializeNumber(PUBLICATION.MAGIC_BYTE, 1) + compressed.toString('hex');
            compressed = Buffer.from(compressed, 'hex');
            if (!error) {
                console.log('Final data:', compressed.length, compressed.toString('hex'));
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
            console.log('Broadcast', err, result);
            that.broadcastOnAfterTransactionSend(DecodedTransaction.fromHex(rawTx));
            if (callback) {
                callback(err, result);
            }
        })
    }

    /**
     *
     * @param {TransactionBuilder} txBuilder
     * @param spendables
     */
    broadcastOnBeforeTransactionSend(txBuilder, spendables) {
        if (this.events.onBeforeTransactionSend) {
            let that = this;
            setTimeout(function () {
                that.events.onBeforeTransactionSend(txBuilder, spendables);
            }, 10);
        }
    }

    /**
     *
     * @param {DecodedTransaction} tx
     */
    broadcastOnAfterTransactionSend(tx) {
        if (this.events.onAfterTransactionSend) {
            let that = this;
            setTimeout(function () {
                that.events.onAfterTransactionSend(tx);
            }, 10);
        }
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
        console.log('Spendables', spendables);

        let privKeys = [];

        let signTx = function () {
            console.log(privKeys);

            for (let x = 0; x < privKeys.length; x++) {
                let pk = privKeys[x];
                privKeys[x] = creativecoin.ECPair.fromWIF(pk, NETWORK);
                txBuilder.sign(x, privKeys[x]);
            }

            let txHex = txBuilder.build().toHex();
            console.log(txHex);
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
     * @param {Buffer} data
     * @param {string} address
     * @param {number} amount
     * @param callback
     */
    createDataTransaction(data, address, amount, callback) {
        amount = amount ? amount : TX_CONTENT_AMOUNT;
        let that = this;
        let onBuild = function (txBuilder, spendables) {
            that.broadcastOnBeforeTransactionSend(txBuilder, spendables);
        };

        this.getSpendables(function (err, spendables) {
            that.buildDataOutput(data, function (opReturnData) {
                let dataSize = opReturnData.length;

                if (spendables.length > 0) {
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
                        console.log('Fee: ', txBuilder.size() + ' at ' + Coin.parseCash(txBuilder.feePerKb, 'CREA').toString() + '/Kb = ' + Coin.parseCash(fee, 'CREA').toString());

                        onBuild(creaBuilder, txBuilder.inputs);
                    }
                }
            });
        })
    }

    /**
     *
     * @param {string} nick
     * @param {string} email
     * @param {string} web
     * @param {string} description
     * @param {string} avatar
     * @param {Array} tags
     * @param {string} callback
     */
    register(nick, email, web, description, avatar, tags, callback) {
        let that = this;

        setTimeout(function () {
            let userAddress = localStorage.getItem('userAddress');
            let addressHash = creativecoin.address.fromBase58Check(userAddress).hash.toString('hex');
            console.log(addressHash);
            let destPath = Constants.TORRENT_FOLDER + 'user' + Constants.FILE_SEPARATOR;
            that.createTorrent(avatar, destPath, function (torrent) {
                console.log('Author Torrent created!', torrent);
                let userReg = new Author(addressHash, nick, email, web, description, torrent.magnetURI, tags);
                let buffUser = userReg.serialize();
                that.createDataTransaction(buffUser, userAddress, null, function (rawTx) {
                    let txBuffer = Buffer.from(rawTx, 'hex');
                    let tx = creativecoin.Transaction.fromBuffer(txBuffer);
                    console.log(tx.getId(), txBuffer.length, txBuffer.toString('hex'));
                    //that.sendRawTransaction();
                });
            });
        }, 10)
    }

    broadcastOnBeforePublish(post, rawTx) {
        if (this.events.onBeforePublish) {
            let that = this;
            setTimeout(function () {
                that.events.onBeforePublish(post, rawTx);
            }, 10)
        }
    }

    /**
     *
     * @param {string} title
     * @param {string} description
     * @param {string} contentType
     * @param {number} contentType
     * @param {number} license
     * @param {Array} tags
     * @param {string} publicFile
     * @param {string} privateFile
     * @param {number} price
     * @param callback
     */
    publish(title, description, contentType, license, tags, publicFile, privateFile, price, callback) {
        let that = this;

        setTimeout(function () {
            that.getNewAddress(function (err, result) {
                let publishAddress = result.result;
                let userAddress = localStorage.getItem('userAddress');
                let publishAddressHash = creativecoin.address.fromBase58Check(publishAddress).hash.toString('hex');
                let userAddressHash = creativecoin.address.fromBase58Check(userAddress).hash.toString('hex');
                let pubTorrent, prvTorrent;
                let tasks = 2;
                let makeTx = function () {
                    tasks--;

                    if (tasks === 0) {
                        let mediaPost = new MediaData(title, description, contentType, license, userAddressHash,
                            publishAddressHash, tags, price, pubTorrent.magnetURI, prvTorrent.magnetURI);

                        let postBuffer = mediaPost.serialize();
                        that.createDataTransaction(postBuffer, publishAddress, null, function (rawTx) {
                            that.broadcastOnBeforePublish(mediaPost, rawTx);
                        })
                    }

                };

                if (publicFile) {
                    let destPublicPath = Constants.TORRENT_FOLDER + publishAddressHash + Constants.FILE_SEPARATOR;
                    that.createTorrent(publicFile, destPublicPath, function (publicTorrent) {
                        console.log('Public Torrent created!', publicTorrent);
                        pubTorrent = publicTorrent;
                        makeTx();
                    })
                }

                if (privateFile) {
                    let destPrivatePath = Constants.TORRENT_FOLDER + publishAddressHash + '-p' + Constants.FILE_SEPARATOR;
                    that.createTorrent(privateFile, destPrivatePath, function (privateTorrent) {
                        console.log('Private Torrent created!', privateTorrent);
                        prvTorrent = privateTorrent;
                        makeTx()
                    })
                }

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
    search(tags, callback) {
        this.database.getMediaByTags(tags, callback);
    }
}

class Notifications {

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

if (module) {
    module.exports = {CoinUri, Currency, UnknownCurrency, FiatCurrency, CryptoCurrency, Eur, Usd, Mxn, Pln, Btc, Crea, Coin,
        MonetaryFormat, CryptoCoin, EurCoin, BitCoin, CreativeCoin, DollarCoin, PesoCoin, ZlotiCoin, Prices, ErrorCodes,
        OS, File, Constants, FileStorage, Utils, VarInt, ContentData, Author, MediaData,Like, Comment, Donation, Following,
        Follow, Unfollow,TxInput, TxOutput, DecodedTransaction, Network, NodeConfiguration, Trantor, Notifications}
}