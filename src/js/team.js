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
                    ORDER BY if(role!='Mentor',1,2), lastname`;
        util.dbexec(sql, [], (err, results) => {
            callback(err, results);
        });
    },

    add: function (firstname, lastname, email, passcode, role, created_by, callback) {
        if (passcode.startsWith('*')) {
            //technically not possible, but if somehow we receive this "user has a passcode and it's not being updated" indicator, be sure we don't write the "*" placeholder to the db
            let sql = 'INSERT INTO teammembers (firstname, lastname, email, role, created_by) VALUES (?, ?, ?, ?, ?)';
            util.dbexec(sql, [firstname, lastname, email, role, created_by], (err, id) => {
                callback(err, id);
            });
        }
        else {
            let sql = 'INSERT INTO teammembers (firstname, lastname, email, role, created_by) VALUES (?, ?, ?, ?, ?)';
            util.dbexec(sql, [firstname, lastname, email, role, created_by], (err, id) => {
                if (!err) {
                    let pass = (passcode.length == 0 ? '' : util.getHash(id + passcode));
                    if (pass.length > 0) {
                        sql = 'UPDATE teammembers SET passcode = ? WHERE id = ?';
                        util.dbexec(sql, [pass, id], (err) => callback(err, id));
                    }
                    else
                        callback(err, id);
                }
                else
                    callback(err, id);
            });
        }
    },

    update: function (id, firstname, lastname, email, passcode, role, active, updated_by, callback) {
        if (passcode.startsWith('*')) {
            let sql = 'UPDATE teammembers SET firstname = ?, lastname = ?, email = ?, role = ?, active = ?, updated_by = ? WHERE id = ?';
            util.dbexec(sql, [firstname, lastname, email, role, active, updated_by, id], (err, results) => {
                callback(err);
            });
        }
        else {
            let pass = (passcode.length == 0 ? '' : util.getHash(id + passcode));
            let sql = 'UPDATE teammembers SET firstname = ?, lastname = ?, email = ?, passcode = ?, role = ?, active = ?, updated_by = ? WHERE id = ?';
            util.dbexec(sql, [firstname, lastname, email, pass, role, active, updated_by, id], (err, results) => {
                callback(err);
            });
        }
    },

    delete: function (id, callback) {
        let sql = 'UPDATE teammembers SET deleted = true WHERE id = ?';
        util.dbexec(sql, [id], (err, results) => {
            callback(err);
        });
    }
}