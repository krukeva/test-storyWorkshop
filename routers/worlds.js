const express = require('express');
const router = express.Router();


const world_controller = require('../controllers/worldController.js')


// GET request for creating an World. NOTE This must come before routes that display World (uses id).
router.get('/create', world_controller.world_create_get);

// POST request for creating World.
router.post('/create', world_controller.world_create_post);

// GET request to delete World.
router.get('/:id/delete', world_controller.world_delete_get);

// POST request to delete World.
router.post('/:id/delete', world_controller.world_delete_post);

// GET request to update World.
router.get('/:id/update', world_controller.world_update_get);

// POST request to update World.
router.post('/:id/update', world_controller.world_update_post);

// GET request for one World.
router.get('/:id', world_controller.world_detail);

// GET request for list of all World items.
router.get('/', world_controller.world_list);

function errorHandler(err, req, res, next) {
    console.log('Catch-All error handler in Worlds.', err)
    res.status(err.status || 500).send(err.message)
  }
  
router.use(errorHandler)

module.exports = router;