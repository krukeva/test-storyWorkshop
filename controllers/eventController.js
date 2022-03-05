const Event = require('../models/event');
const Story = require('../models/story');
const { body, validationResult } = require("express-validator");
const async = require('async');
const { DateTime, Interval, Duration } = require("luxon");
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { formateDate, formateDateTime } = require('../controllers/utils-dateTime.js');

const { getRandomEventTree } = require('./utils-randomDateTime');

// Renvoie une valeur négative si ev1 commence avant ev2
function testStartBefore(ev1, ev2) {
    return ev1.startDateTime.localeCompare(ev2.startDateTime);
}

// Renvoie une valeur négative si ev1 finit avant ev2
function testEndBefore(ev1, ev2) {
    return ev1.endDateTime.localeCompare(ev2.endDateTime);
}

// Returns TRUE if event is included in inclusionEvent;
function testContains( containingEvent, event ) {
    if ( testStartBefore(containingEvent, event) <= 0 ) {
        return testEndBefore(event, containingEvent) <=0 ? true: false;
    } else {
        return false;
    }
}

// Renvoie une valeur négative si ev1 commence avant ev2.
// En cas d'égalité de la date de début, renvoie une valeur négative si
// ev1 finit après ev2.
function compareEvents( ev1, ev2 ) {
    let result_startBefore = testStartBefore(ev1, ev2);
    if (  result_startBefore == 0 ) {
        let result_endBefore = testEndBefore(ev2, ev1);
        console.log( 'Vérifie la fin');
        if ( result_endBefore == 0 ) {
            // cas pathologique d'événements superposés
            console.log( 'cas pathologique');
            if ( ev2.parentId === ev1_id ) {
                return -1;
            } else if ( ev1.parentId === ev2_id ) {
                return 1;
            } else {
                return 0;
            }
        } else {
            return result_endBefore;
        }
    } else {
        return result_startBefore;
    }
}

exports.event_subeventCoverage = async function( eventID ) {
    let subevents = await Event.find( { parentId: eventID });

    let dateTimeMinSup = '9999-12-31T23:59:59';
    let dateTimeMaxInf = '0000-01-01T00:00:00';

        if ( subevents.length ) {
            for(i=0; i<subevents.length; i++){
                dateTimeMinSup = dateTimeMinSup<subevents[i].startDateTime
                    ? dateTimeMinSup : subevents[i].startDateTime;
                dateTimeMaxInf = dateTimeMinSup>subevents[i].endDateTime
                    ? dateTimeMaxInf : subevents[i].endDateTime;    
            }
        }
    return { dateTimeMinSup, dateTimeMaxInf, subevents };
}

// Get all the descendant events of an event
exports.event_getDescendants = async function( eventID ) {

    let descendants = await Event.aggregate( [
        { // Trouve l'événement
            $match: { _id: ObjectId( eventID ) }
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
                "descendants": "$descendants",
                _id: 0,
            }
        }
    ]);

    // The agregation pipe returns a table; we want the only element.
    return descendants[0].descendants;
}

// Get all the ascendant events of an event
exports.event_getAscendants = async function( eventID ) {
    let ascendants = await Event.aggregate( [
        { // Trouve l'événement
            $match: { _id: ObjectId( eventID ) }
        },
        { // Calcule les éléments de l'arbre d'événements
            $graphLookup: {
                from: "events",
                startWith: "$parentId",
                connectFromField: "parentId",
                connectToField: "_id",
                as: "ascendants"
            } 
        },
        {
            $project: {
                "ascendants": "$ascendants",
                _id: 0,
            }
        }
    ]);

    // The agregation pipe returns a table; we want the only element.
    return ascendants[0].ascendants;
}

