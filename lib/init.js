let control = require('electron').remote;

const SESSION_DURATION_MILLIS = 30 * 60 * 1000; //30 minutes;

if (!String.format) {
    /**
     *
     * @param {string} format
     * @return {*|void|XML|string}
     */
    String.format = function(format) {
        let args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    };
}

let timeout;

document.onmousemove = function () {
    clearTimeout(timeout);
    timeout = setTimeout(function () {
        let win = remote.getCurrentWindow();
        win.close();
    }, SESSION_DURATION_MILLIS) //Close app on 30 minutes for inactivity
};

function closeApp() {
    control.getCurrentWindow().close();
}

function minimize() {
    control.getCurrentWindow().minimize();
}

function maximize() {
    let win = control.getCurrentWindow();

    if (win.isMaximized()) {
        win.unmaximize();
    } else {
        control.getCurrentWindow().maximize();
    }
}