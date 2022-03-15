const express = require('express');
const router = express.Router();


const storyTemplate_controller = require('../controllers/storyTemplateController.js')


// GET request for creating a StoryTemplate.
router.get('/create', storyTemplate_controller.storyTemplate_create_get);

// POST request for creating a StoryTemplate.
router.post('/create', storyTemplate_controller.storyTemplate_create_post);

// GET request to delete a StoryTemplate.
router.get('/:id/delete', storyTemplate_controller.storyTemplate_delete_get);

// POST request to delete a StoryTemplate.
router.post('/:id/delete', storyTemplate_controller.storyTemplate_delete_post);

// GET request to update a StoryTemplate.
router.get('/:id/update', storyTemplate_controller.storyTemplate_update_get);

// POST request to update a StoryTemplate.
router.post('/:id/update', storyTemplate_controller.storyTemplate_update_post);

// GET request for one StoryTemplate.
router.get('/:id', storyTemplate_controller.storyTemplate_detail);

// GET request for list of all a StoryTemplate items.
router.get('/', storyTemplate_controller.storyTemplate_list);

function errorHandler(err, req, res, next) {
    console.log('Catch-All error handler in storyTemplates.', err)
    res.status(err.status || 500).send(err.message)
  }
  
router.use(errorHandler)

module.exports = router;