exports.event_getTree = async function ( eventID ) {

    let event = await Event.findById(eventID);
    let descendantList = await exports.event_getDescendants( eventID );

    let root;
    if ( descendantList.length ) {
        // /!\ si event est un Event, alors on ne peut pas lui ajouter la propriété
        // "children". Il faut en faire un objet simple sans ascendant.
        let list = [ event.toObject() ] .concat( descendantList );
        list[0].parentId = null;

        // Mapping des ID des éléments dans un tableau d'index
        const idMapping = list.reduce((acc, el, i) => {
            acc[el._id.toString()] = i;
            return acc;
        }, {});

        list.forEach((el) => {
            // Handle the root element
            if (el.parentId === null) {
                root = el;
                return;
            }

            // Use our mapping to locate the parent element in our data array
            const parentEl = list[idMapping[el.parentId.toString()]];

            // Add our current el to its parent's `children` array
            parentEl.children = [...(parentEl.children || []), el]
                .sort( (ev2, ev1) => { return ev2.startDateTime.localeCompare(ev1.startDateTime) } );
        });

        // On veut renvoyer l'arbre avec son placement dans la hiérarchie.
        root.parentId = event.parentId;
    } else {
        root = event.toObject();
    }
    
    return root;
}


// Display list of all Events in a hierarchical structure.
exports.event_list = function(req, res) {
    Event.aggregate( [
        { // Prend les éléments-racines
            $match: { parentId: null }
        },
        { // Extrait les éléments de l'arbre pour chaque racine
            $graphLookup: {
                from: "events",
                startWith: "$_id",
                connectFromField: "_id",
                connectToField: "parentId",
                as: "tree"
            } 
        },
        { // Trie les événements-racines par date de début.
            $sort : { startDateTime: 1 }
        }
    ]).exec( function (err, trees ){
        if (err) { return next(err); }

        let eventTrees = [];

        for ( let i=0; i<trees.length; i++ ) {

            // Applatissement des données: on veut une liste d'événements
            // qui doit comprendre l'événement racine.
            let list = [ trees[i] ] . concat( trees[i].tree );
            delete list[0].tree; // On supprime le champ qui contient les descendants.

            // Mapping des ID des éléments dans un tableau d'index
            const idMapping = list.reduce((acc, el, i) => {
                acc[el._id] = i;
                return acc;
              }, {});

            let root;
            list.forEach((el) => {
                // Handle the root element
                if (el.parentId === null) {
                  root = el;
                  return;
                }
                // Use our mapping to locate the parent element in our data array
                const parentEl = list[idMapping[el.parentId]];
                // Add our current el to its parent's `children` array
                parentEl.children = [...(parentEl.children || []), el]
                    .sort( (ev2, ev1) => { return ev2.startDateTime.localeCompare(ev1.startDateTime) } );
            });
            eventTrees[i] = root;
        }
        res.render('event_list', { title: 'Tous les événements', formateDateTime: formateDateTime, event_list: eventTrees });
    });
};

// Display detail page for a specific Event.
exports.event_detail = async function(req, res) {
    let eventWithTree = await exports.event_getTree(req.params.id);

    let renderParameters = {
        title: eventWithTree.isSequence? 'Séquence': 'Evénement',
        event: eventWithTree,
        formateDateTime: formateDateTime,
    }

    // Placement de l'événement dans la hiérarchie :
    let ascendants = await exports.event_getAscendants(req.params.id);
    ascendants = ascendants.sort(compareEvents);

    if ( ascendants.length > 1 ) {
        renderParameters.parentEvent = ascendants[ascendants.length-1];
    }

    // Récupération de l'histoire
    let storyId = ascendants.length ? ascendants[0]._id : eventWithTree._id;
    let story = await Story.findOne({ coveringEvent: storyId }).populate('coveringEvent');
    renderParameters.story = story;

    //console.log( renderParameters )
    res.render( 'event_details', renderParameters);
};

// Display event create form on GET.
exports.event_create_get = function(req, res) {
    res.render('event_form', { title: 'Création d\'un événement' });
};

