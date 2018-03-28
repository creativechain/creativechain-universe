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

## License

```
    GNU GPLv3
    
    Creativechain is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Creativechain is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Creativechain.  If not, see <http://www.gnu.org/licenses/gpl.html>.
```