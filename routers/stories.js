const express = require('express');
const router = express.Router();

const story_controller = require('../controllers/storyController.js');
const story_random = require('../controllers/storyRandom.js');
const sequencing_controller = require('../controllers/sequencingController.js');


// GET request for creating an Story. NOTE This must come before routes that display Story (uses id).
router.get('/create', story_controller.story_create_get);

// POST request for creating Story.
router.post('/create', story_controller.story_create_post);

// GET request for a random Story.
router.get( '/fromTemplate', story_random.story_fromTemplate_get );

// POST request for a random Story.
router.post( '/fromTemplate', story_random.story_fromTemplate_post );

// GET request to delete Story.
router.get('/:id/delete', story_controller.story_delete_get);

// POST request to delete Story.
router.post('/:id/delete', story_controller.story_delete_post);

// GET request to update Story.
router.get('/:id/update', story_controller.story_update_get);

// POST request to update Story.
router.post('/:id/update', story_controller.story_update_post);

// GET request to cut a story into sequences.
router.get('/:id/sequencing/create', sequencing_controller.sequencing_create_get);

// POST request to cut astory into sequences.
router.post('/:id/sequencing/create', sequencing_controller.sequencing_create_post);

// GET request to change the sequencing of a story.
router.get('/:id/sequencing/update', sequencing_controller.sequencing_update_get);

// POST request to change the sequencing of a story.
router.post('/:id/sequencing/update', sequencing_controller.sequencing_update_post);

// GET request to remove the sequencing of a story.
router.get('/:id/sequencing/delete', sequencing_controller.sequencing_delete_get);

// POST request to remove the sequencing of a story.
router.post('/:id/sequencing/delete', sequencing_controller.sequencing_delete_post);

// GET request to merge two sequences.
router.get('/:id/sequencing/reduce', sequencing_controller.sequencing_reduce_get);

// POST request to merge two sequences.
router.post('/:id/sequencing/reduce', sequencing_controller.sequencing_reduce_post);

// GET request to remove the sequencing of a story.
router.get('/:id/sequencing/augment', sequencing_controller.sequencing_augment_get);

// POST request to remove the sequencing of a story.
router.post('/:id/sequencing/augment', sequencing_controller.sequencing_augment_post);

// GET request to read the sequencing of a story.
router.get('/:id/sequencing', sequencing_controller.sequencing_get);

// GET request for one Story.
router.get('/:id', story_controller.story_detail);



// GET request for list of all Story items.
router.get('/', story_controller.story_list);


function errorHandler(err, req, res, next) {
  console.log('Catch-All error handler in Stories.', err)
  res.status(err.status || 500).send(err.message)
}

router.use(errorHandler)

module.exports = router;



/*
app.get('/api/new', (req, res, next) => {
    const { keyEvents, sequences, myEvents } = require( './controllers/newScenario' );

    res.status(200).json( { keyEvents, sequences, myEvents } );
  });
*/