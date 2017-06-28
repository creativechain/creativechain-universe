/**
 * Created by ander on 21/06/17.
 */

const fs = require('fs');
const exec = require('child_process').exec;

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
}

class Configuration {
    constructor(rpcuser = 'creativecoin', rpcpassword = Utils.randomString(9)) {
        this.rpcuser = rpcuser;
        this.rpcpassword = rpcpassword;
        this.rpcworkqueue = 2000;
        this.txindex = true;
        this.reindex = true;
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

    setIndexing(indexing) {
        this.reindex = indexing;
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
        var hasUser = false;
        var hasPassword = false;
        var hasReindex = false;
        var hasTxIndex = false;
        var hasRpcWorkqueue = false;
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
                case 'reindex':
                    content = content.replace(l, 'reindex=' + 1);
                    hasReindex = true;
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
        content = contentAdd(!hasReindex, content, 'reindex=1');
        content = contentAdd(!hasTxIndex, content, 'txindex=1');
        content = contentAdd(!hasRpcWorkqueue, content, 'rpcworkqueue=' + this.getRpcWorkQueue());
        console.log('Before save:');
        console.log(content);
        let fd = fs.openSync(file, 'w+');
        fs.writeSync(fd, content, 'utf8');
        fs.closeSync(fd);
    }

    static buildFromFile(file) {


        console.log('Reading ' + file);
        let content = fs.readFileSync(file, 'utf8');
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
                    conf.setRpcPassword(vals[0]);
                    break;
                case 'reindex':
                    conf.setIndexing(vals[1] == '1');
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
        this.OS = new OS();
        this.configuration = new Configuration();
        this.coreFolder = '';
        this.connection = null;
    }

    init() {
        let that = this;
        let onStopped = function () {
            let pathCommand = '';
            if (OS.isLinux()) {
                pathCommand = 'echo $HOME/.creativecoin/';
            } else if (OS.isWindows()) {
                pathCommand = 'echo %appdata%\\creativecoin\\';
            } else if (OS.isMac()) {
                pathCommand = 'echo Users/$USER/Library/Application Support/creativecoin/'
            }

            that.run(pathCommand, function (result, stderr) {
                if (stderr != null) {
                    console.log('Error getting core folder: ' + result, stderr);
                } else {
                    that.coreFolder = result.replace('\n', '');
                    console.log('Core path: ' + result);
                    that.createNodeFiles();
                }
            });
        };

        if (!Environment.isNodeCorrectlyRunning()) {
            this.isCoreRunning(function (running) {
                if (running) {
                    that.stop(function () {
                        console.log('creativecoin node stopped!');
                        onStopped();
                    })
                } else {
                    onStopped();
                }
            });
        } else {
            onStopped();
        }

    };

    createNodeFiles() {
        let that = this;

        let onExists = function () {
            //FOLDER OF NODE EXIST
            that.configuration = Configuration.buildFromFile(that.getConfigurationPath());
            that.connection = new RpcCaller({
                port: 17111,
                host: '127.0.0.1',
                user: that.configuration.getRpcUser(),
                pass: that.configuration.getRpcPassword()
            });
            if (!Environment.isNodeCorrectlyRunning()) {
                setTimeout(function () {
                    that.start(function (result) {
                        Environment.setNodeCorrectlyRunning(true);
                        console.log('Node started!');
                    });
                }, 5000);
            }
        };

        if (fs.statSync(this.coreFolder)) {
            onExists();
        } else {
            fs.mkdirSync(this.coreFolder);
            onExists();
        }
    }

    /**
     *
     * @param command
     * @param callback
     */
    run(command, callback) {
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
        if (OS.isLinux() || OS.isMac()) {
            return this.coreFolder + 'creativecoin.conf';
        } else if (OS.isWindows()) {
            return this.coreFolder + 'creativecoin.conf';
        }

        return null;
    }

    /**
     *
     * @param callback
     */
    start(callback) {
        console.log('starting node...');
        let startCommand = 'creativecoind -daemon';
        if (OS.isWindows()) {
            //NOT SUPPORTED
            throw 'Start command in Windows is not supported.';
        }

        this.run(startCommand, callback);

    };

    /**
     *
     * @param callback
     */
    stop(callback) {
        let stopCommand = 'creativecoin-cli stop';
        if (OS.isWindows()) {
            //NOT SUPPORTED
            throw 'Stop command in Windows is not supported.';
        }

        this.run(stopCommand, callback);
    };

    /**
     *
     * @param callback
     */
    isCoreRunning(callback) {
        if (OS.isLinux()) {
            this.run('ps -aux | grep creativecoind', function (result, stderr) {
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
            this.run('tasklist', function (result, stderr) {
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
        var crea = new Creativecoin();
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

if (module) {
    module.exports = {OS, Configuration, Creativecoin};
}