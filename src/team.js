const util = require('./util.js');

module.exports = {
    load: function (callback) {
        let sql = `SELECT m.*, p2.punchtype, p2.created as punchtime
                    FROM teammembers as m
                    LEFT JOIN (SELECT memberid, MAX(id) AS maxid FROM punches as p GROUP BY memberid) AS p1
                    ON m.id = p1.memberid
                    LEFT JOIN punches AS p2
                    ON p2.id = p1.maxid
                    WHERE NOT m.deleted
                    ORDER BY if(role='student',1,2), lastname`;
        util.dbexec(sql, (err, results) => {
            if (!err) {
                callback(results);
            }
        });
    },

    add: function (firstname, lastname, email, role, callback) {
        let sql = `INSERT INTO teammembers (firstname, lastname, email, role)
                    VALUES ('${firstname}', '${lastname}', '${email}', '${role}')`;
        util.dbexec(sql, (err, results) => {
            if (!err) {
                callback(err, results);
            }
        });
    },

    update: function (id, firstname, lastname, email, role, active, callback) {
        let sql = `UPDATE teammembers SET
                    firstname = '${firstname}',
                    lastname = '${lastname}',
                    email = '${email}',
                    role = '${role}',
                    active = ${active}
                    WHERE id = ${id}`;
        util.dbexec(sql, (err, results) => {
            callback(err);
        });
    },

    delete: function (id, callback) {
        let sql = `UPDATE teammembers SET deleted = true WHERE id = ${id}`;
        util.dbexec(sql, (err, results) => {
            callback(err);
        });
    }
}