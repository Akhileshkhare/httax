const express = require("express");
const pool = require("../db");
const authenticateToken = require("../auth");

const router = express.Router();

// Send notification
router.post('/send',authenticateToken, async (req, res) => {
    const { reg_id, operator_id, sent_by, send_notification,sent_date } = req.body;
    console.log('Send notification Data : ',req.body);
    try {
        const query = `
            INSERT INTO htax_user_notification (reg_id, operator_id, sent_by, send_notification, sent_date)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [notifications] =  await pool.execute(query, [reg_id, operator_id, sent_by, send_notification,sent_date]);   
        console.log('Send notification : ',req.body,notifications);     
        res.status(201).json({ message: 'Notification sent successfully' });
    } catch (error) {
        console.log('notification error : ',error);     

        res.status(500).json({ message: 'Failed to send notification', error });
    }
});
// // Get notifications
// router.get('/', async (req, res) => {
//     const { userId, role } = req.query;
//     console.log('Get notification Data : ',userId, role);

//     try {
//         let query = `
//             SELECT id, reg_id, operator_id, sent_by, send_notification, sent_date
//             FROM htax_user_notification
//             WHERE ${role === 'Operator' ? 'operator_id' : 'reg_id'} = ?
//             ORDER BY sent_date DESC
//         `;        
//         const [notifications] = await pool.execute(query, [userId]);        
//         res.status(200).json({ notifications });
//     } catch (error) {
//         res.status(500).json({ message: 'Failed to retrieve notifications', error });
//     }
// });
// Get notifications
router.get('/', async (req, res) => {
    const { userId, role } = req.query;
    console.log('Get notification Data : ', userId, role);

    try {
        let query = `
            SELECT n.id, 
                   n.reg_id, 
                   n.operator_id, 
                   n.sent_by, 
                   n.send_notification, 
                   n.sent_date, 
                   IF(n.sent_by = 0, o.operator_name, CONCAT(r.first_name, ' ', r.last_name)) AS sender_name
            FROM htax_user_notification n
            LEFT JOIN htax_operator o ON n.operator_id = o.operator_id  -- Join to get operator name when sent_by = 0
            LEFT JOIN htax_registrations r ON n.reg_id = r.reg_id  -- Join using reg_id to get user name when sent_by = 1
            WHERE ${role === 'Operator' ? 'n.operator_id' : 'n.reg_id'} = ?
            ORDER BY n.sent_date DESC
        `;
        
        const [notifications] = await pool.execute(query, [userId]);        
        
        res.status(200).json({ notifications });
    } catch (error) {
        console.error('Error retrieving notifications:', error);
        res.status(500).json({ message: 'Failed to retrieve notifications', error });
    }
});

module.exports = router;
