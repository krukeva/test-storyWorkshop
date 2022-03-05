const Story = require('../models/story');
const World = require('../models/world');
const Event = require('../models/event');

const async = require('async');
const { body, validationResult } = require("express-validator");

//const event_controller = require('../controllers/eventController.js');
//const sequencing_controller = require('../controllers/sequencingController.js');

const { formateDate, formateDateTime } = require('../controllers/utils-dateTime.js');

// Display list of all Stories.
exports.story_list = function(req, res) {
    Story.find()
    .sort({title : 1})
    .populate('coveringEvent')
    .populate('world')
    .exec(function (err, list_stories) {
      if (err) { return next(err); }
        res.render(
            'story_list',
            { title: 'Liste des histoires', story_list: list_stories }
        );
    });
};

// Display detail page for a specific Story.
exports.story_detail = async function(req, res) {
    
    const story = await Story.findById(req.params.id)
        .populate('world')
        .populate('coveringEvent');

    let myStory = {
        title: story.title,
        world: story.world.name,
        _id: story._id,
    };

    if( story.coveringEvent ) {

        const sequences = Event.find( {
            parentId: story.coveringEvent._id,
            isSequence: true,
        })
        .sort({startDateTime:1});

        const independantEvents = Event.find({
            parentId: story.coveringEvent._id,
            isSequence: false,            
        })
        .sort({startDateTime:1});

        myStory.description = story.coveringEvent.description,
        myStory.startDate   = story.coveringEvent.startDate_formated;
        myStory.endDate     = story.coveringEvent.endDate_formated;
        myStory.coveringEventID = story.coveringEvent._id;
        myStory.sequences = await sequences;
        myStory.independantEvents = await independantEvents;
        
        res.render('story_details',
            { 
                title: 'Histoire',
                story: myStory,
                formateDateTime: formateDateTime,
            }
        );

    } else {
        res.render('story_details', { title: 'Histoire', story: myStory });
    }
};

// Display story create form on GET.
exports.story_create_get = function(req, res) {
    // NB: Il faut charger la liste des mondes disponibles avant d'afficher le formulaire.
    World.find()
    .sort({name : 1})
    .exec(function (err, list_worlds) {
        if (err) { return next(err); }

        // Tout est OK, donc on affiche le formulaire.
        res.render('story_form',
            {
                title: 'Création d\'une histoire',
                world_list: list_worlds,
            }
        );
    });
};

// Handle story create on POST.
exports.story_create_post = [
    
    // Validate and sanitize fields.
    body('title', 'Il faut un titre.').trim().isLength({ min: 1 }).escape(),
    body('description', 'Il faut une description.').trim().isLength({ min: 1 }).escape(),
    // A FAIRE : vérifier les dates

    // Process request after validation and sanitization.
    (req, res, next) => {
        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // On crée une variable qui est presque un objet Story
        let story = {
            title: req.body.title,
            world: req.body.world,
            coveringEvent: {
                description: req.body.description,
                startDate: req.body.startDate,
                endDate: req.body.endDate,
            }
        } 

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/error messages.

            World.find()
            .sort({name : 1})
            .exec(function (err, list_worlds) {
                if (err) { return next(err); }

                // On affiche le formulaire avec les données entrées et les erreurs
                res.render('story_form',
                    {
                        title: 'Création d\'une histoire',
                        story: story,
                        world_list: list_worlds,
                        errors: errors.array()
                    }
                );
            });
            return;
        } else {
            // Les données sont valides. On crée l'événement "couvrant" et l'histoire.
            async.waterfall([
                function(callback) {
                    // Création d'un événement avec les dates indiquées.
                    let event = new Event(
                        { 
                            name: req.body.title + ' -- Evénement couvrant pour l\'histoire',
                            description: req.body.description,
                            startDateTime: req.body.startDate + "T00:00:00",
                            endDateTime: req.body.endDate + "T23:59:59",
                            parentId: null,
                            isSequence: false
                        }
                    );
                    let error = null;
                    event.save(function (err) {
                        if (err) { error = err; }
                    });

                    callback( error, event._id );
                },
                function( eventID ) {
                    // Création de l'histoire.
                    let myStory = new Story( {
                        title: req.body.title,
                        world: req.body.world,
                        coveringEvent: eventID,
                    });

                    myStory.save(function (err){
                        if (err) { return next(err); }
                        
                        //successful - redirect to new story record.
                        res.redirect(myStory.url);
                    });
                }
            ]);
        }
    }
];

