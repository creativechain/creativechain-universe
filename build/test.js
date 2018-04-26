let fs = require('fs');

let file = __dirname + '/../main.js';
let mainjs = fs.readFileSync(file, 'utf8');

if (!mainjs.includes('//platformWindow.webContents.open')) {
    mainjs = mainjs.replace('platformWindow.webContents.open', '//platformWindow.webContents.open');
    fs.writeFileSync(file, mainjs, 'utf8');
}

console.log(process.argv);


