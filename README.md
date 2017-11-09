![Creativechain Media](https://www.creativechain.org/wp-content/uploads/2016/04/Logo-cretivechain-header-2.2.png)

## UNIVERSE

#### Dev

###### Install

* `nvm install v8.9.0` - Use node v8.9.0 to compile.
* `sudo npm install -g electron` - Install electron globally so you can use it from command-line. If you have an issue when you
try install electron so use `sudo npm install -g electron --unsafe-perm=true --allow-root`.
* `npm install` - You may need to remove npm_modules folder first.


###### Launch app DEV
* Launch dev app:  `<app_path>$ electron .`
* More documentation of electron [here](https://github.com/electron/electron)

###### Compile app
* Linux:
    `npm run build-linux`.
* Windows:
    `npm run build-win`.
* Mac OS X:
    `npm run build-mac`.

* Uses [electron-packager](https://github.com/electron-userland/electron-packager) to compile

Authors: Vicent Nos Ripolles, Manolo Edge Tejero, Andersson G. Acosta de la Rosa

## License

```
The MIT License

Copyright 2017 Vicent Nos Ripolles, Manolo Edge Tejero, Andersson G. Acosta de la Rosa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
