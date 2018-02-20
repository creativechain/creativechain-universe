if (!String.format) {
    /**
     *
     * @param {string} format
     * @param args
     * @return {*|void|XML|string}
     */
    String.format = function(format, ...args) {
        let splitter = '%s';
        let parts = format.split(splitter);
        console.log('String format', parts);
        let newFormat = '';

        for (let x in parts) {
            let r = args[x];
            if (!r) {
                r = ''
            }

            newFormat += parts[x];
            newFormat += r;
        }

        return newFormat;

        /*        let args = Array.prototype.slice.call(arguments, 1);
                return format.replace(/{(\d+)}/g, function(match, number) {
                    return typeof args[number] !== 'undefined' ? args[number] : match;
                });*/
    };
}

if (!String.hexEncode) {
    /**
     *
     * @param {string} str
     * @return {String}
     */
    String.hexEncode = function (str) {
        return Buffer.from(str, 'utf8').toString('hex');
    }
}

if (!String.hexDecode) {
    /**
     *
     * @param {string} hex
     * @return {String}
     */
    String.hexDecode = function (hex) {
        return Buffer.from(hex, 'hex').toString('utf8');
    }
}

String.prototype.isEmpty = function() {
    return (this.length === 0 || !this.trim());
};

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

/**
 @return {Array.<T>}
 */
Array.prototype.clone = function () {
    let b = [];
     this.forEach(function (i) {
         b.push(i);
     });

    return b;
};

Array.prototype.isEmpty = function () {
    return this.length === 0;
};