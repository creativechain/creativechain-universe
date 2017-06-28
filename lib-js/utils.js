/**
 * Created by ander on 22/06/17.
 */

const files = require('fs');

class Utils {
    /**
     *
     * @param length
     * @returns {string}
     */
    static randomString(length) {
        var string = "";
        var chars =  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvqxyz";

        for (var x = 0; x < length; x++) {
            string += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return string;
    }
}

class Environment {

    /**
     * @returns {boolean}
     */
    static isFirstUse() {
        return FileStorage.getItem('first_use');
    }

    /**
     *
     * @param {boolean} firstUse
     */
    static setFirstUse(firstUse) {
        FileStorage.setItem('first_use', firstUse);
    }

    static isNodeCorrectlyRunning() {
        return FileStorage.getItem('node_running');
    }

    static setNodeCorrectlyRunning(running) {
        FileStorage.setItem('node_running', running);
    }

}

class FileStorage {

    /**
     *
     * @returns {Object}
     */
    static load() {
        try {
            let content = files.readFileSync('./app.conf', 'utf8');
            if (content != undefined && content != null && content != '') {
                return JSON.parse(content);
            }
        } catch (err) {
            console.log('app conf not exist', err);
        }
        return {};
    }

    static save(conf) {
        console.log('Saving conf', conf);
        files.writeFileSync('./app.conf', JSON.stringify(conf), 'utf8');
    }

    /**
     *
     * @param {string} key
     * @param value
     */
    static setItem(key, value) {
        var conf = FileStorage.load();
        conf[key] = value;
        FileStorage.save(conf);
    }

    /**
     *
     * @param key
     * @returns {*}
     */
    static getItem(key) {
        var conf = FileStorage.load();
        return conf[key];
    }
}

if (module) {
    module.exports = {Utils, Environment, FileStorage};
}

