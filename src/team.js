const mysql = require('mysql');

module.exports = {
    load: function load(populateList) {
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
            con.query("SELECT m.*, p2.punchtype, p2.created as punchtime FROM teammembers as m"
                    + " LEFT JOIN (SELECT memberid, MAX(id) AS maxid"
                    + " FROM punches as p GROUP BY memberid) AS p1"
                    + " ON m.id = p1.memberid"
                    + " LEFT JOIN punches AS p2"
                    + " ON p2.id = p1.maxid", function (err, results, fields) {
                if (!err) {
                    populateList(results);
                }
                else {
                    console.log(err);
                }
                con.end();
            });
        });
    }
}