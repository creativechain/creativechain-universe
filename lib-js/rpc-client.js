
/* RPC Creativecoin client */

const bitcoincli = require('bitcoin');

class RpcCaller {
    constructor(options) {
        this.options = Object.assign({
            port: 17711,
            host: '127.0.0.1',
            path: '/',
            strict: true,
            pass: ''
        }, options);

        // Create a rpc client
        this.client = new bitcoincli.Client(this.options);
    }
    call(opts, cb){
        // Calls rpc client with received command, and parameters
        this.client.cmd(opts.command, ...opts.params, function(err, response, resHeaders){
            cb(response, err, resHeaders)
        });
    }
}

if (module) {
    module.exports = RpcCaller;
}
