const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');

router.get('/published', blogController.getPublishedBlogs);
router.get('/slug/:slug', blogController.getBlogBySlug);
router.get('/', blogController.getAllBlogs);
router.post('/', blogController.createBlog);
router.put('/:id', blogController.updateBlog);
router.delete('/:id', blogController.deleteBlog);

module.exports = router;
