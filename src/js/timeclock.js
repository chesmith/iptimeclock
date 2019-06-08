const util = require('./util.js');
const team = require('./team.js');
const nodemailer = require('nodemailer');

module.exports = {
    isClockedIn: function (id, callback) {
        let sql = 'SELECT * FROM punches WHERE memberid = ? ORDER BY id DESC';
        util.dbexec(sql, [id], (err, rows) => {
            let clockedIn = (rows.length > 0 && rows[0].punchtype == 1);
            callback(clockedIn);
        });
    },

    clockIn: function (id, callback) {
        let sql = 'INSERT INTO punches (memberid, punchtype) VALUES (?, 1)';
        util.dbexec(sql, [id], (err, results) => {
            if (callback) callback(err, new Date());
        });
    },

    clockOut: function (id, callback) {
        let sql = 'INSERT INTO punches (memberid, punchtype) VALUES (?, 0)'
        util.dbexec(sql, [id], (err, results) => {
            if (callback) callback(err, new Date());
        });
    },

    clockOutAll: function (callback) {
        team.load((teamMembers) => {
            teamMembers.forEach((member) => {
                if (member.active && member.punchtype == 1) {
                    this.clockOut(member.id);
                }
            });
            if (callback) callback();
        });
    },

    generateReport: function (fromdate, todate, callback) {
        //TODO: allow for date/time range
        const fs = require('fs');
        let reportfile = `report.${Date.now()}.csv`
        let sql = `SELECT m.*, p.punchtype, p.created as punchtime
                    FROM teammembers as m, punches as p
                    WHERE m.id = p.memberid AND m.active AND NOT m.deleted
                      AND p.created between ? and ?
                    ORDER BY m.id, p.created`;
        util.dbexec(sql, [fromdate.format('YYYY-MM-DD'),todate.format('YYYY-MM-DD')], (err, rows) => {
            if (!err) {
                rows.forEach((row) => {
                    let punchtype = (row.punchtype == 1 ? 'in' : 'out');
                    let punchtime = new Date(Date.parse(row.punchtime));

                    fs.appendFileSync(`reports/${reportfile}`, `${row.id},${row.lastname},${row.firstname},${row.role},${punchtype},${punchtime.toLocaleDateString()} ${util.formatTime(punchtime)}\r\n`);
                });
            }

            callback(err, reportfile);
        });
    },

    sendReport: function (reportfile, callback) {
        util.checkOnlineStatus((err, online) => {
            if(!err) {
                if (online != 0) {
                    callback(`No internet connectivity.  Attempting to connect and retry every 3 seconds...`);
                    util.connectWifi((retry, maxretries) => {
                        if (typeof retry == 'undefined') {
                            util.emailMentors('IP Timeclock Report', 'IP Timeclock Report', [{ filename: reportfile, path: `reports/${reportfile}` }]);
                            callback('Report transmitted');
                        }
                        else {
                            callback(`Retry ${retry} of ${maxretries}...`);
                        }
                    });
                }
                else {
                    //TODO: there might not be any mentors with email addresses configured - in this case, it will save but not "transmit", so show appropriate message
                    util.emailMentors('IP Timeclock Report', 'IP Timeclock Report', [{ filename: reportfile, path: `reports/${reportfile}` }]);
                    callback('Report transmitted');
                }
            }
            else {
                console.error(err);
            }
        });
    }
}