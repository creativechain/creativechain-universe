/**
 * Created by ander on 22/06/17.
 */

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
        return localStorage.getItem('first_use');
    }

    /**
     *
     * @param {boolean} firstUse
     */
    static setFirstUse(firstUse) {
        localStorage.setItem('first_use', firstUse);
    }

    static isNodeCorrectlyRunning() {
        return localStorage.getItem('node_running');
    }

    static setNodeCorrectlyRunning(running) {
        localStorage.setItem('node_running', running);
    }

}

if (module) {
    module.exports = {Utils, Environment};
}