// Handle event create on POST.
exports.event_create_post = [
    // Validate and sanitize the name field.
    body('name', 'Event name required').trim().isLength({ min: 1 }).escape(),
    body('description', 'Event description required').trim().isLength({ min: 1 }).escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult( req );

        // Create an event object with escaped and trimmed data.
        var event = new Event(
            { 
                name: req.body.name,
                description: req.body.description,
                startDateTime: req.body.startDate + "T" + req.body.startTime + ":00",
                endDateTime: req.body.endDate + "T" + req.body.endTime + ":00",
                parentId: null,
                isSequence: false,
                isKey: false,
            }
        );

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            res.render('event_form', { title: 'Création d\'un événement', event: event, errors: errors.array()});
            return;
        } else {
            // Data from form is valid.
            event.save(function (err) {
                if (err) { return next(err); }
                res.redirect(event.url);
            });
        }
    }
];

// Display event delete form on GET.
exports.event_delete_get = function(req, res) {
    async.parallel({

        // Récupération de l'événement visé
        event: function( callback ) {
            Event.findById( req.params.id ).exec( callback );
        },

        // Recherche de la présence de sous-événements
        subevents: function( callback ) {
            Event.find( { parentId: req.params.id }).exec( callback );
        },

        // Vérification si l'événement est la racine d'une histoire
        story: function( callback ) {
            Story.findOne( { coveringEvent: req.params.id } ).exec( callback );
        }

    }, function( err, result ) {
        if (err) { return next(err); }

        if ( result.event === null ) {
            // L'événement n'a pas été trouvé: on retourne à la liste.
            res.redirect('/events');
        }

        if ( result.event.isSequence ) {
            Story.findOne({ coveringEvent: result.event.parentId }).exec( (err, story) => {
                if (err) { return next(err); }
                if(story) {
                    res.redirect('/story/'+story._id+'/sequencing');
                } else {
                    res.redirect('/');
                    return new Error('La séquence ne trouve aps son histoire.')
                }
            } );
            return;
        }
            
        if( result.story !== null ) {
            res.render( 'event_delete',
                {
                    title: 'Effacer un événement',
                    alert: 'Cet événement est à la racine d\'une histoire',
                    event: result.event,
                    subevents: result.subevents,
                    formateDateTime: formateDateTime,
                }
            );
        } else {
            res.render( 'event_delete',
                {
                    title: 'Effacer un événement',
                    event: result.event,
                    subevents: result.subevents,
                    formateDateTime: formateDateTime,
                }
            );
        }
    });
};

// Handle event delete on POST.
exports.event_delete_post = function(req, res) {

    async.parallel( {
        // Récupération de l'événement visé et da descendance
        event: function( callback ) {
            Event.aggregate( [
                { // Trouve l'événement
                    $match: { _id: ObjectId(req.params.id)}
                },
                { // Calcule les éléments de l'arbre d'événements
                    $graphLookup: {
                        from: "events",
                        startWith: "$_id",
                        connectFromField: "_id",
                        connectToField: "parentId",
                        as: "tree"
                    } 
                }
            ]).exec( callback );
        },

        // Vérification si l'événement est la racine d'une histoire
        story: function( callback ) {
            Story.findOne( { coveringEvent: req.params.id } ).exec( callback );
        }

    }, function( err, result ) {
        if (err) { return next(err); }

        async.each( result.event[0].tree,
            
            function( event, callback ) {
                Event.findByIdAndRemove( event._id, callback );
            },
            
            function( err ) {
                if (err) { return next(err); }

                Event.findByIdAndRemove( req.body.eventID, ( err ) => {
                    if (err) { return next(err); }

                    if ( result.story !== null ) {
                        Story.findByIdAndRemove( result.story._id, ( err ) => {
                            if (err) { return next(err); }
            
                            res.redirect('/stories');
                        });
                    } else {
                        res.redirect('/events');
                    }
                });
            });
    });
};

