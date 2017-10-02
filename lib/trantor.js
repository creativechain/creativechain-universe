
const bitcoin = require('bitcoinjs-lib');
const RpcClient = require('bitcoind-rpc');


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
        return bitcoin.script.toASM(bitcoin.script.decompile(this.getBufferedScript()));
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
        if (bitcoin.script.pubKeyHash.output.check(this.getBufferedScript())) {
            return bitcoin.address.toBase58Check(bitcoin.script.compile(this.getBufferedScript()).slice(3, 23), Networks.MAINNET.pubKeyHash);
        } else  if (bitcoin.script.scriptHash.output.check(this.getBufferedScript())) {
            return bitcoin.address.toBase58Check(bitcoin.script.compile(this.getBufferedScript()).slice(2, 22), Networks.MAINNET.scriptHash);
        }

        return null;
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
        let tx = bitcoin.Transaction.fromHex(txHex);

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

class Trantor {
    constructor(network) {
        this.network = network;
        this.client = null;
        this.onError = null;
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

    prepareClient() {
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

    initNode(callback) {
        OS.run('creativecoind -datadir=' + Constants.BIN_FOLDER, function (result) {
            if (callback) {
                callback();
            }
            console.log('Starting platform:', result);
        })
    }

    start(callback) {
        let that = this;
        this.checkBinaryExist('creativecoind', function (exists) {
            console.log(exists);
            if (exists) {
                that.prepareConfiguration();
                that.prepareClient();
                that.initNode(callback);
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
}

if (module) {
    module.exports = {TxInput, TxOutput, DecodedTransaction, Network, RPCConfiguration: NodeConfiguration, Trantor}
}