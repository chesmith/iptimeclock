const mysql = require('mysql');
const crypto = require('crypto');
const dns = require('dns');
const http = require('http');
const wifi = require('node-wifi');
const querystring = require('querystring');
const nodemailer = require('nodemailer');
const fs = require('fs');
const config = require('./config.js');

const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
axiosCookieJarSupport(axios);

const cookieJar = new tough.CookieJar();

var electron = require('electron').remote;
if (typeof electron == 'undefined') { electron = require('electron'); }

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
            user: config.db.user,
            password: config.db.password,
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
                        con.query('SELECT LAST_INSERT_ID() as id', (err, results) => {
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

    getHash: function(value) {
        let hash = crypto.createHash('sha256');
        hash.update(value);
        return hash.digest('hex');
    },

    validatePasscode: function (id, passcode, callback) {
        let sql = 'SELECT passcode FROM teammembers WHERE id = ?';
        this.dbexec(sql, [id], (err, results) => {
            if (!err) {
                let valid = (results.length > 0 && (results[0].passcode == this.getHash(id + passcode)));
                callback(err, valid);
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

    emailMentors: function (reportOptions, displayMessage) {
        var transporter = nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            auth: { user: config.email.user, pass: config.email.pass },
            secure: config.email.secure
        });

        let sql = `SELECT * FROM teammembers WHERE role = 'Mentor' AND active AND LENGTH(IFNULL(email,'')) > 0;`;
        this.dbexec(sql, [], (err, results) => {
            if (!err) {
                let recipients = '';
                let triggerName = '';
                results.forEach((mentor) => {
                    if (recipients.length > 0) {
                        recipients += ',';
                    }
                    recipients += mentor.email;

                    if (reportOptions.triggeredBy == 'system')
                        triggerName = 'automated report';
                    else if (mentor.id == reportOptions.triggeredBy)
                        triggerName = `${mentor.firstname} ${mentor.lastname}`;
                });
                if (recipients.length > 0) {
                    var mailOptions = {
                        from: config.email.from,
                        to: recipients,
                        subject: reportOptions.subject,
                        html: `${reportOptions.body}<p>Report triggered by ${triggerName}</p>`
                    };

                    if (typeof reportOptions.attachments != 'undefined' && reportOptions.attachments.length > 0) {
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
    }
}