var http = require('http');

class HttpsCaller {
  constructor(config) {
    this.config = config;
  }
  call(method, path, params = [], cb) {
    // console.log("HTTPS, call", path);
    const options = {
      host: this.config.host,
      port: this.config.port,
      path: path,
      method: method,
      headers: {
        "Accept": 'application/json',
        "Content-Type": 'application/json'
      }
    }
    function callback(response) {
      var data = '';

      //another chunk of data has been recieved, so append it to `str`
      response.on('data', function (chunk) {
        data += chunk;
      });

      //the whole response has been recieved, so we just print it out here
      response.on('end', function () {
        let d;
        try {
          d = JSON.parse(data);
          cb(d);
        } catch(e){
          cb(null);
        }
      });


    }
    let req = http.request(options, callback);
    req.on('error', function(err) {
      if (err.code === "ETIMEDOUT") {
          cb(null);
      }
    });
    if (method == 'POST') req.write(JSON.stringify(params));
    req.end();
  }
}
if (module) {
  module.exports = HttpsCaller;
}
