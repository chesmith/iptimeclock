const util = require('./util.js');
const team = require('./team.js');

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
                        member.punchtype = 0;
                        this.clockOut(member.id);
                    }
                });
                if (callback) callback(teamMembers);
            }
        });
    },

    generateDetailReport: function (fromdate, todate, callback) {
        const fs = require('fs');
        let reportfile = `report.${Date.now()}.csv`;
        if (!fs.existsSync('reports')) fs.mkdirSync('reports');

        let _fromdate = moment(fromdate).startOf('day');
        let _todate = moment(todate).endOf('day');
        if (fromdate == null) _fromdate = moment('1/1/2000', 'M/D/YYYY');
        if (todate == null) _todate = moment().endOf('day');

        let sql = `SELECT m.id, m.lastname, m.firstname, m.role, p.id as punchid, p.punchtype, p.created as punchtime
                    FROM teammembers as m, punches as p
                    WHERE m.id = p.memberid AND m.active AND NOT m.deleted
                      AND p.created between ? and ?
                    ORDER BY m.id, p.id`;
        util.dbexec(sql, [_fromdate.format('YYYY-MM-DD HH:mm:ss'), _todate.format('YYYY-MM-DD HH:mm:ss')], (err, rows) => {
            if (!err) {
                if(rows.length > 0)
                    fs.appendFileSync(`reports/${reportfile}`, `Member ID,Punch ID,Last Name,First Name,Role,Type,Date/Time\r\n`);
                rows.forEach((row) => {
                    let punchtype = (row.punchtype == 1 ? 'in' : 'out');
                    let punchtime = moment(row.punchtime);

                    fs.appendFileSync(`reports/${reportfile}`, `${row.id},${row.punchid},"${row.lastname}","${row.firstname}",${row.role},${punchtype},${punchtime.format('M/D/YYYY H:mm:ss')}\r\n`);
                });
            }

            callback(err, reportfile);
        });
    },

    sendReport: function (fromdate, todate, reportfile, summary, mentorId, displayMessage) {
        util.checkOnlineStatus((err, online) => {
            if (!err) {
                if (online == 0)
                    sendEmail();
                else {
                    displayMessage(`No internet connection`);
                }
            }
            else
                console.error(err);
        });

        function sendEmail() {
            displayMessage('Sending email...');
            let now = moment().format('M/D/YYYY h:mm a');
            let from = moment(fromdate).format('M/D/YYYY');
            let to = moment(todate).format('M/D/YYYY');
            util.emailMentors(
                {subject: `IP Timeclock Report: ${now}`,
                    body: `<p>Report timeframe ${from} to ${to}</p><b>Summary</b><br/>${summary}`,
                    attachments: [{ filename: reportfile, path: `reports/${reportfile}` }],
                    triggeredBy: mentorId}, (err, message) => {
                if (!err)
                    displayMessage(message);
                else
                    displayMessage(`Error in transmission: ${err}`)
            });
        }
    },

    generateSummaryReport: function (fromdate, todate, callback) {
        let html = '';

        let _fromdate = moment(fromdate).startOf('day');
        let _todate = moment(todate).endOf('day');
        if (fromdate == null) _fromdate = moment('1/1/2000', 'M/D/YYYY');
        if (todate == null) _todate = moment().endOf('day');

        let sql = `SELECT m.id, m.lastname, m.firstname, p.id as punchid, p.punchtype, p.created as punchtime
                    FROM teammembers as m, punches as p
                    WHERE m.id = p.memberid AND m.active AND NOT m.deleted
                      AND p.created between ? and ?
                    ORDER BY m.lastname, m.firstname, m.id, p.id`;
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

                    html = '<i>By Name</i><br/><table>';
                    data.forEach((d, id) => {
                        let totalhours = (d.total / 1000 / 60 / 60).toFixed(2);
                        html += `<tr><td style='padding-right: 10px'>${d.lastname}, ${d.firstname}</td><td>${totalhours} hours</td>`;
                    });
                    html += '</table>';
                    
                    let sorted = new Map([...data.entries()].sort((a, b) => (a[1].total < b[1].total) || (a[1].total === b[1].total ? 0 : -1)));
                    html += '<p></p><i>By Hours</i><br/><table>';
                    sorted.forEach((d, id) => {
                        let totalhours = (d.total / 1000 / 60 / 60).toFixed(2);
                        html += `<tr><td style='padding-right: 10px'>${d.lastname}, ${d.firstname}</td><td>${totalhours} hours</td>`;
                    });
                    html += '</table>';
                }
                else {
                    html = '<p>No punches found in that date range</p>';
                }

                callback(err, html);
            }
            else
                callback(err, '');
        });
    }
}