// Display story delete form on GET.
exports.story_delete_get = function(req, res) {
    Story.findById( req.params.id)
    .populate('coveringEvent')
    .exec( (err, story) => {
        if (err) { return next(err); }

        res.render( 'story_delete',
            {
                title: 'Effacer une histoire',
                story: story,
            }
        );
    });
};

// Handle story delete on POST.
exports.story_delete_post = async function(req, res) {
    Story.findById( req.params.id).exec( (err, story) => {
        if (err) { return next(err); }

        if (story.coveringEvent) {
            Event.aggregate( [
                { // Trouve l'événement
                    $match: { _id: story.coveringEvent }
                },
                { // Calcule les éléments de l'arbre d'événements
                    $graphLookup: {
                        from: "events",
                        startWith: "$_id",
                        connectFromField: "_id",
                        connectToField: "parentId",
                        as: "descendants"
                    } 
                },
                {
                    $project: {
                        "descendants": "$descendants._id",
                        _id: 0,
                    }
                }
            ]).exec( (err, descendantEvents ) => {

                if ( descendantEvents[0] ) {
                    let list = [ story.coveringEvent ].concat( descendantEvents[0].descendants );
    
                    async.each( list, ( event, callback ) => {
                        Event.findByIdAndRemove( event._id, callback );
                    }, (err) => {
                        Story.findByIdAndRemove( req.params.id ).exec( () => {
                            res.redirect('/stories');
                        })
                    })
                } else {
                    Story.findByIdAndRemove( req.params.id ).exec( () => {
                        res.redirect('/stories');
                    });
                }
            })
        } else {
            Story.findByIdAndRemove( req.params.id ).exec( () => {
                res.redirect('/stories');
            });
        }
    });
};

// Display story update form on GET.
exports.story_update_get = function(req, res) {
    async.parallel( {
        story: function(callback) {
            Story.findById( req.params.id )
            .populate('coveringEvent')
            .populate('world')
            .exec(callback);
        },

        worlds: function(callback) {
            World.find().exec(callback);
        }
    }, function(err, results) {
        if (err) { return next(err); }

        let renderParameters = {
            title: 'Modifier une histoire',
            story: results.story,
            world_list: results.worlds,
        };

        if( results.story.coveringEvent ){
            renderParameters.mainEvent = results.story.coveringEvent;
            //Pour passer la fonction de formatage des dates
            renderParameters.formateDate = formateDate; 

            // Recherche des bornes de dates des sous-événements
            Event.find( { parentId: results.story.coveringEvent._id} )
            .exec( (err, subevents) => {
                if (err) { return next(err); }

                if ( subevents.length ) {
                    let dateMinSup = results.story.coveringEvent.endDate;
                    let dateMaxInf = results.story.coveringEvent.startDate;
                    for(i=0; i<subevents.length; i++){
                        dateMinSup = dateMinSup<subevents[i].startDate
                            ? dateMinSup : subevents[i].startDate;
                        dateMaxInf = dateMinSup>subevents[i].endDate
                            ? dateMaxInf : subevents[i].endDate;    
                    }
                    renderParameters.dateMinSup = dateMinSup;
                    renderParameters.dateMaxInf = dateMaxInf;
                }

                res.render('story_form', renderParameters );
            })

            
        } else {
            res.render('story_form', renderParameters );
        }
    });
};

