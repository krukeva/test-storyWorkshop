const Story = require('../models/story');
const World = require('../models/world');
const Event = require('../models/event');

const async = require('async');
const { body, validationResult } = require("express-validator");

const event_controller = require('../controllers/eventController.js');
const sequencing_controller = require('../controllers/sequencingController.js');

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
    body('title', 'Il faut un titre.').trim().isLength({ min: 1 }),

    body('description', 'Il faut une description.').trim().isLength({ min: 1 }),
    
    body('startDate').isDate(),

    body('endDate').isDate()
    .custom( (value, { req }) => {

        let startDateTime   = req.body.startDate + 'T'+ req.body.startTime;
        let endDateTime     = value + 'T'+ req.body.endTime;

        return ( startDateTime.localeCompare( endDateTime ) <=0 )
    } )
    .withMessage('L\'histoire ne peut pas se terminer avant d\'avoir commencé.'),
    
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
                startTime: req.body.startTime,
                endDate: req.body.endDate,
                endTime: req.body.endTime,
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
                            name: '-- Evénement couvrant pour l\'histoire "' + req.body.title + '" --',
                            description: req.body.description,
                            startDateTime:  req.body.startDate  + "T" + req.body.startTime + ":00",
                            endDateTime:    req.body.endDate    + "T" + req.body.endTime   + ":59",
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
    let worlds = World.find();

    let storyQuery = Story.findById( req.params.id )
            .populate('coveringEvent')
            .populate('world');

    let bounds = storyQuery.then( myStory => {

        if( myStory.coveringEvent ){

            // Gestion des événements indépendants
            let independantEvents = Event.find( { 
                parentId: myStory.coveringEvent._id,
                isSequence: {$ne: true},
            } );

            let dates = independantEvents.then( subevents => {

                if (subevents.length>0 ) {
                    let myDateTimeMinSup = myStory.coveringEvent.endDateTime;
                    let myDateTimeMaxInf = myStory.coveringEvent.startDateTime;
                    if ( subevents.length ) {
                        for(i=0; i<subevents.length; i++){
                            if ( !subevents[i].isSequence ) {
                                myDateTimeMinSup = myDateTimeMinSup<subevents[i].startDateTime
                                ? myDateTimeMinSup : subevents[i].startDateTime;
                                myDateTimeMaxInf = myDateTimeMinSup>subevents[i].endDateTime
                                ? myDateTimeMaxInf : subevents[i].endDateTime;    
                            } 
                        }
                    }
                    
                    return [ myDateTimeMinSup, myDateTimeMaxInf ];
                } else {
                    return [];
                }
                
            });

            // Gestion des événements des séquences
            let sequencing = sequencing_controller.sequencing_read( myStory );

            let boundsOfSequences = sequencing
            .then( ( [sequences, infoSequences] ) => {
                if ( sequences.length>0 ) {
                    let myDateTimeMinSup;
                    let myDateTimeMaxInf;
                    // Borne sup pour le début de l'histoire
                    //=> c'est le début du premier événement de la première séquence
                    // qui peut être un simple événement ou l'événement-clef.
                    
                    if( infoSequences[0][0].dateTimeMinSup <= infoSequences[0][1].startDateTime ) {
                        myDateTimeMinSup = infoSequences[0][0].dateTimeMinSup;
                    } else {
                        myDateTimeMinSup = infoSequences[0][1].startDateTime;
                    }
                
                    // Borne inf pour la fin de l'histoire
                    // C'est la borne de fin de l'événement point de bascule de la dernière séquence
                    let endKeyEvent = infoSequences[sequences.length-1][1];
                    let innerBounds = event_controller.event_subeventCoverage(endKeyEvent._id, false);
                    
                    myDateTimeMaxInf = innerBounds.then( ({ dateTimeMaxInf }) => {

                        // Minimum imposé par les sous-événements dans la séquence ou dans l'événement point de bascule
                        let minOfevents;
                        if (infoSequences[sequences.length-1][0].dateTimeMaxInf >= dateTimeMaxInf ) {
                            minOfevents = infoSequences[sequences.length-1][0].dateTimeMaxInf;
                        } else {
                            minOfevents = dateTimeMaxInf;
                        }

                        // On renvoie la date la plus tardive entre le minimum imposé et la date de début
                        // de l'événement point de bascule.

                        return minOfevents >= endKeyEvent.startDateTime ? minOfevents:endKeyEvent.startDateTime;
                    });

                    return Promise.all( [ myDateTimeMinSup, myDateTimeMaxInf ]);

                } else {
                    return [];
                }
            });

            return Promise.all( [ dates, boundsOfSequences ] )
            .then( ([ dates, boundsOfSequences ]) => {

                console.log( "Bornes hors séquence" );
                console.log( dates );
                console.log( "Bornes des séquences" );
                console.log( boundsOfSequences );

                // S'il y a un séquencement et des événements hors séquence, il faut comparer.
                if ( dates.length>0 && boundsOfSequences.length>0 ) {
                    let minSup = dates[0] <= boundsOfSequences[0]
                    ? dates[0]
                    : boundsOfSequences[0];

                    let maxInf = dates[1] >= boundsOfSequences[1]
                        ? dates[1]
                        : boundsOfSequences[1];

                        return { myStory, minSup, maxInf };

                } else if( boundsOfSequences.length>0) {
                    let minSup = boundsOfSequences[0];
                    let maxInf = boundsOfSequences[1];
                    return { myStory, minSup, maxInf }

                } else if ( dates.length>0 ) {
                    let minSup = dates[0];
                    let maxInf = dates[1];
                    return { myStory, minSup, maxInf }                    
                } else {
                    return { myStory };
                }
            }) ;
        } else {
            console.log( 'hello')
            return { myStory };
        }
    });

    Promise.all([worlds, bounds]).then( result => {
        let renderParameters = {
            title: 'Modifier une histoire',
            story: result[1].myStory,
            world_list: result[0],
        };

        if( result[1].myStory.coveringEvent ){
            renderParameters.mainEvent = result[1].myStory.coveringEvent;
            renderParameters.dateTimeMinSup = result[1].minSup? result[1].minSup.slice(0,16) : '';
            renderParameters.dateTimeMaxInf = result[1].maxInf? result[1].maxInf.slice(0,16) : '';
            //Pour passer la fonction de formatage des dates
            renderParameters.formateDate = formateDate; 
            renderParameters.formateDateTime = formateDateTime;

            res.render('story_form', renderParameters );
        } else {
            res.render('story_form', renderParameters );
        }
    })
};

