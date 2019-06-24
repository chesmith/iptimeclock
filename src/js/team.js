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
        util.dbexec(sql, [], (err, results) => {
            callback(err, results);
        });
    },

    add: function (firstname, lastname, email, passcode, role, created_by, callback) {
        if (passcode.startsWith('*')) {
            //technically not possible
            let sql = 'INSERT INTO teammembers (firstname, lastname, email, role, created_by) VALUES (?, ?, ?, ?, ?)';
            util.dbexec(sql, [firstname, lastname, email, role, created_by], (err, results) => {
                callback(err, results);
            });
        }
        else if (passcode.length == 0) {
            let sql = 'INSERT INTO teammembers (firstname, lastname, email, passcode, role, created_by) VALUES (?, ?, ?, ?, ?, ?)';
            util.dbexec(sql, [firstname, lastname, email, passcode, role, created_by], (err, results) => {
                callback(err, results);
            });
        }
        else {
            let sql = 'INSERT INTO teammembers (firstname, lastname, email, passcode, role, created_by) VALUES (?, ?, ?, SHA2(?,256), ?, ?)';
            util.dbexec(sql, [firstname, lastname, email, id + passcode, role, created_by], (err, results) => {
                callback(err, results);
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
        else if (passcode.length == 0) {
            let sql = 'UPDATE teammembers SET firstname = ?, lastname = ?, email = ?, passcode = ?, role = ?, active = ?, updated_by = ? WHERE id = ?';
            util.dbexec(sql, [firstname, lastname, email, passcode, role, active, updated_by, id], (err, results) => {
                callback(err);
            });
        }
        else {
            let sql = 'UPDATE teammembers SET firstname = ?, lastname = ?, email = ?, passcode = SHA2(?,256), role = ?, active = ?, updated_by = ? WHERE id = ?';
            util.dbexec(sql, [firstname, lastname, email, id + passcode, role, active, updated_by, id], (err, results) => {
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