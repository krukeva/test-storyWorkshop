const createError = require('http-errors');
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

// Chargement des routeurs d'entitées
const worlds = require('./routers/worlds.js');
const events = require('./routers/events.js');
const stories = require('./routers/stories.js');


// for parsing application/json
router.use(bodyParser.json()); 
// for parsing application/xwww-
router.use(bodyParser.urlencoded({ extended: true })); 

router.use('/events?', events );
router.use('/story?(ies)?', stories );
router.use('/worlds?', worlds );

// GET home page.
router.get('/', function(req, res) {
  res.render('index', { title:'Story workshop', pageTitle: 'Accueil' });
});

// GET about page.
router.get('/about', function(req, res) {
  res.render('about', { title:'Story workshop', pageTitle: 'A propos'});
});


// catch 404 and forward to error handler
router.use(function(req, res, next) {
  next(createError(404));
});

// error handler
router.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {error: err});
});

module.exports = router;