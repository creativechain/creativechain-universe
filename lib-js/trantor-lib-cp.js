
/* Imports */
const fs          = require('fs');
// const HttpsCaller = require('./https-caller');
const RpcClient   = RpcCaller;
const sqlite3     = require('sqlite3').verbose();
const exec        = require('child_process').exec;

/* CONSTANTS */
const CREA_API_URL                  = 'search.creativechain.net';
const CREA_RPC_IP                   = '127.0.0.1';
const CREA_RPC_PORT                 = '19037';
const CREA_RPC_USER                 = 'keff';
const CREA_RPC_PASSWORD             = '12345678';
const CREA_USE_CMD                  = false;      // use command-line instead of JSON-RPC?
const OP_RETURN_MAX_BLOCKS          = 10;         // maximum number of blocks to try when retrieving data
const OP_RETURN_MAX_BYTES           = 1000;       // maximum bytes in an OP_RETURN (40 as of Bitcoin 0.10)
const OP_RETURN_BTC_DUST            = 0.002;      // omit BTC outputs smaller than this
const OP_RETURN_BTC_FEE             = 0.004;      // BTC fee to pay per transaction
const OP_RETURN_NET_TIMEOUT_CONNECT = 5;          // how long to time out when connecting to bitcoin node
const OP_RETURN_NET_TIMEOUT_RECEIVE = 10;         // how long to time out retrieving data from bitcoin node

const args  = process.argv.slice(2);
const db    = new sqlite3.Database('C:/Users/keff/Desktop/cosas/Dev/cretive-chain/creativechain-web/crea-test.db');
const https = new HttpsCaller({host: CREA_API_URL, port: 3001});
const rpc   = new RpcClient({port: CREA_RPC_PORT, host: CREA_RPC_IP, 'user': CREA_RPC_USER, 'pass': CREA_RPC_PASSWORD});

// console.log  = function(){
//   let args = [].slice.apply(arguments)
//   fs.appendFileSync('log.txt', JSON.stringify(args, null, 2), 'utf8')
// }
let trantor = {};
let subcommand = args[0];
if (subcommand) {
  switch (subcommand) {
    case 'explore':
      console.log(creaExplore());
      break;
    case 'listsinceblock':
      CREA_crea_cmd('listsinceblock', 0, args[1], function(response){
        console.log("listsinceblock", JSON.stringify(response, null, 2));
        for (var i = 0; i < response.transactions.length; i++) {
          let tx_id = response.transactions[i];
          let blockhash = tx_id.blockhash;
          let blocktime = tx_id.blocktime;
          console.log("transaction: ", tx_id);
          if (tx_id) {
            getDecodedTransaction(tx_id.txid, decodedtx => {
              // fs.appendFileSync('lo.g.txt', `DecodeTX: ${JSON.stringify(decodedtx, null, 2)}\n`, 'utf8')
              console.log('\nTx: ', JSON.stringify(decodedtx, null, 2));
              if (decodedtx) {
                for (let vintx of decodedtx.vin) {
                  if (vintx.txid) {
                    getDecodedTransaction(vintx.txid, decodedintx => {
                      console.log('\nVinTx: ', decodedintx);
                      let vinTxID = vintx.txid;
                      if (decodedintx && decodedintx['vout']) {
                        for(let vout of decodedintx['vout']){
                          console.log('VOUT ', vout);
                          if (vout['scriptPubKey'] && vout['scriptPubKey']['addresses']) {
                            for(let address of vout['scriptPubKey']['addresses']){
                              console.log("Address", address );
                              db.run("INSERT INTO addrtotx (addr, tx, amount, date, block) VALUES ('"+address+"', '"+vinTxID+"', '"+vout['value']+"', "+blocktime+", '"+blockhash+"')",
                              (error, row) => {
                                console.log('sql', error, row);
                              });
                            }
                          }
                        }

                      }
                      getdatafromref2(tx_id, function(response) {
                        let decodata = response;
                        console.log("Get datafrom ref", decodata);

                        if(decodata && decodata.contract){
                          db.run("INSERT INTO contracttx (ctx, ntx, addr, date, type, data) VALUES ('"+decodata[0].tx+"', '"+value['txid']+"', '', "+value['time']+", '"+decodata[0].contract+"', '"+txdata+"')");
                          // print_R($decodata);
                        }
                      });
                    })
                  }
                }
              }
            })
          }
        }
      })
      break;
    case 'getdatafromref':
      console.log("getDataFromReference \n");
      getdatafromref(args[1], function (result) {
        console.log(result);
      });
      break;
    case 'getdatatx':
      console.log(getOPcrea(args[1]));
      break;
    case 'datastore':
      OP_RETURN_store(args[1]);
      break;
    case 'findWord':
      findWord(args[1], args[2], function (result) {
        console.log("RESULT", result);
      })
      break;
    case 'listunspend':
      console.log('Unspent');
      listunspend(args[1], function (unspent) {
        console.log("unspent: ", JSON.stringify(unspent, null, 2));
      })
      break;
  }
}

