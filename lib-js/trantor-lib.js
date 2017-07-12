/* Imports */
//const fs = require('fs');
// const HttpsCaller = require('./https-caller');
//const {app, BrowserWindow} = require('electron');

const bitcoin = require('bitcoinjs-lib');
const RpcClient = RpcCaller;
// const CreaClient = require('./rpc-client');
var path = require('path');

global.appRoot = path.resolve(__dirname);

const sqlite3 = require('sqlite3').verbose();
//const exec = require('child_process').exec;

/* CONSTANTS */
const CREA_API_URL = 'search.creativechain.net';

const CREA_USE_CMD = false; // use command-line instead of JSON-RPC?
const OP_RETURN_MAX_BLOCKS = 10; // maximum number of blocks to try when retrieving data
const OP_RETURN_MAX_BYTES = 1000; // maximum bytes in an OP_RETURN (40 as of Bitcoin 0.10)
const OP_RETURN_BTC_DUST = 0.002; // omit BTC outputs smaller than this
const OP_RETURN_BTC_FEE = 0.004; // BTC fee to pay per transaction

const NODE = new Creativecoin();

let SESSION = {};

const args = process.argv.slice(2);
console.log("App path", path.resolve(__dirname));

const https = new HttpsCaller({
    host: CREA_API_URL,
    port: 3001
});
let trantor = {};
trantor.onContent = null;

let total_blocks = 0;
let isExploring = false;
let hasExploredOnce = false;
let corepath = '';
trantor.db = new DB(Constants.DATABASE_PATH);

class Networks {}
Networks.MAINNET = {
    messagePrefix: '\x18Creativecoin Signed Message:\n',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4
    },
    pubKeyHash: 0x1c,
    scriptHash: 0x05,
    wif: 0x80
};

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

function init() {
    trantor.db.init();
    NODE.init(function () {

        let explore = function () {
            if (!isExploring) {
                console.log('Start to explore');
                trantor.exploreBlocks();
            }
        };
        setTimeout(function () {
            //setInterval(explore, 15 * 1000);
            explore();
        }, (Preferences.isFirstUseExecuted() ? 60 : 15) * 1000);

    });
}

init();

function decode_utf8(s) {
    return decodeURIComponent(escape(s));
}
function exploreBlocks() {
    let first_use = Preferences.isFirstUseExecuted();
    if (true) {
        $('.exploring').remove();
        $('body').append('<div class="exploring">Exploring blockchain please wait</div>');
        $('.exploring').append('<h4 class="total_blocks"></h4>').append('<h4 class="status"></h4>')
        Preferences.setFirstUseExecuted(false)
    }
    isExploring = true;
    if (typeof $ != 'undefined' && !hasExploredOnce) {

    }
    hasExploredOnce = true;

    console.log("EXPLORING CREA BLOCKS .... SYNC ... please wait ... \n");
    let lastblock;

    trantor.db.lastExploredBlock(function (err, res) {
        console.log("Res", err, res);
        if (res[0] && res[0].blockhash) {
            NODE.connection.getBlockCount(function (err, count) {
                if (err) {
                    console.log('Erro grtting num of blocks', err);
                } else  {
                    total_blocks = count.result;
                    console.log("Didnt finish last time");
                    listsinceblock(res[0].blockhash, res[0].untilblock || null);//add lastblock['block']
                }

            });
        } else {
            trantor.db.lastAddrToTx(function(err, row) {
                let block, blocks;
                lastblock = row[0];
                console.log('Lastblock', lastblock);

                NODE.connection.getBlockCount(function(err, count) {
                    console.log('getBlockCount', err, count);
                    total_blocks = parseInt(count.result);

                    NODE.connection.getBlockHash(total_blocks, function (err, hash) {
                        console.log('getBlockHash', err, hash);

                        if (lastblock == undefined) {
                            listsinceblock(hash.result);
                            //listsinceblock('1cad01fe4d331803435710b049e0639d1f42cb22a13253aec62478e2c7df326d');
                        } else {
                            listsinceblock(hash.result, lastblock['block']);
                            //listsinceblock('1cad01fe4d331803435710b049e0639d1f42cb22a13253aec62478e2c7df326d');
                        }

                    });
                });
            });
        }
    });
}
trantor.exploreBlocks = exploreBlocks;

function getDataFromReference2(transaction, cb) {
    let opdata = '';
    function processData() {

        let txdata = '';

        for (let out of transaction.outputs) {
            if (out.getAddress() == null) {
                txdata +=  out.script;
            }
        }

        //console.log('TXDATA:', txdata);
        txdata = Buffer.from(txdata, 'hex').toString('utf8');
        //console.log('BUFFERDATA:', txdata);
        txdata = txdata.split('-CREAv1-');

        try {
            let txids = JSON.parse(txdata[1]);
            //console.log('ReferenceIds', txids);

            if (txids) {
                if (txids.txids) {
                    let length = txids.txids.length;

                    for (let txid of txids.txids) {

                        getDecodedTransaction(txid, function(tx) {

                            for (let out of tx.outputs) {
                                if (out.getAddress() == null) {
                                    let opdataP = out.getBufferedScript().toString('utf8');
                                    if (opdataP.indexOf('-CREAv1-') !== -1) {
                                        opdataP = opdataP.split('-CREAv1-');
                                        opdata += opdataP[1];
                                    }
                                }
                            }
                        })
                    }

                    cb(opdata, txids.txids[txids.txids.length -1]);
                    //return opdata;
                    //cb(opdata, txid);

                } else if (cb) {
                    console.log('TxIds no has index, is data', txids);
                    cb(txids, transaction.hash)
                }
            }
        } catch (e) {
            if (cb) {
                cb(null);
            }
        }

    }

    processData();
    //console.log('RETURN DATA: ', opdata);

/*    if (typeof transaction == 'string') {
        getDecodedTransaction(transaction, function (deco) {
            transaction = deco;
            processData();
        })
    } else {
        processData()
    }*/
}
trantor.getDataFromReference = getDataFromReference2;

