const rpc        = require('node-json-rpc');
const webtorrent = require('webtorrent');
const lzma       = require("lzma");
const hbjs       = require("handbrake-js");
const sharp      = require("sharp");


var options = {
    // int port of rpc server, default 5080 for http or 5433 for https
    port: 5080,
    // string domain name or ip of rpc server, default '127.0.0.1'
    host: '127.0.0.1',
    // string with default path, default '/'
    path: '/',
    // boolean false to turn rpc checks off, default true
    strict: true
};

// Create a server object with options
var client = new rpc.Client(options);

console.log('Renderer', client)