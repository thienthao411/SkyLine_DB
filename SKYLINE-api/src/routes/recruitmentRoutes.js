const express = require('express');
const router = express.Router();
const recruitmentController = require('../controllers/recruitmentController');
const { recruitmentUpload } = require('../upload');

const handleCvUpload = (req, res, next) => {
  recruitmentUpload.single('cv')(req, res, (error) => {
    if (error) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    next();
  });
};

router.get('/jobs', recruitmentController.getJobs);
router.post('/jobs', recruitmentController.createJob);
router.put('/jobs/:id', recruitmentController.updateJob);
router.delete('/jobs/:id', recruitmentController.deleteJob);

router.get('/applications', recruitmentController.getApplications);
router.post('/applications', handleCvUpload, recruitmentController.createApplication);
router.patch('/applications/:id/status', recruitmentController.updateApplicationStatus);
router.get('/activities', recruitmentController.getActivities);

module.exports = router;
