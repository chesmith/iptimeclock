const mysql = require('mysql');
const crypto = require('crypto');

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

    dbexec: function(sql, callback) {
        let con = mysql.createConnection({ host: "localhost", user: "***REMOVED***", password: "***REMOVED***", database: "TIMECLOCK" });
        let insert = sql.toUpperCase().startsWith("INSERT");
    
        con.connect(function(err) {
            if(err) {
                console.log('error connecting to db');
            }
            else {
                con.query(sql, function (err, results) {
                    if (err) console.log(err);
                    if(!err && insert) {
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

    validatePasscode: function(id, passcode, callback) {
        let hash = crypto.createHash('sha256');
        hash.update(passcode);

        this.dbexec(`SELECT COUNT(*) AS valid FROM teammembers WHERE role = 'mentor' AND id = ${id} AND passcode = '${hash.digest('hex')}'`, (err, results) => {
            if(!err) {
                callback(err, results[0].valid);
            }
            else {
                console.log('db error - unable to validate passcode');
                callback(err, false);
            }
        });
    }
}