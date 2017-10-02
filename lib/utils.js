
const {app, ipcMain} = require('electron');

const fs = require('fs');
const os = require('os');
const exec = require('child_process').exec;
const request = require('request');

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
            if (callback != null) {
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
Constants.TORRENT_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'torrents';
Constants.STORAGE_FILE = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'app.conf';
Constants.CORE_PATH = Constants.BIN_FOLDER + Constants.FILE_SEPARATOR + OS.getCoreBinaryName();
Constants.CLIENT_PATH = Constants.BIN_FOLDER + Constants.FILE_SEPARATOR + OS.getClientBinaryName();
Constants.BINARIES_URL = 'https://binaries.creativechain.net/stable/';
Constants.DATABASE_PATH = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'index.db';
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
}

if (module) {
    module.exports = {ErrorCodes, OS, File, Constants, Utils};
}