// Display event update form on GET.
exports.event_update_get = function(req, res) {
    
    async.parallel({

        // Récupération de l'événement visé
        event: function( callback ) {
            Event.findById( req.params.id ).exec( callback );
        },

        // Recherche de la présence de sous-événements
        subevents: function( callback ) {
            Event.find( { parentId: req.params.id }).exec( callback );
        },

        // Vérification si l'événement est la racine d'une histoire
        story: function( callback ) {
            Story.findOne( { coveringEvent: req.params.id } ).exec( callback );
        }

    }, function( err, result ) {

        if (err) { 
            console.log(err);
            return next(err);
        }

        if ( result.event === null ) {
            // L'événement n'a pas été trouvé: on retourne à la liste.
            res.redirect('/events');
            return;
        }

        if ( result.event.isSequence ) {
            Story.findOne({ coveringEvent: result.event.parentId }).exec( (err, story) => {
                if (err) { return next(err); }

                if(story) {
                    res.redirect('/story/'+story._id+'/sequencing');
                } else {
                    res.redirect('/');
                    return new Error('La séquence ne trouve pas son histoire.');
                }
            } );
            return;
        }

        let renderParameters = {
            title: 'Modifier un événement',
            event: result.event,
            formateDateTime: formateDateTime,
        };

        if( result.story !== null ) {
            renderParameters.alert = true;
            renderParameters.story = result.story;
        }

        // Recherche des bornes de dates des sous-événements
        let dateTimeMinSup = result.event.endDateTime;
        let dateTimeMaxInf = result.event.startDateTime;
        if ( result.subevents.length ) {
            renderParameters.alert = true;
            renderParameters.subevents = result.subevents;
            for(i=0; i<result.subevents.length; i++){
                dateTimeMinSup = dateTimeMinSup<result.subevents[i].startDateTime
                    ? dateTimeMinSup : result.subevents[i].startDateTime;
                dateTimeMaxInf = dateTimeMinSup>result.subevents[i].endDateTime
                    ? dateTimeMaxInf : result.subevents[i].endDateTime;    
            }
        }
        renderParameters.dateTimeMinSup = dateTimeMinSup;
        renderParameters.dateTimeMaxInf = dateTimeMaxInf;

        res.render( 'event_form', renderParameters );

    });
};

