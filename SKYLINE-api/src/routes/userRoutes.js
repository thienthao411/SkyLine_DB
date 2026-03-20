const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getUsers);            // GET /api/users
router.post('/register', userController.register);   // POST /api/users/register
router.post('/login', userController.login);         // POST /api/users/login
router.post('/forgot-password', userController.forgotPassword); // POST /api/users/forgot-password
router.post('/verify-otp', userController.verifyOtp); // POST /api/users/verify-otp
router.post('/reset-password', userController.resetPassword); // POST /api/users/reset-password
router.get('/rank-benefits', userController.getRankBenefits); // GET /api/users/rank-benefits
router.get('/email/:email', userController.getUserByEmail); // GET /api/users/email/:email
router.post('/', userController.createUser);         // POST /api/users
router.put('/:id', userController.updateUser);       // PUT /api/users/:id
router.delete('/:id', userController.deleteUser);    // DELETE /api/users/:id

module.exports = router;