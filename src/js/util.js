const mysql = require('mysql');
const crypto = require('crypto');
const dns = require('dns');
const http = require('http');
const wifi = require('node-wifi');
const axios = require('axios');
const querystring = require('querystring');
const nodemailer = require('nodemailer');
const config = require('./config.js');
const fs = require('fs');

var electron = require('electron').remote;
if(typeof electron == 'undefined') { electron = require('electron'); }
const keyPath = require('path').join(electron.app.getPath("userData"), 'key.txt');

module.exports = {
    formatTime: function (timeToFormat) {
        var hours = timeToFormat.getHours();
        var minutes = timeToFormat.getMinutes();
        var ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return hours + ':' + minutes + ' ' + ampm;
    },

    formatDate: function (dateToFormat) {
        var day = dateToFormat.getDay();
        var month = dateToFormat.getMonth();
        var year = dateToFormat.getYear();
        return month + '/' + day + '/' + year;
    },

    dbexec: function (sql, values, callback) {
        let con = mysql.createConnection({
            host: config.db.host,
            user: this.decrypt(config.db.user),
            password: this.decrypt(config.db.password),
            database: 'TIMECLOCK'
        });
        let insert = sql.toUpperCase().startsWith('INSERT');

        con.connect((err) => {
            if (err) {
                console.warn('error connecting to db');
            }
            else {
                con.query(sql, values, function (err, results) {
                    if (err) {
                        console.warn(err);
                    }
                    else if (!err && insert) {
                        con.query(`SELECT LAST_INSERT_ID() as id`, (err, results) => {
                            con.end();
                            callback(err, results[0].id);
                        });
                    }
                    else {
                        con.end();
                        callback(err, results);
                    }
                });
            }
        });
    },

    validatePasscode: function (id, passcode, callback) {
        let hash = crypto.createHash('sha256');
        hash.update(passcode);

        let sql = `SELECT COUNT(*) AS valid FROM teammembers WHERE role = 'mentor' AND id = ? AND passcode = ?`;
        this.dbexec(sql, [id, hash.digest('hex')], (err, results) => {
            if (!err) {
                callback(err, results[0].valid);
            }
            else {
                console.warn(`unable to validate passcode: ${err}`);
                callback(err, false);
            }
        });
    },

    checkOnlineStatus: function (callback) {
        //-1 = DNS lookup failure
        //0 = online (DNS lookup and HTTP GET match)
        //1 = HTTP GET error
        //2 = HTTP GET non-OK response (e.g. 404, 302, etc.)
        //3 = HTTP GET success, but response doesn't match
        //(2 or 3 may indicate need for in-browser wifi authentication)

        dns.lookup('dns.msftncsi.com', { family: 4, hints: dns.ADDRCONFIG | dns.V4MAPPED }, (err, address, family) => {
            //this is basically the same check Windows does
            if (!err && address == '131.107.255.255') {
                http.get('http://www.msftncsi.com/ncsi.txt', (resp) => {
                    const { statusCode } = resp;
                    if (statusCode !== 200) {
                        callback(err, 2);
                    }
                    else {
                        let data = '';
                        resp.on('data', (chunk) => { data += chunk; });
                        resp.on('end', () => {
                            if (data == 'Microsoft NCSI') {
                                callback(err, 0);
                            }
                            else {
                                callback(err, 3);
                            }
                        });
                    }
                }).on('error', (e) => {
                    callback(err, 1);
                });
            }
            else {
                callback(0, -1);
            }
        });
    },

    connectWifi: function (callback) {
        const maxretries = 10;

        wifi.init({
            iface: null
        });

        wifi.connect({ ssid: this.decrypt(config.wifi.SSID), password: this.decrypt(config.wifi.pass) }, (err) => {
            if (err) {
                console.error(`unable to connect to wifi: ${err}`);
            }
            else {
                //wait a moment to establish the connection
                setTimeout(() => {
                    let retry = 0;
                    let retryInterval = setInterval(() => {
                        retry++;
                        this.checkOnlineStatus((err, online) => {
                            console.info(`connect online: ${online} / retry: ${retry}`);
                            if (online == 0) {
                                clearInterval(retryInterval);
                                callback();
                            }
                            else if (online == 2 || online == 3) {
                                let data = querystring.stringify({
                                    username: this.decrypt(config.wifi.user),
                                    password: this.decrypt(config.wifi.pass),
                                    buttonClicked: '4'
                                });

                                axios.post(this.decrypt(config.wifi.portalUrl), data)
                                    .then((res) => {
                                        // clearInterval(retryInterval);
                                        // if(typeof callback != 'undefined') callback();
                                    })
                                    .catch((error) => {
                                        console.warn(`problem posting to capture portal: ${error}`);
                                    });
                            }

                            if (retry > maxretries) {
                                clearInterval(retryInterval);
                            }
                            else {
                                callback(retry, maxretries);
                            }
                        });
                    }, 3000);
                }, 5000);
            }
        });
    },

    emailMentors: function (reportOptions, displayMessage) {
        var transporter = nodemailer.createTransport({
            host: this.decrypt(config.email.host),
            port: config.email.port,
            auth: { user: this.decrypt(config.email.user), pass: this.decrypt(config.email.pass) },
            secure: config.email.secure
        });

        let sql = `SELECT * FROM teammembers WHERE role = 'mentor' AND active AND LENGTH(IFNULL(email,'')) > 0;`;
        this.dbexec(sql, [], (err, results) => {
            if (!err) {
                let recipients = '';
                let triggerName = '';
                results.forEach((mentor) => {
                    if (recipients.length > 0) {
                        recipients += ',';
                    }
                    recipients += mentor.email;

                    if(mentor.id == reportOptions.triggeredBy)
                        triggerName = `${mentor.firstname} ${mentor.lastname}`;
                });
                if (recipients.length > 0) {
                    var mailOptions = {
                        from: this.decrypt(config.email.from),
                        to: recipients,
                        subject: reportOptions.subject,
                        html: `${reportOptions.body}<p>Report triggered by ${triggerName}</p>`
                    };

                    if(typeof reportOptions.attachments != 'undefined' && reportOptions.attachments.length > 0) {
                        mailOptions['attachments'] = reportOptions.attachments;
                    }

                    transporter.sendMail(mailOptions, (err, info) => {
                        if (err) {
                            console.warn(`send email failure: ${err}`);
                            displayMessage(err, 'Failed to transmit report');
                        }
                        else {
                            console.info('email success');
                            displayMessage(err, 'Report transmitted');
                        }
                    });
                }
                else {
                    displayMessage(err, 'No active mentor email addresses - saved report to disk instead');
                }
            }
            else {
                console.error(err);
                displayMessage(err, '');
            }
        });
    },

    encrypt: function(text) {
        let key = fs.readFileSync(keyPath, 'utf-8');
        let iv = crypto.randomBytes(16);
        let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return { iv: iv.toString('hex'), data: encrypted.toString('hex') }
    },
    
    decrypt: function(text) {
        let iv = text.substring(0,32);
        let data = text.substring(32);
        let key = fs.readFileSync(keyPath, 'utf-8');
        let encryptedText = Buffer.from(data, 'hex');
        let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
}