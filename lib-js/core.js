/**
 * Created by ander on 22/06/17.
 */
const {app, ipcMain} = require('electron');

const sqlite = require('sqlite3').verbose();
const request = require('request');
const fs = require('fs');
const exec = require('child_process').exec;
const {download} = require('electron-dl');
const CreaClient = require('bitcoind-rpc');

class ErrorCodes {}
ErrorCodes.INVALID_PLATFORM = 'INVALID_PLATFORM';

class OS {

    static isLinux() {
        return window.navigator.platform.toLowerCase().includes('linux');
    };

    static isWindows() {
        return window.navigator.platform.toLowerCase().includes('win');
    };

    static isMac() {
        return window.navigator.platform.toLowerCase().includes('mac');
    }

    static is64Bits() {
        return window.navigator.platform.toLowerCase().includes('64');
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

Constants.FILE_SEPARATOR = OS.getPathSeparator();
Constants.APP_FOLDER = '.';
Constants.BIN_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'bin';
Constants.TORRENT_FOLDER = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'torrents';
Constants.STORAGE_FILE = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'app.conf';
Constants.CORE_PATH = Constants.BIN_FOLDER + Constants.FILE_SEPARATOR + OS.getCoreBinaryName();
Constants.CLIENT_PATH = Constants.BIN_FOLDER + Constants.FILE_SEPARATOR + OS.getClientBinaryName();
Constants.BINARIES_URL = 'https://binaries.creativechain.net/stable/';
Constants.DATABASE_PATH = Constants.APP_FOLDER + Constants.FILE_SEPARATOR + 'index.db';

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
     */
    static mkpath(path) {
        let dirs = path.split(Constants.FILE_SEPARATOR);
        let route = '';
        for (let x = 0; x < dirs.length; x++) {
            route += dirs[x] + Constants.FILE_SEPARATOR;
            File.mkdir(route);
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

class FileStorage {

    /**
     *
     * @returns {Object}
     */
    static load() {
        try {
            let content = File.read(Constants.STORAGE_FILE);
            if (content != undefined && content != null && content != '') {
                return JSON.parse(content);
            }
        } catch (err) {
            console.log('app conf not exist', err);
        }
        return {};
    }

    static save(conf) {
        //console.log('Saving conf', conf);
        File.write(Constants.STORAGE_FILE, JSON.stringify(conf));
    }

    /**
     *
     * @param {string} key
     * @param value
     */
    static setItem(key, value) {
        let conf = FileStorage.load();
        conf[key] = value;
        FileStorage.save(conf);
    }

    /**
     *
     * @param key
     * @returns {*}
     */
    static getItem(key, defaultValue) {
        let conf = FileStorage.load();
        if (conf[key] == undefined || conf[key] == null) {
            return defaultValue;
        }
        return conf[key];
    }
}

class Preferences {

    /**
     * @returns {boolean}
     */
    static isFirstUseExecuted() {
        return FileStorage.getItem('first_use', true);
    }

    /**
     *
     * @param {boolean} firstUse
     */
    static setFirstUseExecuted(firstUse) {
        FileStorage.setItem('first_use', firstUse);
    }

    static isNodeCorrectlyRunning() {
        return FileStorage.getItem('node_running');
    }

    static setNodeCorrectlyRunning(running) {
        FileStorage.setItem('node_running', running);
    }

    static setConfigurationPath(path) {
        FileStorage.setItem('conf_dir', path);
    }

    static getConfigurationPath() {
        return FileStorage.getItem('conf_dir');
    }

}


class Configuration {
    constructor(rpcuser = 'creativecoin', rpcpassword = Utils.randomString(9)) {
        this.rpcuser = rpcuser;
        this.rpcpassword = rpcpassword;
        this.rpcworkqueue = 2000;
        this.txindex = true;
    }

    getRpcUser()  {
        return this.rpcuser;
    }

    getRpcPassword() {
        return this.rpcpassword;
    }

    getRpcWorkQueue() {
        if (this.rpcworkqueue < 2000) {
            return 2000;
        }

        return this.rpcworkqueue;
    }

    setRpcUser(user) {
        this.rpcuser = user;
    }

    setRpcPassword(password) {
        this.rpcpassword = password;
    }

    setTxIndexing(indexing) {
        this.txindex = indexing;
    }

    setRpcWorkQueue(queuelength){
        this.rpcworkqueue = queuelength;
    }

    save(file) {

        let contentAdd = function (shouldAdd, content, toAdd) {
            if (shouldAdd) {
                content = content + '\n' + toAdd;
            }

            return content;
        };

        let content = fs.readFileSync(file, 'utf8');
        let lines = content.split('\n');
        let hasUser = false;
        let hasPassword = false;
        let hasTxIndex = false;
        let hasRpcWorkqueue = false;
        for (let x = 0; x < lines.length; x++) {
            let l = lines[x];
            let vals = l.split('=');
            switch (vals[0]) {
                case 'rpcuser':
                    hasUser = true;
                    break;
                case 'rpcpassword':
                    hasPassword =true;
                    break;
                case 'txindex':
                    content = content.replace(l, 'txindex=' + 1);
                    hasTxIndex = true;
                    break;
                case 'rpcworkqueue':
                    content = content.replace(l, 'rpcworkqueue=' + this.getRpcWorkQueue());
                    hasRpcWorkqueue = true;
                    break;
            }
        }

        content = contentAdd(!hasUser, content, 'rpcuser=' + this.getRpcUser());
        content = contentAdd(!hasPassword, content, 'rpcpassword=' + this.getRpcPassword());
        content = contentAdd(!hasTxIndex, content, 'txindex=1');
        content = contentAdd(!hasRpcWorkqueue, content, 'rpcworkqueue=' + this.getRpcWorkQueue());
        //console.log('Before save: ', content);
        File.write(file, content);
    }

    static buildFromFile(file) {

        //console.log('Reading ' + file);
        let content = File.read(file);
        let lines = content.split('\n');
        let conf = new Configuration();

        for (let x = 0; x < lines.length; x++) {
            let l = lines[x];
            let vals = l.split('=');

            switch (vals[0]) {
                case 'rpcuser':
                    conf.setRpcUser(vals[1]);
                    break;
                case 'rpcpassword':
                    conf.setRpcPassword(vals[1]);
                    break;
                case 'txindex':
                    conf.setTxIndexing(vals[1] == '1');
                    break;
                case 'rpcworkqueue':
                    let queue = parseInt(vals[1]);
                    conf.setRpcWorkQueue(queue);
                    break;

            }
        }

        conf.save(file);
        return conf;

    }
}

class Creativecoin {
    constructor () {
        this.configuration = new Configuration();
        this.coreFolder = '';
        this.connection = null;
    }

    init(callback) {
        let that = this;
        let onStopped = function () {
            console.log('Core is stopped');
            that.createConfigurationFile();
            callback();
        };

        function checkRunning() {
            File.chmod(Constants.CORE_PATH, 755);
            File.chmod(Constants.CLIENT_PATH, 755);

            Creativecoin.isCoreRunning(function (running) {
                if (running) {
                    that.stop(function () {
                        console.log('creativecoin node stopped!');
                        onStopped();
                    })
                } else {
                    onStopped();
                }
            });
        }

        console.log('Binaries exists: ' + Constants.CORE_PATH + ': ' + File.exist(Constants.CORE_PATH) + ', ' + Constants.CLIENT_PATH + ':' + File.exist(Constants.CLIENT_PATH));
        if (File.exist(Constants.CORE_PATH) && File.exist(Constants.CLIENT_PATH)) {
            checkRunning();
        } else {
            File.mkpath(Constants.BIN_FOLDER);

            let coreDownloader = function () {
                File.download(Constants.BINARIES_URL + OS.getCoreBinaryName(), Constants.CORE_PATH, function () {
                    console.log('Core binary downloaded');
                    checkRunning();
                })
            };
            File.download(Constants.BINARIES_URL + OS.getClientBinaryName(), Constants.CLIENT_PATH, function () {
                console.log('Client binary downloaded');
                coreDownloader();
            })
        }

    };

    call(opts, callback) {
        this.createConnection();
        this.connection.call(opts, callback);
    }

    createConnection() {
        if (!this.connection) {
            this.configuration = Configuration.buildFromFile(this.getConfigurationPath());

            let conConfig = {
                protocol: 'http',
                user: this.configuration.getRpcUser(),
                pass: this.configuration.getRpcPassword(),
                host: '127.0.0.1',
                port: '17711'
            };
            //console.log('RPCConfig', that.configuration, conConfig);
            this.connection = new CreaClient(conConfig);
        }

    }

    createConfigurationFile() {
        let that = this;

        let onExists = function () {
            //FOLDER OF NODE EXIST

            that.createConnection();
            setTimeout(function () {
                that.start(function (result) {
                    Preferences.setNodeCorrectlyRunning(true);
                    console.log('Node started!');
                });
            }, 3000);
        };

        let pathCommand = '';
        if (OS.isLinux()) {
            pathCommand = 'echo $HOME/.creativecoin/';
        } else if (OS.isWindows()) {
            pathCommand = 'echo %appdata%\\creativecoin\\';
        } else if (OS.isMac()) {
            pathCommand = 'echo Users/$USER/Library/Application Support/creativecoin/'
        }

        OS.run(pathCommand, function (result, stderr) {
            if (stderr != null) {
                console.log('ErrorCodes getting core folder: ' + result, stderr);
            } else {
                let coreFolder = result.replace('\n', '');
                Preferences.setConfigurationPath(coreFolder);
                if (File.exist(coreFolder)) {
                    onExists();
                } else {
                    fs.mkdirSync(coreFolder);
                    onExists();
                }
            }
        });


    }

    /**
     *
     * @returns {string}
     */
    getCoreFolder() {
        return this.coreFolder;
    };

    /**
     *
     * @returns {*}
     */
    getConfigurationPath() {
        return Preferences.getConfigurationPath() + 'creativecoin.conf';
    }

    /**
     *
     * @param callback
     */
    start(callback) {
        console.log('starting node...');
        let startCommand = Constants.CORE_PATH + ' -daemon -txindex' + (Preferences.isFirstUseExecuted() ? ' -reindex-chainstate' : '');

        OS.run(startCommand, callback);

    };

    /**
     *
     * @param callback
     */
    stop(callback) {
        let stopCommand = Constants.CLIENT_PATH + ' stop';
        OS.run(stopCommand, callback);
    };

    /**
     *
     * @param callback
     */
    static isCoreRunning(callback) {
        if (OS.isLinux()) {
            OS.run('ps -aux | grep creativecoind', function (result, stderr) {
                if (stderr != null) {
                    callback(false);
                } else {
                    let lines = result.split('\n');
                    let value = null;
                    for (let x = 0; x < lines.length; x++) {
                        if (lines[x] != null && lines[x].length > 0 && !lines[x].includes('ps') && !lines[x].includes('grep')) {
                            value = lines[x];
                            console.log('Core is running: ' + lines[x]);
                            break;
                        }
                    }

                    callback(value != null);
                }
            });
        } else if (OS.isWindows()) {
            OS.run('tasklist', function (result, stderr) {
                if (stderr != null) {
                    callback(false);
                } else {
                    console.log(result);
                }
            });
        } else if (OS.isMac()) {

        } else {
            throw window.navigator.platform +  'is no supported';
        }
    };

    static stopNode(callback) {
        let crea = new Creativecoin();
        crea.isCoreRunning(function (running) {
            if (running) {
                crea.stop(function (result) {
                    callback(result);
                })
            } else {
                callback('stopped');
            }
        })
    }
}


class DB {
    constructor(dbPath) {
        this.db = new sqlite.Database(dbPath);
    }

    init() {
        this.db.run('CREATE TABLE IF NOT EXISTS "wordToReference" ' +
            '(`wordHash` varchar(255) NOT NULL,`ref` varchar(255) NOT NULL, `blockDate`	timestamp NOT NULL, ' +
            '`order`	integer NOT NULL, PRIMARY KEY(`wordHash`,`ref`,`blockDate`,`order`));');

        this.db.run('CREATE TABLE IF NOT EXISTS `wordPoints` (`wordHash` varchar(255) NOT NULL, `points` integer NOT NULL);');

        this.db.run('CREATE TABLE IF NOT EXISTS `transactionToReference` (`ref` varchar(255) NOT NULL, `transaction` varchar(255) NOT NULL, ' +
            '`date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);');

        this.db.run('CREATE TABLE IF NOT EXISTS `phptracker_torrents` (`info_hash` binary(20) NOT NULL, `length` integer NOT NULL, ' +
            '`pieces_length` integer NOT NULL, `name` varchar(255) NOT NULL, `pieces` mediumblob NOT NULL, `path` ' +
            'varchar(1024) NOT NULL,  `status` text  NOT NULL DEFAULT "active");');

        this.db.run('CREATE TABLE IF NOT EXISTS `phptracker_peers` (`peer_id` binary(20) NOT NULL,  `ip_address` integer  NOT NULL, ' +
            '`port` integer NOT NULL, `info_hash` binary(20) NOT NULL, `bytes_uploaded` integer DEFAULT NULL, ' +
            '`bytes_downloaded` integer  DEFAULT NULL, `bytes_left` integer DEFAULT NULL, `status` text NOT NULL DEFAULT ' +
            '"incomplete", `expires` timestamp NULL DEFAULT NULL);');

        this.db.run('CREATE TABLE IF NOT EXISTS "lastexplored" (`blockhash` TEXT, `untilblock` TEXT, `date` TEXT);');

        this.db.run('CREATE TABLE IF NOT EXISTS `contracttx` (`ctx` varchar(255) NOT NULL, `ntx` varchar(255) NOT NULL,  `addr` ' +
            'varchar(255) NOT NULL, `date` varchar(255) NOT NULL, `type` varchar(255) NOT NULL, `data` text NOT NULL);');

        this.db.run('CREATE TABLE IF NOT EXISTS "addrtotx" (`addr` varchar(255) NOT NULL, `tx` varchar(255) NOT NULL, `amount` ' +
            'varchar(255) NOT NULL, `date` varchar(255) NOT NULL, `block` varchar(255) NOT NULL, `vin` INTEGER NOT NULL,' +
            ' `vout` INTEGER NOT NULL, `n` INTEGER NOT NULL, PRIMARY KEY(`addr`,`tx`,`vout`,`n`));');

    }

    query(sql, callback) {
        this.db.all(sql, callback);
    }

    lastExploredBlock(callback) {
        this.db.all('SELECT * FROM lastexplored ORDER BY date DESC LIMIT 0,1', callback);
    }

    lastAddrToTx(callback) {
        this.db.all("SELECT * FROM addrtotx ORDER BY date DESC LIMIT 0,1", callback);
    }

    addrToTx(addresses, ref, callback) {
        this.db.all("SELECT * FROM addrtotx WHERE addr IN ("+addresses+") AND tx='"+ref+"'", callback);
    }

    saveTx(address, vinTxID, vout, blocktime, blockhash, vin, n) {
        this.db.run("INSERT INTO addrtotx (addr, tx, amount, date, block, vin, vout, n) VALUES ('"
            + address + "', '" + vinTxID + "', '" + vout['value'] + "', " + blocktime + ", '" + blockhash + "', " + 0 + ", " + 1 + ", " + vout.n + ")", function () {

        });
    }

    insertAddress(address, vinTxID, vout, blocktime, blockhash) {
        let insetAddr = this.db.prepare("INSERT INTO addrtotx VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    }

    all(statement, callback) {
        this.db.all(statement,callback);
    }

    serialize(callback) {
        this.db.serialize(callback);
    }

    run(statement, callback) {
        this.db.run(statement, callback);
    }
    /**
     *
     * @param statement
     * @returns {*}
     */
    prepare(statement) {
        return this.db.prepare(statement);
    }
}
if (module) {
    module.exports = {ErrorCodes, OS, Constants, Utils, FileStorage, Preferences, Configuration, Creativecoin, DB};
}

