const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

var electron = require('electron').remote;
if(typeof electron == 'undefined') { electron = require('electron'); }

const keyPath = path.join(electron.app.getPath('userData'), 'key.txt');
console.log(`key path (1): ${keyPath}`);
if(!fs.existsSync(keyPath)) {
    //if file doesn't exist in the userData directory, assume dev mode
    keyPath = path.join(electron.app.getAppPath(), 'src/config/key.txt');
    console.log(`key  path (2): ${keyPath}`);
}

var configPath = path.join(electron.app.getPath('userData'), 'config.json');
console.log(`config path (1): ${configPath}`);
if(!fs.existsSync(configPath)) {
    //if file doesn't exist in the userData directory, assume dev mode
    configPath = path.join(electron.app.getAppPath(), 'config/config.json');
    console.log(`config path (2): ${configPath}`);
}

var data = JSON.parse(fs.readFileSync(configPath));

var config = {};

config.db = {
    host: data.db.host,
    user: decrypt(data.db.user),
    password: decrypt(data.db.password)
};

config.email = {
    host: decrypt(data.email.host),
    port: data.email.port,
    secure: data.email.secure,
    user: decrypt(data.email.user),
    pass: decrypt(data.email.pass),
    from: decrypt(data.email.from)
};

config.autoClockOutTime = data.autoClockOutTime;

config.nightlyReportTime = data.nightlyReportTime;

module.exports = config;

function encrypt(text) {
    let key = fs.readFileSync(keyPath, 'utf-8');
    let iv = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return { iv: iv.toString('hex'), data: encrypted.toString('hex') }
}

function decrypt(text) {
    if(text.length == 0) return '';

    let iv = text.substring(0,32);
    let data = text.substring(32);
    let key = fs.readFileSync(keyPath, 'utf-8');
    let encryptedText = Buffer.from(data, 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
}