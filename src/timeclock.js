const electron = require('electron');
const ipc = electron.ipcRenderer;

const mysql = require('mysql');

module.exports = {
    isClockedIn: function(id, callback) {
        let clockedIn = false;
        var con = mysql.createConnection({
            host: "localhost",
            user: "***REMOVED***",
            password: "***REMOVED***",
            database: "TIMECLOCK"
        });

        con.connect(function(err) {
            if(err) {
                console.log('error connecting to db');
            }
            else {
                con.query(`SELECT * FROM punches WHERE memberid = ${id} ORDER BY id DESC`, function (err, rows) {
                    if (!err) {
                        if(rows.length > 0) {
                            clockedIn = (rows[0].punchtype == 1);
                        }
                    }
                    else {
                        console.log(err);
                    }
                    con.end();
                    console.log(`${Date.now()}: ${clockedIn}`);
                    callback(clockedIn);
                });
            }
        });
    },

    clockIn: function clockIn(id, callback) {
        let success = dbinsert(`INSERT INTO punches (memberid, punchtype) VALUES (${id}, 1)`);
        callback(new Date());
    },

    clockOut: function clockOut(id, callback) {
        let success = dbinsert(`INSERT INTO punches (memberid, punchtype) VALUES (${id}, 0)`);
        callback(new Date());
    },

    clockOutAll: function clockOutAll(role) {
        console.log(`clocking out all ${role}s`);
    }
}

function dbinsert(sql) {
    let success = true;
    var con = mysql.createConnection({
        host: "localhost",
        user: "***REMOVED***",
        password: "***REMOVED***",
        database: "TIMECLOCK"
    });

    con.connect(function(err) {
        if(err) {
            console.log('error connecting to db');
            success = false;
        }
        else {
            con.query(sql, function (err, results) {
                if (!err) {
                    success = true;
                }
                else {
                    console.log(err);
                    success = false;
                }
                con.end();
            });
        }
    });

    return success;
}