let os = require('os');
let fs = require('fs');

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

/**
 *
 * @param {string} platform
 * @param {string} ext
 * @return {string}
 */
function getArtifactName(platform, ext) {
    let artifact = "Creativechain-" + tag;

    if (COMMIT && COMMIT.length > 0) {
        artifact += '-' + COMMIT;
    }

    artifact += '-' + platform;
    artifact += '.' + ext;

    return artifact;
}

/**
 *
 * @param {string} config
 * @param {string} platform
 * @param {function} callback
 */
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

        cleanBuildVersion();

    }).catch(function (err) {
        console.error('Compilation error', err);
    })
}

function compileMac() {

    let config = getBuildConfig();
    config.mac = {
        artifactName: getArtifactName('osx', 'dmg'),
        category: "public.app-category.entertainment",
        icon: PROJECT_DIR + "build/mac/icon/icon.icns",
        type: "distribution",
        target: "dmg"
    };

    build(config, 'Mac');
}

function compileWin() {
    let config = getBuildConfig();
    config.win = {
        artifactName: getArtifactName('win', 'exe'),
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
    let platform = generic ? 'linux-generic' : 'linux';

    config.linux = {
        artifactName: getArtifactName(platform, target),
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
       if (os.platform().toLowerCase().includes('darwin')) {
           compileMac();
       } else if (os.platform().toLowerCase().includes('win32')) {
           compileWin();
       } else if (os.platform().toLowerCase().includes('linux')) {
           compileLinux()
       } else {
           throw "Platform not valid to compile!";
       }
}

function setBuildVersion() {
    packageJson.buildVersion = COMMIT ? COMMIT : '';
    writePackage();
}

function cleanBuildVersion() {
    packageJson.buildVersion = "";
    writePackage();
}

function writePackage() {
    fs.writeFileSync(PROJECT_DIR + 'package.json', JSON.stringify(packageJson, null, 2));
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
                                                    COMMIT = null;
                                                } else {
                                                    COMMIT = COMMIT.substring(0, 7);
                                                }

                                                setBuildVersion();
                                                compile();
                                            });
                                    })
                            });
                    })
            });
    });