// Handle event update on POST.
exports.event_update_post = [
    body('name', 'L\'événement doit avoir un nom.').trim().isLength({ min: 1 }).escape(),

    body('description', 'L\'événement doit avoir une description.').trim().isLength({ min: 1 }).escape(),

    body('startDate').isDate()
        .custom( (value, { req }) => {
            let dateTimeMinSup = DateTime.fromISO( req.body.dateTimeMinSup );
            let theDate = DateTime.fromISO( value + 'T'+ req.body.startTime );
            
            return ( dateTimeMinSup.diff( theDate ).toMillis() >= 0 )
         } )
        .withMessage('L\'évenement doit commencer avant le début de son premier sous-événement.'),

    body('endDate').isDate()
        .custom( (value, { req }) => {
            let startDate = DateTime.fromISO( req.body.startDate + 'T'+ req.body.startTime );
            let endDate = DateTime.fromISO( value + 'T'+ req.body.endTime );

            return ( endDate.diff( startDate ).toMillis() >= 0 )
         } )
        .withMessage('L\'événement ne peut pas se terminer avant d\'avoir commencé.')
        .custom( (value, { req }) => {
            let dateTimeMaxInf = DateTime.fromISO( req.body.dateTimeMaxInf );
            let theDate = DateTime.fromISO( value + 'T'+ req.body.endTime );
            
            return ( theDate.diff( dateTimeMaxInf ).toMillis() >= 0 )
         } )
        .withMessage('L\'évenement doit se terminer après la fin de son dernier sous-événement.'),
    
    function(req, res, next) {
        // Extract the validation errors from a request.
        const errors = validationResult( req );

        // Create an event object with escaped and trimmed data.
        let event = { 
                name: req.body.name,
                description: req.body.description,
                startDateTime: req.body.startDate + "T" + req.body.startTime + ":00",
                endDateTime: req.body.endDate + "T" + req.body.endTime + ":00",
            };

        if (!errors.isEmpty()) {

            // There are errors. Render the form again with sanitized values/error messages.
            async.parallel({
                // Récupération de l'événement visé
                event: function( callback ) {
                    Event.findById( req.params.id ).exec( callback );
                },
        
                // Recherche de la présence de sous-événements
                subevents: function( callback ) {
                    Event.find( { parentId: req.params.id }).exec( callback );
                },
        
                // Vérification si l'événement est la racine d'une histoire
                story: function( callback ) {
                    Story.findOne( { coveringEvent: req.params.id } ).exec( callback );
                }
        
            }, function( err, result ) {
        
                if (err) { 
                    console.log(err);
                    return next(err);
                }
        
                if ( result.event === null ) {
                    // L'événement n'a pas été trouvé: on retourne à la liste.
                    res.redirect('/events');
                }
        
                let newEvent = new Event({ ...result.event, ...event });

                let renderParameters = {
                    title: 'Modifier un événement',
                    event: newEvent,
                    errors: errors.array(),
                    formateDateTime: formateDateTime,
                };
        
                if( result.story !== null ) {
                    renderParameters.alert = true;
                    renderParameters.story = result.story;
                }
        
                if ( result.subevents.length ) {
                    renderParameters.alert = true;
                    renderParameters.subevents = result.subevents;
        
                    // Recherche des bornes de dates des sous-événements
                    let dateTimeMinSup = result.event.endDateTime;
                    let dateTimeMaxInf = result.event.startDateTime;
                    for(i=0; i<result.subevents.length; i++){
                        dateTimeMinSup = dateTimeMinSup<result.subevents[i].startDateTime
                            ? dateTimeMinSup : result.subevents[i].startDateTime;
                        dateTimeMaxInf = dateTimeMinSup>result.subevents[i].endDateTime
                            ? dateTimeMaxInf : result.subevents[i].endDateTime;    
                    }
                    renderParameters.dateTimeMinSup = dateTimeMinSup;
                    renderParameters.dateTimeMaxInf = dateTimeMaxInf;
                }
        
                res.render( 'event_form', renderParameters );
        
            });
        } else {
            // Data from form is valid.
            Event.findByIdAndUpdate(req.params.id, event, function (err) {
                if (err) { return next(err); }
                res.redirect( '/event/'+req.params.id );
            });
        }
    }
];

// Display subevent creation form on GET.
exports.subevent_create_get = function(req, res) {
    Event.findById(req.params.id)
    .exec( function (err, parentEvent) {
        if (err) { return next(err); }
        res.render('subevent_form',
            { 
                title: 'Création d\'un sous-événement',
                parentEvent: parentEvent,
                formateDateTime: formateDateTime,
            }
        );
    });
};

