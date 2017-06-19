
/* RPC Creativecoin client */

const bitcoin_ = require('bitcoin');

class RpcCaller {
  constructor(options) {
    this.options = Object.assign({
      port: 19037,
      host: '127.0.0.1',
      path: '/',
      strict: true
    }, options);

    // Create a rpc client
    this.client = new bitcoin_.Client(this.options);
  }
  call(opts, cb){
    // Calls rpc client with received command, and parameters
    this.client.cmd(opts.command, ...opts.params, function(err, response, resHeaders){
      cb(response, err)
    });
  }
}

if (module) {
  module.exports = RpcCaller;
}
