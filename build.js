'use strict';
var packager = require('electron-packager');
let appVersion = '1.0.0';
const args   = process.argv.slice(2);

let ignoreFolders = ['.idea', 'index.db', 'index.db-journal', 'crea-test-db-sql', 'app.conf', 'bin'];

function buildOptions(platform) {
    return {
        'arch': 'x64',
        'platform': platform,
        'dir': './',
        'ignore': ignoreFolders,
        'appCopyright': 'Creativechain 2017',
        'appVersion': appVersion,
        'asar': false,
        'icon': '1.ico',
        'name': 'Creativechain Universe',
        'out': './releases',
        'overwrite': true,
        'prune': true,
        'electronVersion': '1.4.7',
        'version-string': {
            'CompanyName': 'Creativechain',
            'FileDescription': 'Creativechain media explorer and wallet', /*This is what display windows on task manager, shortcut and process*/
            'OriginalFilename': 'CreativechainUniverse-' + platform + '-' + appVersion,
            'ProductName': 'Creativechain Universe',
            'InternalName': 'Creativechain Universe'
        }
    };
}
let optionsWindows = buildOptions('win32');
let optionsLinux = buildOptions('linux');
let optionsMac = buildOptions('darwin');

let options = {
    windows: optionsWindows,
    linux: optionsLinux,
    mac: optionsMac
};
let sArgs = args.join('--');

let platform   = sArgs.match('-p=([^-.]*)');
platform = platform ? platform[1]: null;

let arch       = sArgs.match('-a=([^-.]*)');
arch = arch ? arch[1]: null;

let outPath    = sArgs.match('-o=([^-.]*)');
outPath = outPath ? outPath[1]: null;


if (platform && !options[platform]) {
    console.log("ErrorCodes: platform ["+platform+"] is not valid.\n", "Please use one of the following: \n")
    console.log("Available Platforms: [windows, linux, mac]");
    return console.log("Available Architectures: [windows: x64 ia32, linux: x86 x86_x64, mac: x64]");
}
else if(!platform){
    let platforms = Object.keys(options);
    for (let i = 0; i < platforms.length; i++) {
        let opts = options[platforms[i]];
        if (arch) {
            opts.arch = arch;
        }
        if (outPath) {
            opts.out = outPath;
        }

        console.log("Building - "+opts.name+"("+opts.appVersion+")"+"...");
        console.log("   - ElectronVersion - "+opts.electronVersion);
        console.log("   - Platform        - "+(platform || opts.platform));
        console.log("   - Architecture    - "+(arch || opts.arch));
        console.log("\n");
        packager(opts, function done_callback(err, appPaths) {
            if (err) {
                console.log("\nThere has been an error Building["+opts.platform+"]("+(opts.arch)+": ", err);
            } else {
                console.log("\nBuild for "+opts.platform+"("+(opts.arch)+ ") completed. Status [OK]");
                console.log("You can find builds at '"+appPaths+"'");
            }

        });
    }
}
else {
    let opts = options[platform];
    if (arch) {
        opts.arch = arch;
    }
    if (outPath) {
        opts.out = outPath;
    }
    console.log("Building - "+opts.name+"("+opts.appVersion+")"+"...");
    console.log("   - ElectronVersion - "+opts.electronVersion);
    console.log("   - Platform        - "+platform);
    console.log("   - Architecture    - "+(arch || opts.arch));
    console.log("\n");

    packager(opts, function done_callback(err, appPaths) {
        if (err) {
            console.log("\nThere has been an error Building["+platform+"]("+(arch || opts.arch)+": ", err);
        }
        else {
            console.log("\nBuild for "+platform+"("+(arch || opts.arch)+ ") completed. Status ["+((appPaths != '') ? 'OK': 'FAIL')+"]");
            if((appPaths != '')) console.log("You can find builds at '"+appPaths+"'");
            else console.log("There has been an error with build. ErrorCodes should be shown above");
        }
    });

}
