let {fork} = require('child_process');

let child = fork('./test//testProcess.js');
child.on('message', (data) => {
    console.log(data);
});

let count = 0;

function sendMessage() {
    setTimeout(function () {
        count++;
        child.send('Message ' + count);
        sendMessage();
    }, count * 1000);
}

sendMessage();