// Handle story update on POST.
exports.story_update_post = [
    body('title', 'L\'histoire doit avoir un titre.').trim().isLength({ min: 1 }).escape(),
    
    body('description', 'L\'histoire doit avoir un résumé.').trim().isLength({ min: 1 }).escape(),

    body('startDate').isDate()
        .custom( (value, { req }) => {        
            if( req.body.dateMinSup === '') {
                return true;
            } else {
                return ( value <= req.body.dateMinSup );
            }
         } )
        .withMessage('L\'histoire doit commencer avant le début de son premier événement.'),

    body('endDate').isDate()
        .custom( (value, { req }) => {
            return ( req.body.startDate <= value );
         } )
        .withMessage('L\'histoire ne peut pas se terminer avant d\'avoir commencé.')
        .custom( (value, { req }) => {
            if ( req.body.dateMaxInf === '') {
                return true;
            } else {
                return ( req.body.dateMaxInf <= value );
            }
         } )
        .withMessage('L\'histoire doit se terminer après la fin de son dernier sous-événement.'),
    
    // Process request after validation and sanitization.
    function(req, res) {
        // Extract the validation errors from a request.
        const errors = validationResult( req );

        let newEvent = { 
            name: 'Evénement couvrant de l\'histoire ' + req.body.title,
            description: req.body.description,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
        };

        let newStory = {
            title: req.body.title,
            world: { _id: req.body.world },
        }


        Story.findById( req.params.id ).populate('coveringEvent')
        .exec( ( err, story ) => {
            if (err) { return next(err); }

            if (!errors.isEmpty()) {
                // There are errors. Render form again with sanitized values/error messages.
    
                async.parallel( {
    
                    worlds: function(callback) {
                        World.find()
                        .sort({name : 1})
                        .exec(callback);
                    },
    
                    subevents: function(callback) {
                        if(story.coveringEvent) {
                            Event.find( { parentId: story.coveringEvent._id } )
                            .exec( callback);
                        } else {
                            callback( err, null );
                        }
                    }
    
                }, function(err, results)  {
                    if (err) { return next(err); }                
    
                    let renderParameters = {
                        title: 'Modifier une histoire',
                        story: newStory,
                        world_list: results.worlds,
                        mainEvent: newEvent,
                        errors: errors.array()
                    };
    
                    if ( story.coveringEvent && results.subevents.length ) {    
                        renderParameters.formateDate = formateDate; 
                        let dateMinSup = story.coveringEvent.endDate;
                        let dateMaxInf = story.coveringEvent.startDate;
                        for(i=0; i<results.subevents.length; i++){
                            dateMinSup = dateMinSup<results.subevents[i].startDate
                                ? dateMinSup : results.subevents[i].startDate;
                            dateMaxInf = dateMinSup>results.subevents[i].endDate
                                ? dateMaxInf : results.subevents[i].endDate;    
                        }
                        renderParameters.dateMinSup = dateMinSup;
                        renderParameters.dateMaxInf = dateMaxInf;
                    }
        
                    // On affiche le formulaire avec les données entrées et les erreurs
                    res.render('story_form', renderParameters);
                });
                return;
            } else {
                // Les données sont valides.
                // On crée l'événement "couvrant" si nécessaire et on met à jour l'histoire.
                let event = { 
                        name: newEvent.name,
                        description: newEvent.description,
                        startDateTime: newEvent.startDate + "T00:00:00",
                        endDateTime: newEvent.endDate + "T23:59:59",
                        parentId: null,
                        isSequence: false
                };

                if ( story.coveringEvent ) {
                    async.parallel( {
                        updateStory:function(callback) {
                            Story.findByIdAndUpdate(req.params.id, newStory)
                            .exec(callback);
                        },

                        updateCoveringEvent: function(callback) {
                            Event.findByIdAndUpdate(story.coveringEvent._id, event)
                            .exec(callback);
                        }

                     }, function(err) {
                        if (err) { return next(err); }

                        res.redirect( '/story/'+req.params.id );
                    });
                    
                } else {
                    async.waterfall([
                        // Création d'un événement avec les dates indiquées.
                        function(callback) {
                            let myEvent= new Event( event );
                            let error = null;
                            myEvent.save(function (err) {
                                if (err) { error = err; }
                            });
                            callback( error, myEvent._id );
                        },

                        // Mise à jour de l'histoire.
                        function( eventID ) {
                            newStory.coveringEvent = eventID;
                            Story.findByIdAndUpdate(req.params.id, newStory).exec( err => {
                                if (err) { return next(err); }
                                
                                //successful - redirect to new story record.
                                res.redirect( '/story/'+req.params.id );
                            });
                        }
                    ]);
                }
            }
        });
    }
];