// Handle subevent creation on POST.
exports.subevent_create_post = [
    body('name', 'L\'événement doit avoir un nom.').trim().isLength({ min: 1 }).escape(),

    body('description', 'L\'événement doit avoir une description.').trim().isLength({ min: 1 }).escape(),

    body('startDate').isDate()
        .custom( (value, { req }) => {
            let startDateTime = DateTime.fromISO( req.body.parentEvent_startDateTime );
            let theDate = DateTime.fromISO( value + 'T'+ req.body.startTime );
            
            return ( theDate.diff( startDateTime ).toMillis() >= 0 )
         } )
        .withMessage('L\'évenement doit commencer après le début de son événement-parent.'),

    body('endDate').isDate()
        .custom( (value, { req }) => {
            let startDate = DateTime.fromISO( req.body.startDate + 'T'+ req.body.startTime );
            let endDate = DateTime.fromISO( value + 'T'+ req.body.endTime );

            return ( endDate.diff( startDate ).toMillis() >= 0 )
         } )
        .withMessage('L\'événement ne peut pas se terminer avant d\'avoir commencé.')
        .custom( (value, { req }) => {
            let endDateTime = DateTime.fromISO( req.body.parentEvent_endDateTime );
            let theDate = DateTime.fromISO( value + 'T'+ req.body.endTime );
            
            return ( endDateTime.diff( theDate ).toMillis() >= 0 )
         } )
        .withMessage('L\'évenement doit se terminer avant la fin de son événement-parent.'),
    
    function(req, res, next) {

        // Extract the validation errors from a request.
        const errors = validationResult( req );
        console.log(errors);
        // Create an event object with escaped and trimmed data.
        let event = new Event(
            { 
                name: req.body.name,
                description: req.body.description,
                startDateTime: req.body.startDate + "T" + req.body.startTime + ":00",
                endDateTime: req.body.endDate + "T" + req.body.endTime + ":00",
                parentId: req.body.parentEventID,
                isSequence: false,
                isKey: false,
            }
        );

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            Event.findById( req.body.parentEventID )
            .exec( function (err, parentEvent) {
                if (err) { return next(err); }

                res.render('subevent_form',
                    { 
                        title: 'Création d\'un sous-événement',
                        parentEvent: parentEvent,
                        subevent: event,
                        errors: errors.errors,
                        formateDateTime: formateDateTime,
                    }
                );
            });
            return;
        } else {
            // Data from form is valid.
            event.save(function (err) {
                if (err) { return next(err); }
                res.redirect(event.url);
            });
        }
    }
];

// Display subevent creation form on GET.
exports.randomEventTree_create_get = async function(req, res) {
    try {
        let parentEvent = await Event.findById(req.params.id);
   
        res.render('randomEventTree_form',
            { 
                title: 'Création d\'une arboresence aléatoire d\'événements',
                parentEvent: parentEvent,
                formateDateTime: formateDateTime,
            }
        );
    } catch {
        res.send( 'Problème dans la fonction randomEventTree_create_get')
    }
};

// Handle subevent creation on POST.
exports.randomEventTree_create_post = [
/*    body('name', 'L\'événement doit avoir un nom.').trim().isLength({ min: 1 }).escape(),
*/    
    function(req, res, next) {

        let tree = getRandomEventTree( 
            DateTime.fromISO(req.body.parentEvent_startDateTime),
            DateTime.fromISO(req.body.parentEvent_endDateTime),
            2,
        );

        try {
            for( let index=0; index<tree.length; index++ ) {

                let event = new Event( {
                    name: 'Evénement '+ (index+1).toString(),
                    description: 'Un événement aléatoire',
                    startDateTime: tree[index].start.toISO(),
                    endDateTime: tree[index].end.toISO(),
                    parentId: req.body.parentEventID,
                    isSequence: false,
                    isKey: false,
                });

                event.save();                
            }

            res.redirect('/event/'+req.body.parentEventID);

        } catch {
            res.json(tree)
        }
/*
        // Extract the validation errors from a request.
        const errors = validationResult( req );
        console.log(errors);
        // Create an event object with escaped and trimmed data.
        let event = new Event(
            { 
                name: req.body.name,
                description: req.body.description,
                startDateTime: req.body.startDate + "T" + req.body.startTime,
                endDateTime: req.body.endDate + "T" + req.body.endTime,
                parentId: req.body.parentEventID,
                isSequence: false
            }
        );

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            Event.findById( req.body.parentEventID )
            .exec( function (err, parentEvent) {
                if (err) { return next(err); }

                res.render('subevent_form',
                    { 
                        title: 'Création d\'un sous-événement',
                        parentEvent: parentEvent,
                        subevent: event,
                        errors: errors.errors,
                    }
                );
            });
            return;
        } else {
            // Data from form is valid.
            event.save(function (err) {
                if (err) { return next(err); }
                res.redirect(event.url);
            });
        }
*/
    }
];