const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getUsers);            // GET /api/users
router.get('/email/:email', userController.getUserByEmail); // GET /api/users/email/:email
router.post('/', userController.createUser);         // POST /api/users
router.put('/:id', userController.updateUser);       // PUT /api/users/:id
router.delete('/:id', userController.deleteUser);    // DELETE /api/users/:id

module.exports = router;