function decode_utf8( s ) {
  return decodeURIComponent( escape( s ) );
}

function creaExplore(){
  console.log("EXPLORING CREA BLOCKS .... SYNC ... please wait ... \n");
  let lastblock;
  db.all("SELECT * FROM addrtotx ORDER BY date DESC LIMIT 0,1",
    (error, row) => {
      let block, blocks;
      lastblock = row[0];
      console.log('Lastblock', lastblock);
      https.call('GET', '/api/getblockcount', null, (blockcount) => {
        console.log(blockcount)
        if(lastblock && lastblock['block']){
          console.log("ahs block", blockcount);
          CREA_crea_cmd('getblockhash', false, blockcount, (starthash) => {
            console.log("starthash", starthash);
            // listsinceblock(starthash);
            listsinceblock(starthash, lastblock['block']);//add lastblock['block']
          })
        }
        else{
          console.log("Else");
          CREA_crea_cmd('getblockhash', false, blockcount, (starthash) => {
            console.log("starthash", starthash);
            listsinceblock(starthash);
          })
        }
      })
    });
}

function getdatafromref(ref, cb){
  // console.log("//aaaa//\\\\////&&&&&_____");
  getDecodedTransaction(ref, function(decoraw) {
    console.log("Decoded", JSON.stringify(decoraw, null ,2));
    let txdata = '';
    if (decoraw && decoraw['vout']) {
      for (let vout of decoraw['vout']) {
        console.log('REF: ', vout);
        if(vout['scriptPubKey']['hex']){
          txdata += vout['scriptPubKey']['hex'];
        }
      }
    }
    // console.log("Hex", txdata);
    txdata = (new Buffer(txdata, 'hex')).toString('utf8');
    console.log("TXDATA DECODED: ", txdata);
    txdata = txdata.split('-CREA-');
    try {
      let txids = JSON.parse(txdata[1]);
      var opdata = '';
      if (txids) {
        if (txids.txids) {
          function iterateTxs(i) {
            let txid = txids.txids[i];
            // console.log("TXID", txid)
            getDecodedTransaction(txid, function(decodedTx) {
              // console.log('\n\n\n\ndecodedTx'+i, decodedTx, '\n\n\n\n')
              if (decodedTx) {
                for(let v of decodedTx['vout']){
                  if(v['scriptPubKey']['type']=="nulldata"){
                    let opdataP = (new Buffer(v['scriptPubKey']['hex'], 'hex')).toString('utf8');
                    opdataP = opdataP.split('-CREA-');
                    opdata += opdataP[1];
                  }
                }
              }
              if (i < txids.txids.length-1) {
                iterateTxs(++i);
              }
              else{
                console.log("Finished", opdata);
                cb(opdata, ref);
              }
            })
          }
          iterateTxs(0);
        }
        else {
          // console.log("TXDATA", txdata[1]);
          if(cb) cb(null)
        }
      }
    } catch (e) {
      if(cb) cb(null)
    }

  })
}
function getdatafromref2(decoraw, cb){
  // console.log("//aaaa//\\\\////&&&&&_____");
  // getDecodedTransaction(ref, function(decoraw) {
    // console.log("Decoded", JSON.stringify(decoraw, null ,2));
    let txdata = '';
    if (decoraw && decoraw['vout']) {
      for (let vout of decoraw['vout']) {
        // console.log('REF: ', vout);
        if(vout['scriptPubKey']['hex']){
          txdata += vout['scriptPubKey']['hex'];
        }
      }
    }
    // console.log("Hex", txdata);
    txdata = (new Buffer(txdata, 'hex')).toString('utf8');
    // console.log("TXDATA DECODED: ", txdata);
    txdata = txdata.split('-CREA-');
    try {
      let txids = JSON.parse(txdata[1]);
      var opdata = '';
      if (txids) {
        if (txids.txids) {
          function iterateTxs(i) {
            let txid = txids.txids[i];
            // console.log("TXID", txid)
            getDecodedTransaction(txid, function(decodedTx) {
              // console.log('\n\n\n\ndecodedTx'+i, decodedTx, '\n\n\n\n')
              if (decodedTx) {
                for(let v of decodedTx['vout']){
                  if(v['scriptPubKey']['type']=="nulldata"){
                    let opdataP = (new Buffer(v['scriptPubKey']['hex'], 'hex')).toString('utf8');
                    opdataP = opdataP.split('-CREA-');
                    opdata += opdataP[1];
                  }
                }
              }
              if (i < txids.txids.length-1) {
                iterateTxs(++i);
              }
              else{
                // console.log("Finished", opdata);
                cb(opdata, decoraw.txid);
              }
            })
          }
          iterateTxs(0);
        }
        else {
          // console.log("TXDATA", txdata[1]);
          if(cb) cb(null)
        }
      }
    } catch (e) {
      if(cb) cb(null)
    }

  // })
}
function getDecodedTransaction(tx_id, cb){
  CREA_crea_cmd('getrawtransaction', false, tx_id, (rawtx) => {
      CREA_crea_cmd('decoderawtransaction', false, rawtx, (decodedtx) => {
        if (decodedtx) {
          cb(decodedtx);
        }
        else {
          https.call('GET', '/api/getrawtransaction?txid='+tx_id+'&decrypt=1', [],
           ((cb, decodedtx) => {
             if (!decodedtx) {
               getDecodedTransaction(tx_id, cb);
             }
             else cb(decodedtx);
           }).bind(this, cb))
        }
      });
  });
}
function listsinceblock(starthash, lastblock){
  function listBlock(starthash){

    // CREA_crea_cmd('getblock', 0, starthash, (block) => {
    //   console.log("Listing tx for: " , block);
    //   let blockhash = block.hash;
    //   let blocktime = block.time;
    //   function processBlockTx(i){
    //     let tx_id = block.tx[i];
    //     console.log("transaction: ", tx_id);
    //
    //     if (tx_id) {
    //       getDecodedTransaction(tx_id, decodedintx => {
    //
    //         /* Cojo los vouts de la transaccion */
    //         if (decodedintx && decodedintx['vout']) {
    //           // console.log('\nVinTx: ', JSON.stringify(decodedintx, null, 2));
    //           let vinTxID = decodedintx.txid;
    //           for(let vout of decodedintx['vout']){
    //             // console.log('VOUT ', vout);
    //             if (vout['scriptPubKey'] && vout['scriptPubKey']['addresses']) {
    //               for(let address of vout['scriptPubKey']['addresses']){
    //                 console.log("Address", address );
    //                 db.run("INSERT INTO addrtotx (addr, tx, amount, date, block, vin, vout) VALUES ('"+address+"', '"+vinTxID+"', '"+vout['value']+"', "+blocktime+", '"+blockhash+"', "+0+", "+1+")",
    //                 (error, row) => {
    //                   console.log('sql', error, row);
    //                 });
    //               }
    //             }
    //           }
    //         }
    //
    //         /* Cojo los vouts de los vins de la transaccion */
    //         if (decodedintx && decodedintx['vin']) {
    //           for(let vin of decodedintx['vin']) {
    //             getDecodedTransaction(vin.txid, vindeco => {
    //               if (vindeco && vindeco.vout) {
    //                 let vinTxID = decodedintx.txid;
    //                 // console.log("vindeco", vindeco);
    //                 for(let vout of vindeco['vout']){
    //                   // console.log('VOUT VIN ', vout);
    //                   if (vout['scriptPubKey'] && vout['scriptPubKey']['addresses']) {
    //                     for(let address of vout['scriptPubKey']['addresses']){
    //                       // console.log("Address", address );
    //                       db.run("INSERT INTO addrtotx (addr, tx, amount, date, block, vin, vout) VALUES ('"+address+"', '"+vinTxID+"', '"+vout['value']+"', "+blocktime+", '"+blockhash+"', "+1+", "+0+")",
    //                         (error, row) => {
    //                           // console.log('sql', error, row);
    //                         });
    //                     }
    //                   }
    //                 }
    //               }
    //             })
    //           }
    //         }
    //
    //         if (i < block.tx.length-1) {
    //           processBlockTx(++i);
    //         }else if(block.previousblockhash && block.previousblockhash != lastblock && block.previousblockhash != starthash){
    //           listBlock(block.previousblockhash);
    //         }
    //       })
    //     }
    //     else if (i < block.tx.length-1) {
    //       processBlockTx(++i);
    //     }
    //   }
    //   processBlockTx(0);
    // })
    // https.call('GET', '/api/getblock?hash='+starthash, null, (b) => {
    CREA_crea_cmd('getblock', 0, starthash, (b) => {
      if (b) {
        let block = b;
        let blockhash = block.hash;
        let blocktime = block.time;
        console.log((new Date()).toLocaleString()+" ["+block.height+"] ["+block.tx.length+"] - Listing tx for: " , block.hash);
        // console.log('Block tx count: ', block.tx.length)
        if(block.previousblockhash && block.previousblockhash != lastblock && block.previousblockhash != starthash){
          listBlock(block.previousblockhash);
        }
        function processBlockTx(i){
          let tx_id = block.tx[i];

          if (tx_id) {
            // console.log("transaction: ("+i+")", tx_id);
            getDecodedTransaction(tx_id, decodedintx => {
              // console.log('TX: ', decodedintx);
              /* Cojo los vouts de la transaccion */
              if (decodedintx && decodedintx['vout']) {
                let vinTxID = decodedintx.txid;
                decodedintx.vout.forEach(vout => {
                  if (vout['scriptPubKey'] && vout['scriptPubKey']['addresses']) {
                    vout['scriptPubKey']['addresses'].forEach(address => {
                      db.run("INSERT INTO addrtotx (addr, tx, amount, date, block, vin, vout, n) VALUES ('"+address+"', '"+vinTxID+"', '"+vout['value']+"', "+blocktime+", '"+blockhash+"', "+0+", "+1+", "+vout.n+")",
                      (error, row) => {
                        // console.log('sql', error, row);
                      });
                    })
                  }
                })
              }

              /* Cojo los vouts de los vins de la transaccion */
              if (decodedintx && decodedintx['vin']) {
                decodedintx.vin.forEach(vin => {
                  getDecodedTransaction(vin.txid, vindeco => {
                    if (vindeco && vindeco.vout) {
                      let vinTxID = decodedintx.txid;
                      // console.log("vindeco", vindeco);
                      vindeco.vout.forEach(vout => {
                        // console.log('VOUT VIN ', vout);
                        if (vout['scriptPubKey'] && vout['scriptPubKey']['addresses']) {
                          vout['scriptPubKey']['addresses'].forEach(address => {
                            db.run("INSERT INTO addrtotx (addr, tx, amount, date, block, vin, vout, n) VALUES ('"+address+"', '"+vinTxID+"', '"+vout['value']+"', "+blocktime+", '"+blockhash+"', "+1+", "+0+", "+vout.n+")",
                            (error, row) => {
                              // console.log('sql', error, row);
                            });
                          })
                        }
                      })
                    }
                  })
                })
              }
              // let ref = decodedintx.txid;
              getdatafromref2(decodedintx, function(data, ref) {
                if (data) {
                  try{
                    data = JSON.parse(data);
                    // console.log('DATA: '+data);
                    if (data.title) {
                      let wordsInTitle = data.title.split(' ');
                      for (var i = 0; i < wordsInTitle.length; i++) {
                        let word = wordsInTitle[i];
                        console.log("WORD", word);
                        db.run("INSERT INTO wordToReference (wordHash, 'ref', blockDate, 'order') VALUES ('"+word+"', '"+ref+"', "+blocktime+", "+i+")",
                          (error, row) => {
                            console.log('sql', error, row);
                          });
                        }
                    }

                    if(data.contract){
                      db.run("INSERT INTO contracttx (ctx, 'ntx', addr, 'date', type, data) VALUES ('"
                      +data.tx+"', '"+ref+"', '', '"+blocktime+"', '"+data.contract+"', '"+JSON.stringify(data)+"')",
                        (error, row) => {
                          // console.log('sql', error, row);
                        });
                    }
                  }
                  catch(e){
                    console.log("Error");
                  }
                }
              })

              if (i < block.tx.length-1) {
                processBlockTx(++i);
              }
            })
          }
          else if (i < block.tx.length-1) {
            processBlockTx(++i);
          }
        }
        processBlockTx(0);

      }
      else{
        listBlock(starthash);
      }
    })
  }
  listBlock(starthash)
}
function listunspend(addr, cback){
  let unspent = {
    total: 0
  };
  var cb = cback;
  https.call('GET', '/ext/getaddress/'+addr, null, (raw_result) => {
    console.log("Address: ", JSON.stringify(raw_result, null, 2));
    if (!raw_result.error) {
      function processLTX(i) {
        let ltx = raw_result.last_txs[i];
        if (ltx && ltx.type) {
          console.log("LTC("+i+"): ", ltx)
          getDecodedTransaction(ltx.addresses,
            tx => {
              // console.log("LTx addresses", JSON.stringify(tx, null, 3));
              if (tx) {
                console.log("txVoutLength: "+tx.vout.length);

                for(let vout of tx.vout){
    							//print_R($value3->addresses);
                  console.log('VOUT', JSON.stringify(vout, null, 3));
                  // console.log(
                  //   `
                  //     vout.scriptPubKey.addresses[0]: ${vout.scriptPubKey.addresses[0]}
                  //     addr: ${addr}
                  //   `
                  // );
    							if(vout.scriptPubKey.addresses && vout.scriptPubKey.addresses[0] == addr){
                    console.log("____ vout", vout.n)
                    if (!unspent[ltx.addresses]) {
                      unspent[ltx.addresses] = {};
                    }
    								unspent[ltx.addresses]['scriptPubKey'] = vout.scriptPubKey.hex;
    								unspent[ltx.addresses]['amount'] = vout.value;
    								unspent['total'] = unspent['total'] + vout.value;
    							}
    						}
              }
              if(i <= raw_result.last_txs.length-1){
                processLTX(++i);
              }
              else{
                cb(unspent);
                console.log("LastTxsLength: "+raw_result.last_txs.length);
                console.log(unspent);
              }
            })
        }
        else if(i <= raw_result.last_txs.length-1){
          processLTX(++i);
        }
        else{
          console.log("LastTxsLength: "+raw_result.last_txs.length);
          console.log('second cb', unspent);
          cb(unspent);
        }
      }
      processLTX(0);
    }
    else {
      console.log('Firwst cb');
      cb(raw_result)
    }
  })
}
function listunspend2() {
  db.all("SELECT * FROM addrtotx WHERE addr='CQ6Mcxt5cwPFm67hZb6XmdBNwdMfqfRBv3' ", (error, row) => {
    console.log('RES', error, row);
  });
}
/*
  CREA_crea_cmd
    arg[0] command: string
    arg[1] testnet: boolean
    - other arguments passed here will be treated as the parameters for the cmd
    arg[last] cback: function *(must be in last position)
      will be called with arguments (response, error)
*/
function CREA_crea_cmd(){
  let args    = [].slice.apply(arguments);
  let cback   = args.pop();
  let command = args[0];
  let testnet = args[1];

  let params = args.slice(2);

  if (CREA_USE_CMD) {
    let command = OP_RETURN_BITCOIN_PATH + ' ' + (testnet ? '-testnet ' : '') + escapeshellarg(command);
    for (let arg in args) {
      command += ' '.escapeshellarg( arg.map ? JSON.stringify(arg) : arg );
    }
    exec(command, function (error, raw_result, stderr) {
      if (error !== null) {
        console.log('exec error: ' + error, stderr);
      }
      let result = JSON.parse(raw_result); // decode JSON if possible
      if (!result) {
        result = raw_result;
      }
      console.log(result);
    });
  }
  else {
    let requestOpts = {
      'id': getID(),
      'command': command,
      'params': params,
      'user': CREA_RPC_USER,
      'pass': CREA_RPC_PASSWORD
    }
    rpc.call(requestOpts, cback);
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
    }
    else{
      let strLength = data.length;
      if (strLength == 0){
        if(cd) cb({'error': 'Some data is required to be stored'});
      }
      let output_amount = OP_RETURN_BTC_FEE * Math.ceil(strLength / OP_RETURN_MAX_BYTES);
      output_amount     = output_amount + (OP_RETURN_BTC_DUST * Math.ceil(strLength / OP_RETURN_MAX_BYTES));

      OP_RETURN_select_inputs(output_amount, testnet, function (inputs_spend) {
        if (inputs_spend.error) {
          return cb(inputs_spend);
        }
        let inputs       = inputs_spend['inputs'];
    		let input_amount = inputs_spend['total'];
        console.log('No errior', inputs_spend)
        https.call('GET', '/api/getblockcount', null, (blockcount) => {
          console.log('BlcokCount', blockcount);
          CREA_crea_cmd('getrawmempool', testnet, null, response => {
            console.log("getrawmempool", response)

            let result = {};

            for (let data_ptr = 0; data_ptr < strLength; data_ptr += OP_RETURN_MAX_BYTES) {
        			CREA_crea_cmd('getrawchangeaddress', testnet, null, change_address => {
                console.log('change_address', change_address);
                let last_txn = ((data_ptr + OP_RETURN_MAX_BYTES) >= strLength); // is this the last tx in the chain?
          			let change_amount = input_amount - OP_RETURN_BTC_FEE;
                let metadata = data.substring(data_ptr, OP_RETURN_MAX_BYTES - 6);
                metadata = "-CREA-"+metadata;

                let outputs = {};
                outputs[change_address] = change_amount;
                OP_RETURN_create_txn(inputs, outputs, metadata, last_txn ? outputs.length : 0, testnet,
                  raw_txn => {
                    console.log("Created TX", raw_txn)
                    OP_RETURN_sign_send_txn(raw_txn, testnet,
                      send_result => {

                      });
                  });
              });
        		}
          })
        })
      });
    }
  })
}
function OP_RETURN_select_inputs(total_amount, testnet, cb) {
  CREA_crea_cmd('listunspent', testnet, 0, unspent_inputs => {
    console.log('listunspent');
    console.log(unspent_inputs);

    if (!unspent_inputs || unspent_inputs.length <= 0){
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
    if (input_amount < total_amount){
      console.log('Not enough funds are available to cover the amount and fee');
      return {'error': 'Not enough funds are available to cover the amount and fee'};
    }
    //	Return the successful result
    if(cb) cb({
			'inputs': inputs_spend,
			'total': input_amount,
		})
  });
}
function OP_RETURN_bitcoin_check(testnet, cb) {
  CREA_crea_cmd('getinfo', testnet, function (response) {
    cb(response);
  });
}
function OP_RETURN_create_txn(inputs, outputs, metadata, metadata_pos, testnet){
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
function OP_RETURN_sign_send_txn(raw_txn, testnet, cb){
  OP_RETURN_bitcoin_cmd('signrawtransaction', testnet, raw_txn,
  signed_txn => {
    if (!signed_txn['complete']){
      console.log({'error': 'Could not sign the transaction'});
      return {'error': 'Could not sign the transaction'}
    }

    OP_RETURN_bitcoin_cmd('sendrawtransaction', testnet, signed_txn['hex'],
      send_txid => {
        if (send_txid.length != 64)
          return {'error': 'Could not send the transaction txid: ' + send_txid+' raw: ' + send_txid};
        else if(cb){
          cb({txid: send_txid});
        }
      });
  });
}
function OP_RETURN_unpack_txn(binary, cb){
  return OP_RETURN_unpack_txn_buffer(new OP_RETURN_buffer(binary), cb);
}
function getOPcrea(txid){
  console.log("TXID: ", txid);
  CREA_crea_cmd('gettransaction', 0, txid, rawtx => {
    console.log("rawtx", rawtx);
  });
}

// Utils
function escapeshellarg(arg) {
  var ret = '';
  ret = arg.replace(/[^\\]'/g, function (m, i, s) {
    return m.slice(0, 1) + '\\\''
  })
  return "'" + ret + "'"
}
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}
function hex2str(str) {
  var arr = [];
  for (var i = 0, l = str.length; i < l; i ++) {
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
function addslashes (str) {
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
function OP_RETURN_sort_by(parameter, item_a, item_b){
  if (a[parameter] < b[parameter])
    return -1;
  if (a[parameter] > b[parameter])
    return 1;
  return 0;
}

trantor.findWord = function (findWord, page, cback) {
  // $findWord=addslashes($_POST['findWord']);
  console.log("findWord");
  var cb = cback;
  findWord = findWord ? addslashes(findWord): null;
  page = page ? addslashes(page.replace(/(<([^>]+)>)/ig,"")): null;
  function processResult(error, result) {
    console.log("RESULT", error, result);
    let numrows = result.length;
    // let i = 0;
    let data = {
      content: []
    };

    function processResultElem(i){
      let elem = result[i];
      console.log("I", i, result.length);
      data[i] = {
        ref: elem.ref,
        count: numrows
      }
      getDecodedTransaction(elem.ref, function(decoref) {
        getdatafromref2(decoref, function (refdata) {
          console.log(refdata);
          db.all("SELECT * FROM contracttx WHERE ctx LIKE '"+refdata['ref']+"' AND type LIKE 'like' ORDER BY date DESC",
          function (error, likes) {
            console.log("Likes", error, likes);
            data[i] = {
              like: likes.length
            }
          })
          db.all("SELECT * FROM contracttx WHERE ctx LIKE '"+refdata['ref']+"' AND type LIKE 'unlike' ORDER BY date DESC",
          function (error, unlikes) {
            data[i] = {
              unlike: unlikes.length
            }
          })
          db.all("SELECT * FROM contracttx WHERE ctx LIKE '"+data['ref']+"' ORDER BY date DESC",
          function (error, contracts) {
            data[i] = {
              contracts: contracts.length
            }
          })

          if (refdata != '') {

            data[i] = {
              content: refdata
            }
            // console.log("Content", data);
          }
          if (i < result.length-1) {
            processResultElem(++i);
          }
          else {
            console.log("Cbac");
            cb(data);
          }
        })
      })
    }
    processResultElem(0);
  }
  // processResult.bind(this);
  if(!findWord){
    if (!page) {
      page = 0;
      db.all("SELECT DISTINCT ref FROM wordToReference  ORDER BY blockDate DESC LIMIT "+page+", 10", (error, result) => {
          processResult(error, result)
      })
    }
    else {
      page = (page-1)*10;
      db.all("SELECT DISTINCT ref FROM wordToReference  ORDER BY blockDate DESC LIMIT "+page+", 10", (error, result) => {
        processResult(error, result)
      });
    }
  }
  else {
    let i = 0;
    findWord = findWord.split(' ').join('|');
    console.log("ESLE");
    db.all("SELECT DISTINCT ref FROM wordToReference WHERE instr(wordHash, '"+findWord+"') > 0  ORDER BY blockDate DESC", (error, result) => {
      if (!page) {
        page = 0;
        console.log("No page", findWord);
        db.all("SELECT DISTINCT ref FROM wordToReference WHERE instr(wordHash, '"+findWord+"') > 0 ORDER BY blockDate DESC LIMIT "+page+", 10", (error, result) => {
          processResult(error, result)
        })
      }
      else {
        page = (page-1)*10;
        console.log('page');
        db.all("SELECT DISTINCT ref FROM wordToReference WHRERE instr(wordHash, '"+findWord+"') > 0 ORDER BY blockDate DESC LIMIT "+page+", 10", (error, result) => {
          processResult(error, result)
        });
      }
    });
  }
}
