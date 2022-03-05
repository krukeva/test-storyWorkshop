const express = require('express');
const router = express.Router();

const Event = require('../models/event.js');
const event_controller = require('../controllers/eventController.js')


// GET request for creating an Event. NOTE This must come before routes that display Event (uses id).
router.get('/create', event_controller.event_create_get);

// POST request for creating Event.
router.post('/create', event_controller.event_create_post);

// GET request to delete Event.
router.get('/:id/delete', event_controller.event_delete_get);

// POST request to delete Event.
router.post('/:id/delete', event_controller.event_delete_post);

// GET request to update Event.
router.get('/:id/update', event_controller.event_update_get);

// POST request to update Event.
router.post('/:id/update', event_controller.event_update_post);

// GET request to add a subevent.
router.get('/:id/subevent/create', event_controller.subevent_create_get);

// POST request to add a subevent.
router.post('/:id/subevent/create', event_controller.subevent_create_post);

// GET request to add a subevent.
router.get('/:id/tree/create', event_controller.randomEventTree_create_get);

// POST request to add a subevent.
router.post('/:id/tree/create', event_controller.randomEventTree_create_post);

// GET request for one Event.
router.get('/:id', event_controller.event_detail);

// GET request for list of all Event items.
router.get('/', event_controller.event_list);


function errorHandler(err, req, res, next) {
    console.log('Catch-All error handler in Events.', err)
    res.status(err.status || 500).send(err.message)
  }
  
router.use(errorHandler)

module.exports = router;