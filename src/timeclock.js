const util = require('./util.js');
const team = require('./team.js');

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

    generateReport: function () {
        let sql = `SELECT m.*, p.punchtype, p.created as punchtime
                    FROM teammembers as m, punches as p
                    WHERE m.id = p.memberid AND m.active AND NOT m.deleted
                    ORDER BY m.id, p.created`;
        util.dbexec(sql, [], (err, rows) => {
            rows.forEach((row) => {
                let punchtype = (row.punchtype == 1 ? 'in' : 'out');
                let punchtime = new Date(Date.parse(row.punchtime));
                
                console.log(`${row.id},${row.lastname},${row.firstname},${row.role},${punchtype},${punchtime.toLocaleDateString()} ${util.formatTime(punchtime)}`);

                //TODO: write this to a csv file (and email it?)
            })
        });
    }
}