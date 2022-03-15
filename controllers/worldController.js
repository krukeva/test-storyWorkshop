const World = require('../models/world');
const Story = require('../models/story');
const async = require('async');
const { body, validationResult } = require("express-validator");


// Display list of all Worlds.
exports.world_list = function(req, res) {
    World.find()
    .sort({name : 1})
    .exec(function (err, list_worlds) {
      if (err) { return next(err); }

      let story_list_index={};
      async.each( list_worlds,
        // Pour chaque monde trouvé, on recherche les histoires qui s'y déroulent.
        ( world, callback ) => {
            Story.find( { world: world } )
            .populate('coveringEvent')
            .exec( ( err, story_list ) => {
                if (err) { return next(err); }

                story_list_index[ world._id ] = story_list;
                callback(null);
            });
        },
        // Affichage de la liste.
        ( err ) => {
            if (err) { return next(err); }

            res.render('world_list',
                {
                    title: 'Liste des mondes disponibles',
                    world_list: list_worlds,
                    story_list_index: story_list_index
                }
            );
        }
      );      
    });
};

// Display detail page for a specific World.
exports.world_detail = function(req, res) {
    async.parallel({
        world: function(callback) {
            World.findById(req.params.id)
              .exec(callback);
        },

        world_stories: function(callback) {
          Story.find({ 'world': req.params.id })
          .exec(callback);
        },

    }, function(err, results) {
        if (err) { return next(err); }

        if (results.world==null) { // No results.
            var err = new Error('Ce monde n\'existe pas');
            err.status = 404;
            return next(err);
        }

        // Successful, so render.
        res.render('world_details',
            {
                title: 'Monde',
                world: results.world,
                stories: results.world_stories
            }
        );
    });
};

// Display world create form on GET.
exports.world_create_get = function(req, res) {
    res.render('world_form', { title: 'Création d\'un monde' });
};

// Handle world create on POST.
exports.world_create_post = [
    // Validate and sanitize the name field.
    body('name')
    .trim().isLength({ min: 1 }).withMessage('Il faut un nom pour ce monde.')
    .custom( (value) => {
        return World.find( {name: value } ).then( otherWorld => {
            if( otherWorld.length ) {
                return Promise.reject('Il y a déjà un monde avec ce nom.');
            }
        });
    } ),

    body('description', 'Il faut une description.').trim().isLength({ min: 1 }),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult( req );

        // Create an world object with escaped and trimmed data.
        var world = new World(
            { 
                name: req.body.name,
                description: req.body.description,
            }
        );

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            res.render('world_form',
                {
                    title: 'Création d\'un monde',
                    world: world,
                    errors: errors.array()
                }
            );
            return;
        } else {
            // Data from form is valid.
            world.save(function (err) {
                if (err) { return next(err); }
                        
                // Enregistrement de ce nouveau monde. On redirige vers sa page.
                res.redirect(world.url);
            });
        }
    }
];

// Display world delete form on GET.
exports.world_delete_get = function(req, res) {
    async.parallel({
        world: function( callback ) {
            World.findById( req.params.id ).exec( callback );
        },

        stories: function( callback ) {
            Story.find( { world: req.params.id } )
            .populate('coveringEvent')
            .exec( callback );
        }
    }, function( err, result ) {
        if (err) { return next(err); }

        if ( result.world === null ) {
            // Le monde n'existe pas.
            res.redirect('/worlds');
        }

        // Tout s'est bien passé, on affiche la page de suppression
        let renderParameters = {
            title: 'Story workshop',
            pageTitle: 'Suppression d\'un monde',
            world: result.world
        }

        if ( result.stories.length > 0 ) {
            renderParameters.alert = true;
            renderParameters.stories = result.stories;
        }        

        res.render( 'world_delete', renderParameters );
    });
};

// Handle world delete on POST.
exports.world_delete_post = function(req, res) {
    async.parallel({
        world: function( callback ) {
            World.findById( req.body.worldID ).exec( callback );
        },

        stories: function( callback ) {
            Story.find( { world: req.body.worldID } )
            .populate('coveringEvent')
            .exec( callback );
        }
    }, function( err, result ) {
        if (err) { return next(err); }

        if ( result.world === null ) {
            // Le monde n'existe pas.
            res.redirect('/worlds');
        }

        if ( result.stories.length > 0 ) {
            // Il y a des histoires: redirection vers la page de suppression.
            renderParameters = {
                title: 'Suppression d\'un monde',
                world: result.world,
                alert: true,
                stories: result.stories,
            }
            res.render( 'world_delete', renderParameters );
        }        

        World.findByIdAndRemove( req.body.worldID, ( err ) => {
            if (err) { return next(err); }
            res.redirect('/worlds');
        } );
    });
};

// Display world update form on GET.
exports.world_update_get = function(req, res) {
    async.parallel({
        world: function( callback ) {
            World.findById( req.params.id )
            .exec( callback );
        },

        stories: function( callback ) {
            Story.find( { world: req.params.id } )
            .populate('coveringEvent')
            .exec( callback );
        }
    }, function( err, result ) {
        if (err) { return next(err); }

        if ( result.world === null ) {
            // Le monde n'existe pas.
            let err = new Error('World not found');
            err.status = 404;
                return next(err);
        }


        // Tout s'est bien passé, on affiche la page de modification
        let renderParameters = {
            title: 'Modification d\'un monde',
            world: result.world
        }

        if ( result.stories.length > 0 ) {
            renderParameters.alert = true;
            renderParameters.stories = result.stories;
        }

        res.render( 'world_form', renderParameters );
    });
};

// Handle world update on POST.
exports.world_update_post = [
    // Validate and sanitize the name field.
    body('name')
    .trim().isLength({ min: 1 }).withMessage('Il faut un nom pour ce monde.')
    .custom( (value, {req} ) => {
        return World.findOne( {name: value, _id: { $ne: req.params.id }} ).then( otherWorld => {
            if( otherWorld ) {
                return Promise.reject('Il y a déjà un monde avec ce nom.');
            }
        });
    } ),

    body('description', 'Il faut une description.').trim().isLength({ min: 1 }),

    // Process request after validation and sanitization.
    (req, res, next) => {
        // Extract the validation errors from a request.
        const errors = validationResult( req );

        // Create an world object with escaped and trimmed data.
        let world = { 
            name: req.body.name,
            description: req.body.description,
        };

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            let renderParameters = {
                title: 'Modification d\'un monde',
                world: world,
                errors: errors.errors,
            }

            Story.find( { world: req.params.id } )
            .populate('coveringEvent')
            .exec( ( err, stories ) => {
                if (err) { return next(err); }
                
                if ( stories.length > 0 ) {
                    renderParameters.alert = true;
                    renderParameters.stories = stories;
                }

                res.render( 'world_form', renderParameters );
            });

            
        } else {
            // Data from form is valid.
            // Check if a world with the same name already exists.
            World.findOne( { name: req.body.name, _id: { $ne: req.params.id } })
            .exec( function(err, found_world) {
                if (err) { return next(err); }

                if (found_world) {
                    // Un monde avec ce nom existe déjà. On redirige vers sa page.
                    res.redirect(found_world.url);
                } else {
                    World.findByIdAndUpdate( req.params.id, world, function( err, theWorld ) {
                        if (err) { return next(err); }

                        res.redirect( theWorld.url )
                    });
                }
            });
        }
    }
];
