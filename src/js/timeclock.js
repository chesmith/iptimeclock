const util = require('./util.js');
const team = require('./team.js');
const nodemailer = require('nodemailer');

module.exports = {
    isClockedIn: function (id, callback) {
        let sql = 'SELECT * FROM punches WHERE memberid = ? ORDER BY id DESC';
        util.dbexec(sql, [id], (err, rows) => {
            let clockedIn = (!err && rows.length > 0 && rows[0].punchtype == 1);
            callback(err, clockedIn);
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
        team.load((err, teamMembers) => {
            if (!err) {
                teamMembers.forEach((member) => {
                    if (member.active && member.punchtype == 1) {
                        this.clockOut(member.id);
                    }
                });
                if (callback) callback();
            }
        });
    },

    generateReport: function (fromdate, todate, callback) {
        const fs = require('fs');
        let reportfile = `report.${Date.now()}.csv`

        let _fromdate = moment(fromdate).startOf('day');
        let _todate = moment(todate).endOf('day');
        if (fromdate == null) _fromdate = moment('1/1/2000', 'M/D/YYYY');
        if (todate == null) _todate = moment().endOf('day');

        let sql = `SELECT m.*, p.punchtype, p.created as punchtime
                    FROM teammembers as m, punches as p
                    WHERE m.id = p.memberid AND m.active AND NOT m.deleted
                      AND p.created between ? and ?
                    ORDER BY m.id, p.created`;
        util.dbexec(sql, [_fromdate.format('YYYY-MM-DD HH:mm:ss'), _todate.format('YYYY-MM-DD HH:mm:ss')], (err, rows) => {
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

    sendReport: function (reportfile, displayMessage) {
        util.checkOnlineStatus((err, online) => {
            if (!err) {
                if (online != 0) {
                    displayMessage(`No internet connectivity.  Attempting to connect and retry every 3 seconds...`);
                    util.connectWifi((retry, maxretries) => {
                        if (typeof retry == 'undefined') {
                            //TODO: this is repeated exactly below - separate to another function
                            util.emailMentors('IP Timeclock Report', 'IP Timeclock Report', [{ filename: reportfile, path: `reports/${reportfile}` }], (err, message) => {
                                if (!err) {
                                    displayMessage(message);
                                }
                                else {
                                    displayMessage(`Error in transmission: ${err}`)
                                }
                            });
                        }
                        else {
                            displayMessage(`Retry ${retry} of ${maxretries}...`);
                        }
                    });
                }
                else {
                    util.emailMentors('IP Timeclock Report', 'IP Timeclock Report', [{ filename: reportfile, path: `reports/${reportfile}` }], (err, message) => {
                        if (!err) {
                            displayMessage(message);
                        }
                        else {
                            displayMessage(`Error in transmission: ${err}`)
                        }
                    });
                }
            }
            else {
                console.error(err);
            }
        });
    },

    displaySummaryReport: function (fromdate, todate, targetDiv) {
        $(targetDiv).html('');

        let _fromdate = moment(fromdate).startOf('day');
        let _todate = moment(todate).endOf('day');
        if (fromdate == null) _fromdate = moment('1/1/2000', 'M/D/YYYY');
        if (todate == null) _todate = moment().endOf('day');

        let sql = `SELECT m.*, p.punchtype, p.created as punchtime
                    FROM teammembers as m, punches as p
                    WHERE m.id = p.memberid AND m.active AND NOT m.deleted
                      AND p.created between ? and ?
                    ORDER BY m.lastname, m.firstname, m.id, p.created`;
        util.dbexec(sql, [_fromdate.format('YYYY-MM-DD HH:mm:ss'), _todate.format('YYYY-MM-DD HH:mm:ss')], (err, rows) => {
            if (!err) {
                if (rows.length > 0) {
                    //TODO: ? look for aberrations or just calculate as-is?
                    let prevId = 0;
                    let punch_in = new Date();
                    let data = new Map();
                    rows.forEach((row) => {
                        let punchtype = (row.punchtype == 1 ? 'in' : 'out');
                        let punchtime = new Date(Date.parse(row.punchtime));
                        if (punchtype == 'in') {
                            punch_in = punchtime;
                        }
                        else {
                            //if curId != prevId, it's an orphan 'out' punch - ignore it
                            if (row.id == prevId) {
                                let total = (punchtime - punch_in);
                                let d = data.get(row.id);
                                if (typeof d != 'undefined') {
                                    total += d.total;
                                }
                                data.set(row.id, { lastname: row.lastname, firstname: row.firstname, total: total });
                            }
                        }
                        //TODO: ? track orphaned 'in' punches?

                        prevId = row.id;
                    });

                    $(targetDiv).append('<table>');
                    let toggle = true;
                    data.forEach((d, id) => {
                        let totalhours = (d.total / 1000 / 60 / 60).toFixed(2);
                        toggle = !toggle;
                        let background = (toggle ? '#444' : '#666');
                        $(targetDiv).append(`<tr style='background: ${background}'><td style='padding-right: 10px'>${d.lastname}, ${d.firstname} [${id}]</td><td>${totalhours} hours</td>`);
                    });
                    $(targetDiv).append('</table>');
                }
                else {
                    $(targetDiv).html('<p>No punches found in that date range</p>');
                }
            }
        });
    }
}