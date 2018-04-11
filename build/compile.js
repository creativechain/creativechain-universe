let {OS, File} = require('../lib/trantor');
let git = require('nodegit');
let packageJson = require('../package.json');
let semver = require('semver');
let builder = require('electron-builder');

const PROJECT_DIR = __dirname + '/../';
let COMMIT = null;
let tag = packageJson.version;

/**
 *
 * @return {{appId: string, productName: string, directories: {app: string}, files: [string,string,string,string,string,string,string,string,string,string,string,string,string,string,string]}}
 */
function getBuildConfig() {
    return {
        appId: "net.creativechain.platform",
        productName: "Creativechain",
        directories: {
            app: "./"
        },
        files: [
            "**/*",
            "!bin",
            "!build",
            "!build.js",
            "!dist",
            "!resources",
            "!app.conf",
            "!session.crea",
            "!trantor.dat",
            "!database/index.db",
            "!database/index.db-journal",
            "extra/dbmigrations/",
            "extra/credentials.json",
            "extra/credentials_prod.json",
            "extra/index.db.sql"
        ]
    };
}

function build(config, platform, callback) {
    console.log('Compiling', tag, COMMIT, 'for', platform);
    builder.build({
        config: config,
        x64: true
    }).then(function () {
        console.log('Compilation for', platform, 'finished!');
        if (callback) {
            callback();
        }
    }).catch(function (err) {
        console.error('Compilation error', err);
    })
}

function compileMac() {

    let config = getBuildConfig();
    config.mac = {
        artifactName: "Creativechain-" + tag + "-" + COMMIT + "-osx.dmg",
        category: "public.app-category.entertainment",
        icon: PROJECT_DIR + "build/mac/icon/icon.icns",
        type: "distribution",
        target: "dmg"
    };

    build(config, 'Mac');
}

function compileWin() {
    console.log('Compiling', tag, COMMIT, 'for Windows');
    let config = getBuildConfig();
    config.win = {
        artifactName: "Creativechain-" + tag + "-" + COMMIT + "-win.exe",
        icon: PROJECT_DIR + "build/win/icon/icon.ico",
        target: "nsis"
    };

    build(config, 'Windows');
}

function compileLinux(generic = false) {
    let target = "deb";
    if (generic) {
        target = "tar.gz";
    }

    let config = getBuildConfig();
    //config.artifactName = 'Creativechain-' + tag + '-' + COMMIT + '-linux' + (generic ? '-generic-' : '') + '.' + target,
    config.linux = {
        artifactName: 'Creativechain-' + tag + '-' + COMMIT + '-linux' + (generic ? '-generic-' : '') + '.' + target,
        synopsis: "A blockchain project for the registration, authentication and distribution of digital free culture.",
        category: "Utility",
        executableName: "creativechain",
        icon: PROJECT_DIR + "build/linux/icon/",
        target: target,
    };

    if (generic) {
        build(config, 'Linux Generic');
    } else {
        build(config, 'Linux', function () {
            compileLinux(true);
        });
    }
}

function compile() {
       if (OS.isMac()) {
           compileMac();
       } else if (OS.isWindows()) {
           compileWin();
       } else if (OS.isLinux()) {
           compileLinux()
       } else {
           throw "Platform not valid to compile!";
       }
}

git.Repository.open(PROJECT_DIR)
    .then(function (repository) {
        repository.getHeadCommit()
            .then(function (commit) {

                COMMIT = commit.sha();
                git.Tag.list(repository)
                    .then(function (tags) {
                        tags.forEach(function (t) {
                            //console.log('Tag', t);
                            if (semver.valid(t)) {
                                if (semver.gt(t, tag)) {
                                    tag = t;
                                }
                            }
                        });

                        if (!tag.startsWith('v')) {
                            tag = 'v' + tag;
                        }

                        git.Reference
                            .lookup(repository, 'refs/tags/' + tag)
                            .then(function (ref) {
                                ref.peel(git.Object.TYPE.COMMIT)
                                    .then(function (ref2) {
                                        git.Commit.lookup(repository, ref2.id())
                                            .then(function (commit) {
                                                if (commit.sha() === COMMIT) {
                                                    COMMIT = '';
                                                } else {
                                                    COMMIT = COMMIT.substring(0, 7);
                                                }

                                                packageJson.buildVersion = COMMIT;
                                                //console.log(packageJson);
                                                File.write(PROJECT_DIR + 'package.json', JSON.stringify(packageJson, null, 2));
                                                compile();
                                        });
                                    })
                            });
                    })
            });
    });