// Handle story update on POST.
exports.story_update_post = [

    body('title', 'L\'histoire doit avoir un titre.').trim().isLength({ min: 1 }),
    
    body('description', 'L\'histoire doit avoir un résumé.').trim().isLength({ min: 1 }),

    body('startDate').isDate()
        .custom( (value, { req } ) => {
            theDate = value + 'T'+ req.body.startTime;
            if( req.body.dateTimeMinSup ) {
                return ( theDate.localeCompare( req.body.dateTimeMinSup ) <=0 )
            } else {
                return true;
            }
         } )
        .withMessage('La date de début de l\'histoire est incompatible des événements existants.'),

    body('endDate').isDate()
        .custom( (value, { req }) => {

            let startDateTime   = req.body.startDate + 'T'+ req.body.startTime;
            let endDateTime     = value + 'T'+ req.body.endTime;

            return ( startDateTime.localeCompare( endDateTime ) <=0 )
        } )
        .withMessage('L\'histoire ne peut pas se terminer avant d\'avoir commencé.')
        .custom( (value, { req } ) => {
            let theDate = value + 'T'+ req.body.endTime;
            
            if( req.body.dateTimeMaxInf ) {
                return ( req.body.dateTimeMaxInf.localeCompare( theDate ) <=0 )
            } else {
                return true;
            }
         } )
        .withMessage('La date de fin de l\'histoire est incompatible des événements existants.'),
    
    // Process request after validation and sanitization.
    function(req, res) {
        // Extract the validation errors from a request.
        const errors = validationResult( req );

        let newEvent = { 
            name: 'Evénement couvrant de l\'histoire ' + req.body.title,
            description: req.body.description,
            startDate: req.body.startDate,
            startTime: req.body.startTime,
            endDate: req.body.endDate,
            endTime: req.body.endTime,
        };

        let newStory = {
            title: req.body.title,
            world: { _id: req.body.world },
        }

        if (!errors.isEmpty()) {

            // There are errors. Render the form again with sanitized values/error messages.
            World.find().sort({name : 1}).exec( (err, worlds) => {
                if (err) { return next(err); }

                let renderParameters = {
                    title: 'Modifier une histoire',
                    story: newStory,
                    world_list: worlds,
                    mainEvent: newEvent,
                    dateTimeMinSup: req.body.dateTimeMinSup,
                    dateTimeMaxInf: req.body.dateTimeMaxInf,
                    formateDateTime:formateDateTime,
                    errors: errors.array()
                };

                res.render('story_form', renderParameters);
            });

        } else {
            // Les données sont valides.
            // On crée l'événement "couvrant" si nécessaire et on met à jour l'histoire.
            let event = { 
                name: newEvent.name,
                description: newEvent.description,
                startDateTime:  newEvent.startDate + "T" + newEvent.startTime + ":00",
                endDateTime:    newEvent.endDate   + "T" + newEvent.endTime   + ":59",
                parentId: null,
                isSequence: false
            };

            Story.findById( req.params.id ).populate('coveringEvent').exec( (err, story) => {
                if (err) { return next(err); }

                if ( story.coveringEvent ) {
                    let updateCoveringEvent = Event.findByIdAndUpdate(story.coveringEvent._id, event);
                    let updateStory = Story.findByIdAndUpdate(req.params.id, newStory);

                    //On vérifie s'il faut mettre à jour les séquences
                    let done = new Promise( ( resolve, reject ) => {
                        let updateFirstSequence = (event.startDateTime.slice(0,19).localeCompare( story.coveringEvent.startDateTime.slice(0,19) ) != 0 );
                        let updateLastSequence = ( event.endDateTime.slice(0,19).localeCompare( story.coveringEvent.endDateTime.slice(0,19) ) != 0 );
    
                        if ( updateFirstSequence || updateLastSequence ){

                            let sequencing = sequencing_controller.sequencing_read( story );
    
                            sequencing.then( ( [sequences, infoSequences] ) => {

                                if ( sequences.length>0 ) {
                                    let updateFS = new Promise( ( FS_resolve, FS_reject ) => {
                                        if( updateFirstSequence ) {
                                            Event.findByIdAndUpdate(sequences[0]._id, { startDateTime: event.startDateTime.slice(0,19) })
                                            .exec( err => { FS_resolve(true) } );
                                        } else {
                                            FS_resolve(true);
                                        }
                                    });
                                    
                                    let updateLS = new Promise( ( LS_resolve, LS_reject ) => {
                                        if( updateLastSequence ) {
                                            let updateSequence = Event.findByIdAndUpdate(sequences[sequences.length-1]._id, { endDateTime: event.endDateTime.slice(0,19) });
                                            let endKeyEvent = infoSequences[sequences.length-1][1];
                                            let updateKeyEvent = Event.findByIdAndUpdate(endKeyEvent._id, { endDateTime: event.endDateTime.slice(0,19) });
                                           
                                            Promise.all([updateSequence,updateKeyEvent]).then( ()=> (LS_resolve(true)));
                                        } else {
                                            LS_resolve(true)
                                        }
                                    });
                                    
                                    return Promise.all([updateFS,updateLS]);
                                }                                
                            })
                            .then( ()=> { resolve( true ) } );
                                                
                        } else {
                            resolve( true );
                        }
                    } );
                    

                    Promise.all([updateCoveringEvent, updateStory, done ]).then( ()=> {
                        res.redirect( '/story/'+req.params.id );
                    });

                }
            })
        }
    }
];
