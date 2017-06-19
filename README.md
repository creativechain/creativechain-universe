![Creativechain Media](https://www.creativechain.org/wp-content/uploads/2016/04/Logo-cretivechain-header-2.2.png)

### CREATIVECHAIN

#### Dev

###### Install

* `npm install` - You may need to remove npm_modules folder first
* After install is done you have to recompile **sqlite3** module for your platform, so it can be used from electron
  * `npm install -save-dev electron-builder`
  * `npm install -save sqlite3`
  * `npm run postinstall`
  * **electron-builder** doc [here](https://github.com/electron-userland/electron-builder/wiki/Multi-Platform-Build)


###### Launch app DEV
* Launch dev app:  `<app_path>$ electron .`
* More documentation on electron [here](https://github.com/electron/electron)

###### Compile app
* Compile:  `<app_path>$ node ./build.js -p=<platform> -a=<arch> -o='<outputPath>'`
    * `platform`: [windows, linux, mac]
    * `arch`: [windows: x64, ia32, linux: x86, x86_x64, mac: x64]
    * `outputPath`: the path to where to save builds to
    * if platform is omited it compiles for all platforms
    * **example** will compile for windows x64:
      ```
        $ node build.js -p=windows -a=x64 -o='./releases'
      ```
* Uses [electron-packager](https://github.com/electron-userland/electron-packager) to compile