let getDecTxSecurity = 0;
function getDecodedTransaction(tx_id, cback) {
    NODE.connection.getRawTransaction(tx_id, function (err, rawtx) {
        //console.log('getRawTransaction', err, rawtx);
        if (!err) {
            rawtx = rawtx.result;

            let dTx = DecodedTransaction.fromHex(rawtx);
            //console.log('Comparing hashes: ', dTx, tx_id);
            cback(dTx);
        } else {
            //console.log('Error decoding ' + tx_id, err);
            setTimeout(function () {
                getDecodedTransaction(tx_id, cback);
            }, 200);

        }
    });
}
trantor.getDecodedTransaction = getDecodedTransaction;

// Va muy lento - creo que es getDecodedTransaction o los inserts a base de datos
function listsinceblock(starthash, lastblock) {
    trantor.db.serialize(function () {

        function listBlock(starthash) {
            console.log('Listing block:', starthash);
            let insertAddr = trantor.db.prepare("INSERT INTO addrtotx VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            let insertWord = trantor.db.prepare("INSERT INTO wordToReference VALUES (?, ?, ?, ?)");
            let insertCtx = trantor.db.prepare("INSERT INTO contracttx  VALUES (?, ?, ?, ?, ?, ?)");
            NODE.connection.getBlock(starthash, function (err, b) {
                //console.log('getBlock', err, b);
                if (!err) {
                    let block = b.result;
                    let blockhash = block.hash;
                    let blocktime = block.time;
                    let bheight = block.height;
                    let prevBlock = block.previousblockhash;
                    let txs = block.tx;

                    if (typeof $ != 'undefined') {
                        $('.exploring .status').html(`<span>Block: <b>${blockhash}</b></span>
                            <span>Height: <span class="col-gray">${bheight}</span></span>
                            <span>Transactions: [<span class="c_tx col-gray"></span>/${txs.length}]</span>
                            <span>Done: ${total_blocks - block.height}/${total_blocks}</span>`);
                    }

                    function processTransaction(i) {
                        let tx_id = txs[i];
                        if (typeof $ != 'undefined') {
                            $('.c_tx').text(i);
                        }
                        if (tx_id) {

                            getDecodedTransaction(tx_id, function (transaction) {
                                for (let x = 0; x < transaction.outputs.length; x++) {
                                    let out = transaction.getOutput(x);
                                    if (out.getAddress() != null) {
                                        insertAddr.run(out.getAddress(), transaction.hash, out.value, blocktime, blockhash, 0, 1, out.index);
                                    }
                                }

                                /* Cojo los vouts de los vins de la transaccion */

                                transaction.inputs.forEach(function (input, index, array) {
                                    let onDecode = function (inputTx) {
                                        if (inputTx) {
                                            inputTx.outputs.forEach(function (out, index, array) {
                                                let address = out.getAddress();
                                                if (address != null) {
                                                    insertAddr.run(address, inputTx.hash, out.value, blocktime, blockhash, 1, 0, out.index);
                                                }
                                            });
                                        } else {
                                            //Try to get tx again
                                            getDecodedTransaction(input.txHash, onDecode);
                                        }
                                    };
                                    getDecodedTransaction(input.txHash, onDecode)
                                });

                                getDataFromReference2(transaction, function(data, ref) {
                                    //console.log('Ref', data, ref);
                                    if (data) {
                                        try {
                                            if (typeof data == 'string') {
                                                data = JSON.parse(data);
                                            }
                                            if (data.title) {
                                                let wordsInTitle = data.title.split(' ');
                                                for (let i = 0; i < wordsInTitle.length; i++) {
                                                    let word = wordsInTitle[i];
                                                    console.log("WORD", word);
                                                    insertWord.run([word, ref, blocktime, i], _ => {});
                                                    // db.run("INSERT INTO wordToReference (wordHash, 'ref', blockDate, 'order') VALUES ('" + word + "', '" + ref + "', " + blocktime + ", " + i + ")",
                                                    //   (error, row) => {});
                                                }
                                            }
                                            if (data.type) {
                                                insertWord.run([data.type, ref, blocktime, i], _ => {});

                                                // db.run("INSERT INTO wordToReference (wordHash, 'ref', blockDate, 'order') VALUES ('" + data.type + "', '" + ref + "', " + blocktime + ", " + i + ")",
                                                //   (error, row) => {
                                                //     // console.log('sql', error, row);
                                                //   });
                                            }

                                            let number = data.number ? parseInt(data.number) : 0;
                                            let address = data.address ? data.address : '';
                                            let year = data.year ? data.year : '';
                                            console.log('INSERTING CONTENT: ', ref, number, address, year, data.type, JSON.stringify(data));
                                            insertCtx.run(ref, number, address, year, data.type, JSON.stringify(data), _ => {});
                                            //insertCtx.run(data.tx, ref, blocktime, data.contract, JSON.stringify(data), _ => {})
                                            // db.run("INSERT INTO contracttx (ctx, 'ntx', addr, 'date', type, data) VALUES ('" +
                                            //   data.tx + "', '" + ref + "', '', '" + blocktime + "', '" + data.contract + "', '" + JSON.stringify(data) + "')",
                                            //   (error, row) => {
                                            //     // console.log('sql', error, row);
                                            //   });

                                            setTimeout(function () {
                                                if (trantor.onContent) {
                                                    trantor.onContent();
                                                }
                                            }, 200);

                                        } catch (e) {
                                            console.log("Error", e);
                                        }
                                    }
                                });
                            });
                        }
                    }

                    for (let x = 0; x < txs.length; x++) {
                        processTransaction(x);
                    }

                    if (prevBlock) {
                        console.log('Block ' + blockhash + ' parsed');
                        //trantor.db.all('DELETE FROM lastexplored', _ => {});
                        trantor.db.run('INSERT INTO lastexplored (blockhash, untilblock, date) VALUES ("'+blockhash+'", "'+lastblock+'", "'+blocktime+'")', _ => {});
                        listBlock(prevBlock)
                    } else if (!block.previousblockhash || block.previousblockhash == lastblock) {
                        console.log('EXPLORATION ENDED!');
                        isExploring = false;
                        //trantor.db.all('DELETE FROM lastexplored', _ => {});
                        insertAddr.finalize(_ => {});
                        insertCtx.finalize(_ => {});
                        insertWord.finalize(_ => {});
                        if (typeof $ != 'undefined') {
                            $('.exploring').remove();
                        }
                    }

                } else {
                    setTimeout(function () {
                        listBlock(starthash);
                    }, 1000);
                }
            });
        }
        if (starthash && starthash != lastblock) {
            listBlock(starthash)
        }
        else {
            if (typeof $ != 'undefined') {
                $('.exploring').remove();
            }
        }
    })
}

trantor.saveTransactionToDb = function(decodedintx) {
    if (decodedintx && decodedintx['vout']) {
        let vinTxID = decodedintx.txid;
        decodedintx.vout.forEach(vout => {
            if (vout['scriptPubKey'] && vout['scriptPubKey']['addresses']) {
                vout['scriptPubKey']['addresses'].forEach(address => {

                    trantor.db.run("INSERT INTO addrtotx (addr, tx, amount, date, block, vin, vout, n) VALUES ('"
                        + address + "', '" + vinTxID + "', '" + vout['value'] + "', " + blocktime + ", '" + blockhash + "', " + 0 + ", " + 1 + ", " + vout.n + ")",
                        (error, row) => {});
                })
            }
        })
    }

    /* Cojo los vouts de los vins de la transaccion */

    if (decodedintx && decodedintx['vin']) {
        decodedintx.vin.forEach(vin => {
            let index = vin.vout;
            if (vin.txid) {
                // console.log("Vin", vin.txid);
                getDecodedTransaction(vin.txid, vindeco => {
                    // console.log("vinsd", vindeco);
                    if (vindeco && vindeco.vout) {
                        let vinTxID = vin.txid;
                        // console.log("vindeco", vindeco);
                        vindeco.vout.forEach(vout => {
                            // console.log('VOUT VIN ', vinTxID, vin.txid);
                            if (vout.n == index && vout['scriptPubKey'] && vout['scriptPubKey']['addresses']) {
                                // console.log("If", vout);
                                vout['scriptPubKey']['addresses'].forEach(address => {
                                    trantor.db.run("INSERT INTO addrtotx (addr, tx, amount, date, block, vin, vout, n) VALUES ('" + address + "', '" + vinTxID + "', '" + vout['value'] + "', " + blocktime + ", '" + blockhash + "', " + 1 + ", " + 0 + ", " + vout.n + ")",
                                        (error, row) => {
                                            // console.log('addrtotx vin', error, row);
                                        });
                                })
                            }
                        })
                    }
                })
            }
        })
    }

    getDataFromReference2(decodedintx, function(data, ref) {
        // console.log("Ref", data, ref);
        if (data) {
            try {
                if (typeof data == 'string') {
                    data = JSON.parse(data);
                }
                if (data.title) {
                    let wordsInTitle = data.title.split(' ');
                    for (var i = 0; i < wordsInTitle.length; i++) {
                        let word = wordsInTitle[i];
                        console.log("WORD", word);
                        trantor.db.run("INSERT INTO wordToReference (wordHash, 'ref', blockDate, 'order') VALUES ('" + word + "', '" + ref + "', " + blocktime + ", " + i + ")",
                            (error, row) => {});
                    }
                }
                if (data.type) {
                    trantor.db.run("INSERT INTO wordToReference (wordHash, 'ref', blockDate, 'order') VALUES ('" + data.type + "', '" + ref + "', " + blocktime + ", " + i + ")",
                        (error, row) => {
                            // console.log('sql', error, row);
                        });
                }
                if (data.contract) {
                    trantor.db.run("INSERT INTO contracttx (ctx, 'ntx', addr, 'date', type, data) VALUES ('" +
                        data.tx + "', '" + ref + "', '', '" + blocktime + "', '" + data.contract + "', '" + JSON.stringify(data) + "')",
                        (error, row) => {
                            // console.log('sql', error, row);
                        });
                }
            } catch (e) {
                console.log("Error");
                return;
            }
        } else {
            return;
        }
    })
}

/*
 *  Decodes a raw transaction
 *  @parameter rawtx: rawtx, needs to be built before
 */
trantor.decodeRawTransaction = function (rawtx, cback) {

    let dTx = DecodedTransaction.fromHex(rawtx);
    cback(dTx);
}

function listunspend2(addr, cback) {

    // Todas las tx que esten como vout y y no esten como vin
    let unspent = {
        total: 0
    };
    trantor.db.all("SELECT * FROM addrtotx WHERE addr='" + addr + "' AND vout=1", (error, txsin) => {
        // console.log("Select addr vin=0", txsin);

        function processEntry(i) {
            let tx = txsin[i].tx;
            trantor.db.all("SELECT * FROM addrtotx WHERE addr='" + addr + "' AND tx='" + tx + "' AND vout=1", function(error, txs) {
                console.log("Select tx vout!=1", txs);

                function processEntry2(j) {
                    // let tx = txs[i];
                    // unspent.amount = tx.value;
                    let tx_ = txs[j];
                    trantor.db.all("SELECT * FROM addrtotx WHERE addr='"+addr+"' AND tx='"+tx_.tx+"' AND vin=1", function (error, existsAsVin) {
                        console.log("processEntry2", j, tx_, existsAsVin);
                        if (tx_ &&  !existsAsVin.length) {
                            getDecodedTransaction(tx_.tx, function(gtx) {
                                // console.log("decoe", i, j, gtx);
                                unspent.total += parseFloat(tx_.amount);
                                unspent[tx_.tx] = {
                                    hash: tx_.address,
                                    address: addr,
                                    amount: tx_.amount,
                                    index: tx_.n,
                                    scriptPubKey: gtx.vout[tx_.n].scriptPubKey.hex
                                };

                                if (j < txs.length - 1) {
                                    processEntry2(++j);
                                } else if (i < txsin.length - 1) {
                                    processEntry(++i);
                                }
                                if (i == txsin.length - 1) {
                                    return cback(unspent);
                                }
                            })
                        }
                        else{
                            if (i == txsin.length - 1) {
                                console.log("cback", i, txsin.length);
                                return cback(unspent);
                            }
                            if (j < txs.length - 1) {
                                processEntry2(++j);
                            } else if (i < txsin.length - 1) {
                                processEntry(++i);
                            }

                        }
                    })
                }
                if (txs.length) {
                    processEntry2(0);
                }
                else {
                    cback()
                }
            })
        }
        if (txsin.length) {
            processEntry(0);
        }
        else {
            console.log("else");
            return cback(unspent);
        }
    });
}
trantor.listunspent = listunspend2;
/*
 CREA_crea_cmd
 arg[0] command: string
 arg[1] testnet: boolean
 - other arguments passed here will be treated as the parameters for the cmd
 arg[last] cback: function *(must be in last position)
 will be called with arguments (response, error)
 */
function CREA_crea_cmd(command, args, cback) {
    console.log(command, args);

    if (CREA_USE_CMD) {
        command = Constants.CLIENT_PATH + ' ' + command + ' ' + args;

        exec(command, function(error, raw_result, stderr) {

            if (error !== null) {
                console.log('exec error: ' + error, stderr);
                cback(error);
            }
            let result = null;
            try {
                result = JSON.parse(raw_result); // decode JSON if possible
            } catch (e) {
                result = raw_result;
            }

            cback(result);
        });
    } else {
        console.log('CREA_crea_cmd', command, args);
        let requestOpts = {
            'id': getID(),
            'command': command,
            'params': args,
            'user': NODE.configuration.getRpcUser(),
            'pass': NODE.configuration.getRpcPassword()
        };

        NODE.connection.call(requestOpts, function (result, err, resHeaders) {
            console.log(result, err, resHeaders);
            cback(result);
        });
    }
}

function OP_RETURN_store(data, testnet = false, cb) {
    /*
     Data is stored in OP_RETURNs within a series of chained transactions.
     The data is referred to by the txid of the first transaction containing an OP_RETURN.
     If the OP_RETURN is followed by another output, the data continues in the transaction spending that output.
     When the OP_RETURN is the last output, this also signifies the end of the data.
     */
    OP_RETURN_bitcoin_check(testnet, checkStatus => {
        if (!checkStatus) {
            console.log('Please check Bitcoin Core is running and OP_RETURN_BITCOIN_* constants are set correctly')
            return {
                'error': 'Please check Bitcoin Core is running and OP_RETURN_BITCOIN_* constants are set correctly'
            }
        } else {
            let strLength = data.length;
            if (strLength == 0) {
                if (cd) cb({
                    'error': 'Some data is required to be stored'
                });
            }
            let output_amount = OP_RETURN_BTC_FEE * Math.ceil(strLength / OP_RETURN_MAX_BYTES);
            output_amount = output_amount + (OP_RETURN_BTC_DUST * Math.ceil(strLength / OP_RETURN_MAX_BYTES));

            OP_RETURN_select_inputs(output_amount, testnet, function(inputs_spend) {
                if (inputs_spend.error) {
                    return cb(inputs_spend);
                }
                let inputs = inputs_spend['inputs'];
                let input_amount = inputs_spend['total'];
                console.log('No errior', inputs_spend)
                https.call('GET', '/api/getblockcount', null, (blockcount) => {
                    console.log('BlcokCount', blockcount);
                    CREA_crea_cmd('getrawmempool', null, response => {
                        console.log("getrawmempool", response)

                        let result = {};

                        function processResponse(data_ptr) {

                            CREA_crea_cmd('getrawchangeaddress', null, change_address => {
                                console.log('change_address', change_address);
                                let last_txn = ((data_ptr + OP_RETURN_MAX_BYTES) >= strLength); // is this the last tx in the chain?
                                let change_amount = input_amount - OP_RETURN_BTC_FEE;
                                let metadata = data.substring(data_ptr, OP_RETURN_MAX_BYTES - 6);
                                metadata = "-CREA-" + metadata;

                                let outputs = {};
                                outputs[change_address] = change_amount;
                                OP_RETURN_create_txn(inputs, outputs, metadata, last_txn ? outputs.length : 0, testnet,
                                    raw_txn => {
                                        console.log("Created TX", raw_txn)
                                        OP_RETURN_sign_send_txn(raw_txn, testnet,
                                            send_result => {
                                                // Check for errors and collect the txid
                                                if ('error' in send_result) {
                                                    result['error'] = send_result['error'];
                                                    return cb(result);
                                                }

                                                result['txids'] = [send_result['tx_id']];
                                                // $result['txids'][] = $send_result['txid'];
                                                // sleep(1);
                                                if (data_ptr == 0) {
                                                    result['ref'] = send_result['txid'];
                                                }
                                                inputs = [
                                                    {
                                                        txid: send_result.txid,
                                                        vout: 1
                                                    }
                                                ]
                                                input_amount = change_amount;
                                            });
                                    });
                            });

                            if (data_ptr < strLength) {
                                processResponse(data_ptr+=OP_RETURN_MAX_BYTES);
                            }
                            else {
                                return cb(result);
                            }
                        }

                        // for (let data_ptr = 0; data_ptr < strLength; data_ptr += OP_RETURN_MAX_BYTES) {
                        //   CREA_crea_cmd('getrawchangeaddress', testnet, null, change_address => {
                        //     console.log('change_address', change_address);
                        //     let last_txn = ((data_ptr + OP_RETURN_MAX_BYTES) >= strLength); // is this the last tx in the chain?
                        //     let change_amount = input_amount - OP_RETURN_BTC_FEE;
                        //     let metadata = data.substring(data_ptr, OP_RETURN_MAX_BYTES - 6);
                        //     metadata = "-CREA-" + metadata;
                        //
                        //     let outputs = {};
                        //     outputs[change_address] = change_amount;
                        //     OP_RETURN_create_txn(inputs, outputs, metadata, last_txn ? outputs.length : 0, testnet,
                        //       raw_txn => {
                        //         console.log("Created TX", raw_txn)
                        //         OP_RETURN_sign_send_txn(raw_txn, testnet,
                        //           send_result => {
                        //             // Check for errors and collect the txid
                        //         		if ('error' in send_result) {
                        //         			result['error'] = send_result['error'];
                        //               cb(result);
                        //         			break;
                        //         		}
                        //
                        //             result['txids'] = [send_result['tx_id']];
                        //         		// $result['txids'][] = $send_result['txid'];
                        //         		// sleep(1);
                        //             if (data_ptr == 0) {
                        //               result['ref'] = send_result['txid'];
                        //             }
                        //         		// if ($data_ptr == 0)
                        //         		// 	$result['ref'] = $send_result['txid'];
                        //
                        //         		//	Prepare inputs for next iteration
                        //             inputs = [
                        //               {
                        //                 txid: send_result.txid,
                        //                 vout: 1
                        //               }
                        //             ]
                        //         		// $inputs=array(array(
                        //         		// 	'txid' => $send_result['txid'],
                        //         		// 	'vout' => 1,
                        //         		// ));
                        //             input_amount = change_amount;
                        //           });
                        //       });
                        //   });
                        // }
                    })
                })
            });
        }
    })
}

function OP_RETURN_select_inputs(total_amount, testnet, cb) {
    CREA_crea_cmd('listunspent', 0, unspent_inputs => {
        console.log('listunspent');
        console.log(unspent_inputs);

        if (!unspent_inputs || unspent_inputs.length <= 0) {
            console.log('Could not retrieve list of unspent inputs');
            return {
                'error': 'Could not retrieve list of unspent inputs'
            }
        }

        for (let i = 0; i < unspent_inputs.length; i++) {
            let unspent_input = unspent_inputs[i];
            console.log(unspent_input);
            unspent_inputs[i]['priority'] = unspent_input['amount'] * unspent_input['confirmations'];
            // see: https://en.bitcoin.it/wiki/Transaction_fees
        }

        unspent_inputs =
            unspent_inputs
                .sort(OP_RETURN_sort_by.bind('priority'))
                .reverse();

        //	Identify which inputs should be spent
        let inputs_spend = [];
        let input_amount = 0;

        for (var i = 0; i < unspent_inputs.length; i++) {
            let unspent_input = unspent_inputs[i];
            inputs_spend = unspent_input;
            input_amount += unspent_input['amount'];

            if (input_amount >= total_amount) {
                break;
            }
        }

        // Check if has engough funds
        if (input_amount < total_amount) {
            console.log('Not enough funds are available to cover the amount and fee');
            return {
                'error': 'Not enough funds are available to cover the amount and fee'
            };
        }
        //	Return the successful result
        if (cb) cb({
            'inputs': inputs_spend,
            'total': input_amount,
        })
    });
}

function OP_RETURN_bitcoin_check(testnet, cb) {
    CREA_crea_cmd('getinfo', function(response) {
        cb(response);
    });
}

function OP_RETURN_create_txn(inputs, outputs, metadata, metadata_pos, testnet) {
    OP_RETURN_bitcoin_cmd('createrawtransaction', testnet, inputs, outputs, raw_txn => {
        let packed = new Buffer(raw_txn, "hex");
        OP_RETURN_unpack_txn(packed);
    });

    // $raw_txn = OP_RETURN_bitcoin_cmd('createrawtransaction', $testnet, $inputs, $outputs);
    //
    // $txn_unpacked=OP_RETURN_unpack_txn(pack('H*', $raw_txn));
    //
    // $metadata_len=strlen($metadata);
    //
    // if ($metadata_len<=75)
    //   $payload=chr($metadata_len).$metadata; // length byte + data (https://en.bitcoin.it/wiki/Script)
    // elseif ($metadata_len<=256)
    //   $payload="\x4c".chr($metadata_len).$metadata; // OP_PUSHDATA1 format
    // else
    //   $payload="\x4d".chr($metadata_len%256).chr(floor($metadata_len/256)).$metadata; // OP_PUSHDATA2 format
    //
    // $metadata_pos=min(max(0, $metadata_pos), count($txn_unpacked['vout'])); // constrain to valid values
    //
    // array_splice($txn_unpacked['vout'], $metadata_pos, 0, array(array(
    //   'value' => OP_RETURN_BTC_DUST,
    //   'scriptPubKey' => '6a'.reset(unpack('H*', $payload)), // here's the OP_RETURN
    // )));
    //
    // return reset(unpack('H*', OP_RETURN_pack_txn($txn_unpacked)));
}

function OP_RETURN_sign_send_txn(raw_txn, testnet, cb) {
    OP_RETURN_bitcoin_cmd('signrawtransaction', testnet, raw_txn,
        signed_txn => {
            if (!signed_txn['complete']) {
                console.log({
                    'error': 'Could not sign the transaction'
                });
                return {
                    'error': 'Could not sign the transaction'
                }
            }

            OP_RETURN_bitcoin_cmd('sendrawtransaction', testnet, signed_txn['hex'],
                send_txid => {
                    if (send_txid.length != 64)
                        return {
                            'error': 'Could not send the transaction txid: ' + send_txid + ' raw: ' + send_txid
                        };
                    else if (cb) {
                        cb({
                            txid: send_txid
                        });
                    }
                });
        });
}

function OP_RETURN_unpack_txn(binary, cb) {
    return OP_RETURN_unpack_txn_buffer(new OP_RETURN_buffer(binary), cb);
}

function getOPcrea(txid) {
    console.log("TXID: ", txid);
    CREA_crea_cmd('gettransaction', txid, rawtx => {
        console.log("rawtx", rawtx);
    });
}

// Utils
function escapeshellarg(arg) {
    console.log('ecapellarg:', arg);
    if (arg == null || arg == undefined) {
        return '';
    }
    var ret = '';
    ret = arg.replace(/[^\\]'/g, function(m, i, s) {
        return m.slice(0, 1) + '\\\''
    });
    return "'" + ret + "'"
}

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function hex2str(str) {
    var arr = [];
    for (var i = 0, l = str.length; i < l; i++) {
        var hex = Number(str.charCodeAt(i)).toString(16);
        arr.push(hex);
    }
    return arr.join('');
    // return (new Buffer(hexx, 'hex')).toString();
}

function getID() {
    let time = Date.now();
    let rNum = Math.floor(Math.random() * 999999) + 1e5;
    return time + '-' + rNum
}

function addslashes(str) {
    //  discuss at: http://locutus.io/php/addslashes/
    // original by: Kevin van Zonneveld (http://kvz.io)
    // improved by: Ates Goral (http://magnetiq.com)
    // improved by: marrtins
    // improved by: Nate
    // improved by: Onno Marsman (https://twitter.com/onnomarsman)
    // improved by: Brett Zamir (http://brett-zamir.me)
    // improved by: Oskar Larsson Högfeldt (http://oskar-lh.name/)
    //    input by: Denny Wardhana
    //   example 1: addslashes("kevin's birthday")
    //   returns 1: "kevin\\'s birthday"
    return (str + '')
        .replace(/[\\"']/g, '\\$&')
        .replace(/\u0000/g, '\\0')
}

/* Sorting */
function OP_RETURN_sort_by(parameter, item_a, item_b) {
    if (a[parameter] < b[parameter])
        return -1;
    if (a[parameter] > b[parameter])
        return 1;
    return 0;
}



trantor.findWord = function(find, page, cback, addresses) {
    // $find=addslashes($_POST['find']);
    // console.log("addresses", addresses);
    console.log("App path", path.resolve(__dirname));
    var cb = cback;
    find = find ? addslashes(find) : null;
    page = page ? addslashes(page.replace(/(<([^>]+)>)/ig, "")) : null;

    let addrs = addresses ? addresses+'': null;

    function processResult(error, result) {
        console.log("RESULT", error, result);
        let numrows = result.length;
        let i = 0;
        let data = [];

        function processResultElem(i) {
            let elem = result[i];

            data[i] = {
                ref: elem.ref,
                count: numrows
            };
            getDecodedTransaction(elem.ref, function(decoref) {
                console.log("ADSD", "SELECT * FROM addrtotx WHERE addr IN ("+addrs+") AND tx='"+elem.ref+"'");
                if(addrs){
                    trantor.db.query("SELECT * FROM addrtotx WHERE addr IN ("+addrs+") AND tx='"+elem.ref+"'", (error, res2) => {
                        console.log("error", res2, addrs);
                        if ((res2 && addrs)) {
                            console.log("if");
                            getDataFromReference2(decoref, function(refdata) {
                                console.log(refdata, elem);
                                trantor.db.query("SELECT * FROM contracttx WHERE ctx LIKE '" + elem.ref + "' AND type LIKE 'like' ORDER BY date DESC",
                                    function(error, likes) {
                                        // console.log("Likes", error, likes);
                                        data[i].like = likes ? likes.length: 0
                                    })
                                trantor.db.query("SELECT * FROM contracttx WHERE ctx LIKE '" + elem.ref + "' AND type LIKE 'unlike' ORDER BY date DESC",
                                    function(error, unlikes) {
                                        data[i].unlike = unlikes ? unlikes.length: 0
                                    })
                                trantor.db.query("SELECT * FROM contracttx WHERE ctx LIKE '" + elem.ref + "' ORDER BY date DESC",
                                    function(error, contracts) {
                                        data[i].contracts = contracts ? contracts.length: 0
                                    })
                                if (refdata != '') {
                                    data[i].content = refdata
                                    // console.log("Content", data);
                                }
                                console.log("i", i, "l", result.length);
                                if (i < result.length - 1) {
                                    processResultElem(++i);
                                } else {
                                    cb(data);
                                }
                            })
                        }
                        else if (i < result.length - 1) {
                            processResultElem(++i);
                        } else {
                            console.log("cback", data);
                            cb(data);
                        }
                    })
                }
                else {
                    getDataFromReference2(decoref, function(refdata) {
                        // console.log(refdata, elem);
                        trantor.db.query("SELECT * FROM contracttx WHERE ctx LIKE '" + elem.ref + "' AND type LIKE 'like' ORDER BY date DESC",
                            function(error, likes) {
                                console.log("Likes", error, likes);
                                data[i].like = likes ? likes.length: 0
                            })
                        trantor.db.query("SELECT * FROM contracttx WHERE ctx LIKE '" + elem.ref + "' AND type LIKE 'unlike' ORDER BY date DESC",
                            function(error, unlikes) {
                                data[i].unlike = unlikes ? unlikes.length: 0
                            })
                        trantor.db.query("SELECT * FROM contracttx WHERE ctx LIKE '" + elem.ref + "' ORDER BY date DESC",
                            function(error, contracts) {
                                data[i].contracts = contracts ? contracts.length: 0
                            })
                        if (refdata != '') {
                            data[i].content = refdata
                            // console.log("Content", data);
                        }
                        // console.log("i", i, "l", result.length);
                        if (i < result.length - 1) {
                            processResultElem(++i);
                        } else {
                            console.log("cback", data);
                            cb(data);
                        }
                    })
                }
            })
        }
        if (result.length > 0) {
            processResultElem(0);
        }
        else {
            cback(data)
        }
    }
    processResult.bind(this);
    if (!find) {
        console.log("Not find");
        if (!page) {
            page = 0;
            trantor.db.query("SELECT DISTINCT ref FROM wordToReference  ORDER BY blockDate DESC LIMIT " + page + ", 10", (error, result) => {
                if (result && result.length) {
                    processResult(error, result)
                }
                else{
                    processResult(error, [])
                }
            })
        } else {
            page = (page - 1) * 10;
            trantor.db.query("SELECT DISTINCT ref FROM wordToReference  ORDER BY blockDate DESC LIMIT " + page + ", 10", (error, result) => {
                if (result && result.length) {
                    processRaesult(error, result)
                }
                else{
                    processResult(error, [])
                }
            });
        }
    } else {
        let i = 0;
        find = find.split(' ').join('|');
        console.log("ESLE");
        trantor.db.query("SELECT DISTINCT ref FROM wordToReference WHERE instr(wordHash, '" + find + "') > 0  ORDER BY blockDate DESC", (error, result) => {
            if (!page) {
                page = 0;
                console.log("No page", find);
                trantor.db.all("SELECT DISTINCT ref FROM wordToReference WHERE instr(wordHash, '" + find + "') > 0 ORDER BY blockDate DESC LIMIT " + page + ", 10", (error, result) => {
                    if (result && result.length) {
                        processResult(error, result)
                    }
                    else{
                        processResult(error, [])
                    }
                })
            } else {
                page = (page - 1) * 10;
                // console.log('page');
                trantor.db.query("SELECT DISTINCT ref FROM wordToReference WHRERE instr(wordHash, '" + find + "') > 0 ORDER BY blockDate DESC LIMIT " + page + ", 10", (error, result) => {
                    if (result && result.length) {
                        processResult(error, result)
                    }
                    else{
                        processResult(error, [])
                    }
                });
            }
        });
    }
}

trantor.creadeal = function(data, cb) {
    let pubkeys = [],
        nsigns = data.members;
    console.log(parseInt(nsigns), JSON.stringify(data.pubkeys));
    CREA_crea_cmd('createmultisig', parseInt(nsigns), data.pubkeys, function(result) {
        console.log("Result", result);
        cb({result: result});
    })
}

trantor.smartdeal = function(datos, cb) {
    let data = {
        pubkeys: [],
        members: datos.members
    };
    if (datos) {
        let keys = Object.keys(datos);
        console.log("keys", keys);
        for (var i = 0; i < keys.length; i++) {
            let value = datos[keys[i]];
            console.log("Value", value);
            if (keys[i].includes('pubkey')) {
                data.pubkeys.push(value)
            }
        }
    }
    console.log("Data data", data);
    let resp = trantor.creadeal(data, function(result) {
        cb(result);
    });
}

trantor.findaddr = function(find, cb) {
    trantor.db.query("SELECT * FROM addrtotx WHERE addr='" + addr + "' ", (error, result) => {
        let datos = [];

        function processResult(i) {
            let data = result[i];
            datos[i]['ref'] = data['tx'];
            datos[i]['transaction'] = data['tx'];
            datos[i]['date'] = data['date'];
            getDecodedTransaction(data['tx'], function(decodedtx) {
                datos[i]['decode'] = decodedtx;
                datos[i]['raw'] = decodedtx.hex;
            })
            if (i == result.length - 1) {
                cb(datos);
            }
        }
        processResult(0);
    });
}

trantor.getcontracts = function(type, ref, cback) {
    let transactions = {};
    let dataf = {};

    trantor.db.query("SELECT * FROM contracttx WHERE type LIKE '" + type + "' AND ctx LIKE '" + ref + "' ", (error, result) => {
        function processResult(i) {
            let data = result[i];
            transactions[data['ctx']] = transactions[data['ctx']] ? transactions[data['ctx']]: {};

            transactions[data['ctx']]['data'] = data.data;;
            transactions[data['ctx']]['ntx'] = data['ntx'];
            transactions[data['ctx']]['date'] = data['date'];
            if (i == result.length-1) {
                dataf['transactions'] = transactions;
                dataf['ncontracts'] = Object.keys(transactions).length;
                cback(dataf);
            }
        }
        if (result.length) {
            console.log(result);
            processResult(0);
        }
        else {
            dataf['transactions'] = null;
            dataf['ncontracts'] = 0;
            cback(dataf)
        }
    })
}

trantor.getData = function(ref, cb) {
    let transactions = [];
    let dataf = {};


    trantor.getDataFromReference(ref, function(data) {
        console.log("data", data);
        dataf['transactions'] = transactions;
        dataf['content'] = data;
        cb(dataf);
    });
    // trantor.db.all("SELECT * FROM transactionToReference WHERE ref LIKE '" + ref + "'", (error, result) => {
    //   function getDataFromRef(ref) {
    //     trantor.getDataFromReference(ref, function(data) {
    //       console.log("data", data);
    //       dataf['transactions'] = transactions;
    //       dataf['content'] = JSON.parse(data);
    //       cb(dataf);
    //     });
    //   }
    //
    //   function processResult(i) {
    //     let data = result[i];
    //     transactions.push(data.transaction);
    //     if (i == result.length - 1) {
    //       getDataFromRef();
    //     }
    //   }
    //   if (result.length) {
    //     processResult(0);
    //   }
    //   else {
    //     getDataFromRef(ref);
    //   }
    // })
}

trantor.findOp = function(find, cb) {
    let datos = [];

    function processResults(results) {
        function processResult(i) {
            let data = results[i];
            datos[i]['ref'] = data['ref'];
            datos[i]['transaction'] = data['transaction'];
            datos[i]['date'] = data['date'];
            CREA_crea_cmd('getrawtransaction', data['ref'], function(raw) {
                datos[i]['raw'] = raw;
                CREA_crea_cmd('decoderawtransaction', raw, function(decoded) {
                    datos[i]['decode'] = decoded;

                    if (i < results.length - 1) {
                        processResult(i);
                    } else if (i == results.length - 1) {
                        cb(datos);
                    }
                });
            });
        }
        processResult(0);
    }

    trantor.db.query("SELECT * FROM transactionToReference WHERE ref LIKE '" + find + "'", (error, result) => {
        if (result && result.length > 0) {
            processResults(result);
        } else {
            trantor.db.all("SELECT * FROM addrtotx WHERE tx LIKE '" + $find + "'", (error, result2) => {
                processResults(result2);
            })
        }
    })
}

trantor.spend = function(addr, redeem, amount, sendto, members, cback) {
    console.log(addr, redeem, amount, sendto);
    var network = bitcoin.networks.creativecoin;
    var tx = new bitcoin.TransactionBuilder(network);
    let fee = 0.002;
    let total = 0,
        signs = 0,
        inputs = [],
        args = {},
        args2 = {},
        argsF = [];
    trantor.listunspent(addr, function(tospend) {
        for (let spend in tospend) {
            if (spend !== "total") {
                if (total < amount) {
                    console.log(tospend, tospend[spend]);
                    tx.addInput(spend, tospend[spend].index);
                    inputs.push({txid: spend, vout: tospend[spend].index});
                    total = total + tospend[spend]['amount'];
                }
            }
        }
        if (total < amount) {
            alert('Multiadress ['+addr+'] has no funds.')
        }
        else{
            try {
                if (parseFloat(total) == (parseFloat(amount) + parseFloat(fee))) {
                    tx.addOutput(sendto[0].getAddress(), parseFloat(amount) * 100000000);
                } else {
                    tx.addOutput(sendto[0].getAddress(), parseInt(parseFloat(amount) * 100000000))
                    tx.addOutput(addr, parseFloat(total) * 100000000 - (parseFloat(amount) + parseFloat(fee)) * 100000000);
                }
                $.each(sendto, function(key, value) {
                    tx.sign(parseFloat(key), sendto[key]);
                    signs++;
                });

                // CREA_crea_cmd('verifymessage', false, tx.build().toHex())


                console.log(tx.build().toHex());
                console.log(tx.build().getId());

                if (signs == members) {
                    cback(tx.build().toHex(), true, signs);
                }
                else {
                    cback(tx.build().toHex(), false, signs);
                }

            } catch (e) {
                cback({error: 'There is some error, maybe you cant sign this.'})
            }
            // args[sendto[0].getAddress()] = parseFloat(amount);
            // args[addr]   = total - parseFloat(amount);
            // console.log("Args", inputs, args);
            // CREA_crea_cmd('createrawtransaction', false, inputs, args, function(raw_result) {
            //   console.log("raw_result", raw_result);
            //   cback(raw_result);
            // })
        }
    });
}


trantor.pushTx = function(rawtx, cb) {
    CREA_crea_cmd('sendrawtransaction', rawtx, cb)
}


let subcommand = args[0];
if (subcommand) {
    switch (subcommand) {
        case 'test':
            trantor.db.run('INSERT INTO lastexplored (blockhash, untilblock, date) VALUES ("asadasd", "asldjlkasjd", "123")', (_ ,data) => {console.log(_, data)});
            break;
        case 'getAddress':
            trantor.getAddress(args[1], function (data) {
                console.log("Address: ", JSON.stringify(data, null, 3));
            })
            break;
        case 'explore':
            console.log(exploreBlocks());
            break;
        case 'getdatafromref':
            console.log("getDataFromReference \n");
            trantor.getDecodedTransaction(args[1], function (decoded) {
                getDataFromReference2(decoded, function(result) {
                    console.log("ASDASDs", result);
                    return null;
                });
            })
            break;
        case 'getdatatx':
            console.log(getOPcrea(args[1]));
            break;
        case 'datastore':
            OP_RETURN_store(args[1]);
            break;
        case 'findWord':
            findWord(args[1], args[2], function(result) {
                console.log("RESULT", result);
            })
            break;
        case 'listunspent':
            // console.log('Unspent');
            listunspend2(args[1], function(unspent) {
                console.log("unspent: ", JSON.stringify(unspent, null, 2));
            })
            break;
    }
}
