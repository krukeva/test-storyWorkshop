const Story = require('../models/story');
const World = require('../models/world');
const Event = require('../models/event');

const { body, validationResult } = require("express-validator");
const { DateTime } = require("luxon");
const { formateDate, formateDateTime } = require('../controllers/utils-dateTime.js');
const event_controller = require('../controllers/eventController.js')


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

exports.sequencing_read = async function( story) {

    infoSequence = async function( sequence ) {
        innerBounds = await event_controller.event_subeventCoverage(sequence, false);
        keyEvent = await Event.findOne( {
            parentId: sequence._id,
            isKey: true,
        })
        events = await Event.find( {
            parentId: sequence._id,
            isKey: {$ne: true},
        })

        return Promise.all([innerBounds, keyEvent, events]);
    }

    let sequences = await Event.find( {
        parentId: story.coveringEvent._id,
        isSequence: true,
    }).sort({startDateTime:1});

    let info = [];
    for (let i=0; i<sequences.length; i++) {
        info[i] = await infoSequence( sequences[i] );
    }

    let infoSequences = Promise.all(info);

    return Promise.all([sequences, infoSequences]);
}


// Display the sequence creation form on GET.
exports.sequencing_get = async function(req, res) {
    const story = await Story.findById(req.params.id).populate('coveringEvent');
    let sequencing = exports.sequencing_read( story );

    sequencing
    .then( ( [sequences, infoSequences] ) => {
        let enrichedSequences = [];
        for( let i=0; i<sequences.length; i++ ) {
            enrichedSequences[i] = sequences[i].toObject();
            enrichedSequences[i].innerBounds = infoSequences[i][0];
            enrichedSequences[i].keyEvent = infoSequences[i][1];
            enrichedSequences[i].events = infoSequences[i][2];
        }

        let renderParameters= {
            title: 'Histoire',
            pageTitle: 'Les séquences de l\'histoire',
            story: story,
            sequences: enrichedSequences,
            formateDateTime: formateDateTime,
        }

        res.render('sequencing_details', renderParameters);
    });
};

// Display the sequencing creation form on GET.
exports.sequencing_create_get = async function(req, res) {
    const story = await Story.findById(req.params.id)
    .populate('world')
    .populate('coveringEvent');

    let renderParameters = {
        title: 'Couper une histoire en séquences',
        story: story,
        parentEvent: story.coveringEvent,
        nb_sequences: req.query.nb
    }
    res.render( 'sequencing_form', renderParameters );
};

// Handle sequencing creation on POST.
exports.sequencing_create_post = [

    // Mise en forme des données du formulaire
    (req, res, next) => {
        let parentEvent= {
            _id: req.body.parentEventID,
            startDateTime: req.body.parentEvent_startDateTime,
            endDateTime: req.body.parentEvent_endDateTime,
        }
    
        let keyEvents=[];
        let sequenceOutlines=[];
        let i=1;
        while( i <= parseInt(req.query.nb) ) {
            keyEvents.push(
                {
                    description: req.body['description' + i.toString()].trim(),
                    startDateTime: req.body['startDate' + i.toString()] 
                                + 'T' + req.body['startTime' + i.toString()] + ":00",
                    endDateTime: req.body['endDate' + i.toString()] 
                                + 'T' + req.body['endTime' + i.toString()] + ":00",
                });
            sequenceOutlines.push( req.body['outline' + i.toString()].trim() );
            i++;
        }
    
        req.body = {
            parentEvent: parentEvent,
            keyEvents: keyEvents,
            sequenceOutlines: sequenceOutlines,
        };

        next();
    },

    body('parentEvent').custom( event => {
        try{
            DateTime.fromISO(event.startDateTime);
            DateTime.fromISO(event.endDateTime);

            return event.endDateTime.localeCompare(event.startDateTime);
        } catch{
            return false;
        }
    })
    .withMessage('Il y a un problème avec l\'événement parent.'),

    body('keyEvents.*.description').isLength({ min: 1 })
    .withMessage('Les descriptions des points de bascule ne peuvent pas être vides.'),

    body('keyEvents.*.startDateTime').custom( value => {
        try{
            DateTime.fromISO(value);
            return true;
        } catch{
            return false;
        }
    }).withMessage('Il y a un problème avec une date de début d\'événement de bascule.'),

    body('keyEvents.*.endDateTime').custom( value => {
        try{
            DateTime.fromISO(value);
            return true;
        } catch{
            return false;
        }
    }).withMessage('Il y a un problème avec une date de fin d\'événement de bascule.'),

    body('keyEvents.*').custom( value => {
        try{
            return value.endDateTime.localeCompare(value.startDateTime) < 0;
        } catch{
            return false;
        }
    }).withMessage('Il y a un d\'événement de bascule qui commence avant d\'avoir fini.'),

    body('keyEvents').custom( value => {
        try{
            let ok=true;
            for (let i=0; i<value.length-1; i++){
                ok=ok && value[i+1].startDateTime.localeCompare(value[i].endDateTime);
            }
            return ok;
        } catch{
            return false;
        }
    }).withMessage('Il y a un problème de chevauchement entre les séquences.'),

    body('sequenceOutlines.*').isLength({ min: 1 })
    .withMessage('Les résumés des séquences ne peuvent pas être vides.'),

    async (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult( req );

        Story.findById(req.params.id).populate('coveringEvent')
        .exec ( (err, story ) => {
            if(!errors.isEmpty()) {
                let { keyEvents, sequenceOutlines } = req.body;
                
                let enrichedSequences = [];
                for (let i=0; i< sequenceOutlines.length; i++) {
                    let start = (i==0) ? req.body.parentEvent.startDateTime
                        : keyEvents[i-1].endDateTime;

                    enrichedSequences[i] = {
                        description: sequenceOutlines[i],
                        startDateTime: start,
                        endDateTime: keyEvents[i].endDateTime,
                    };

                    enrichedSequences[i].keyEvent = new Event({
                        name: 'Point de bascule de la Séquence ' + (i+1).toString(),
                        description: keyEvents[i].description,
                        startDateTime: keyEvents[i].startDateTime,
                        endDateTime: keyEvents[i].endDateTime,
                    });
                }

                let renderParameters= {
                    title: 'Couper une histoire en séquences',
                    story: story,
                    sequences: enrichedSequences,
                    parentEvent: story.coveringEvent,
                    nb_sequences: enrichedSequences.length,
                    formateDateTime: formateDateTime,
                    errors: errors.errors,
                }

                res.render('sequencing_form', renderParameters);

            } else {
                let { keyEvents, sequenceOutlines } = req.body;
                
                for (let i=0; i<sequenceOutlines.length; i++) {
                    let start = (i==0) ? story.coveringEvent.startDateTime
                        : keyEvents[i-1].endDateTime;
    
                    let sequence = new Event(
                        { 
                            name: 'Séquence '+ (i+1).toString(),
                            description: sequenceOutlines[i],
                            startDateTime: start,
                            endDateTime: keyEvents[i].endDateTime,
                            parentId: story.coveringEvent._id,
                            isSequence: true,
                            isKey: false,
                        }
                    );
                    sequence.save();
    
                    let event = new Event(
                        { 
                            name: 'Point de bascule de la séquence '+ (i+1).toString(),
                            description: keyEvents[i].description,
                            startDateTime: keyEvents[i].startDateTime,
                            endDateTime: keyEvents[i].endDateTime,
                            parentId: sequence._id,
                            isSequence: false,
                            isKey: true,
                        }
                    );
                    event.save();
                }
                res.redirect(story.url);
            }
        })
        
    },
];


// Display the sequencing update form on GET.
exports.sequencing_update_get = async function(req, res) {
    let story = await Story.findById(req.params.id).populate('coveringEvent');
    let sequencing = exports.sequencing_read( story );

    sequencing
        .then( ([sequences, infoSequences ]) => {
            let enrichedSequences = [];
            for( let i=0; i<sequences.length; i++ ) {
                enrichedSequences[i] = sequences[i].toObject();
                enrichedSequences[i].innerBounds = infoSequences[i][0];
                enrichedSequences[i].keyEvent = infoSequences[i][1];
                enrichedSequences[i].events = infoSequences[i][2];
            }

            let renderParameters= {
                title: 'Modifier les séquences',
                story: story,
                sequences: enrichedSequences,
                parentEvent: story.coveringEvent,
                nb_sequences: sequences.length,
                formateDateTime: formateDateTime,
            }
        
            res.render('sequencing_form', renderParameters);        
        })
};

// Handle sequencing update on POST.
exports.sequencing_update_post = [
    // Mise en forme des données du formulaire
    function(req, res, next) {

        let parentEvent= {
            _id: req.body.parentEventID,
            startDateTime: req.body.parentEvent_startDateTime,
            endDateTime: req.body.parentEvent_endDateTime,
        }
    
        let keyEvents=[];
        let sequenceOutlines=[];
        let sequenceInnerBounds=[];
        let i=1;
        while( i <= parseInt(req.body['nb_sequences']) ) {
            keyEvents.push(
                {
                    description: req.body['description' + i.toString()].trim(),
                    startDateTime: req.body['startDate' + i.toString()] 
                                + 'T' + req.body['startTime' + i.toString()] + ":00",
                    endDateTime: req.body['endDate' + i.toString()] 
                                + 'T' + req.body['endTime' + i.toString()] + ":00",
                });
            sequenceOutlines.push( req.body['outline' + i.toString()].trim() );
            sequenceInnerBounds.push( {
                dateTimeMinSup: req.body['dateTimeMinSup' + i.toString()].trim(),
                dateTimeMaxInf: req.body['dateTimeMaxInf' + i.toString()].trim()
            });
            i++;
        }
    
        req.body = {
            parentEvent: parentEvent,
            keyEvents: keyEvents,
            sequenceOutlines: sequenceOutlines,
            sequenceInnerBounds: sequenceInnerBounds,
        };
        next();
    },

    body('parentEvent').custom( event => {
        try{
            DateTime.fromISO(event.startDateTime);
            DateTime.fromISO(event.endDateTime);

            return event.endDateTime.localeCompare(event.startDateTime);
        } catch{
            return false;
        }
    })
    .withMessage('Il y a un problème avec l\'événement parent.'),

    body('keyEvents.*.description').isLength({ min: 1 })
    .withMessage('Les descriptions des points de bascule ne peuvent pas être vides.'),

    body('keyEvents.*.startDateTime').custom( value => {
        try{
            DateTime.fromISO(value);
            return true;
        } catch{
            return false;
        }
    }).withMessage('Il y a un problème avec une date de début d\'événement de bascule.'),

    body('keyEvents.*.endDateTime').custom( value => {
        try{
            DateTime.fromISO(value);
            return true;
        } catch{
            return false;
        }
    }).withMessage('Il y a un problème avec une date de fin d\'événement de bascule.'),

    body('keyEvents.*').custom( value => {
        try{
            return value.startDateTime.localeCompare(value.endDateTime) < 0;
        } catch{
            return false;
        }
    }).withMessage('Il y a un d\'événement de bascule qui commence avant d\'avoir fini.'),

    body('keyEvents').custom( value => {
        try{
            let ok=true;
            for (let i=0; i<value.length-1; i++){
                ok=ok && ( value[i].endDateTime.localeCompare(value[i+1].startDateTime < 0) );
            }
            return ok;
        } catch{
            return false;
        }
    }).withMessage('Il y a un problème de chevauchement entre les événements-clefs (et donc les séquences).'),

    body('keyEvents').custom( ( value, { req } ) => {
        try{
            let ok=true;           
            for (let i=0; i<value.length; i++){
                ok=ok && (req.body.sequenceInnerBounds[i].dateTimeMaxInf.localeCompare(value[i].endDateTime) <=0 );
            }
            return ok;
        } catch{
            return false;
        }
    }).withMessage('Il y a un point de bascule qui se termine avant la fin des sous-événements de sa séquence.'),

    body('keyEvents').custom( ( value, { req } ) => {
        try{
            let ok=true;
            for (let i=0; i<value.length-1; i++){
                ok=ok && ( value[i].endDateTime.localeCompare(req.body.sequenceInnerBounds[i+1].dateTimeMinSup) <= 0 );
            }
            return ok;
        } catch{
            return false;
        }
    }).withMessage('Il y a un point de bascule qui se termine après le début des sous-événements de la séquence suivante.'),

    body('sequenceOutlines.*').isLength({ min: 1 })
    .withMessage('Les résumés des séquences ne peuvent pas être vides.'),

    async function(req, res) {
    
        // Extract the validation errors from a request.
        const errors = validationResult( req );

        let story = await Story.findById(req.params.id).populate('coveringEvent');
        let sequencing = await exports.sequencing_read( story )
            .then( ([sequences, infoSequences ]) => {
                let enrichedSequences = [];
                for( let i=0; i<sequences.length; i++ ) {
                    enrichedSequences[i] = sequences[i].toObject();
                    enrichedSequences[i].innerBounds = infoSequences[i][0];
                    enrichedSequences[i].keyEvent = infoSequences[i][1];
                    enrichedSequences[i].events = infoSequences[i][2];
                }
                return enrichedSequences;
            });

        Promise.all( sequencing )
        .then(sequencing => {
            if(!errors.isEmpty()) {
                let { keyEvents, sequenceOutlines } = req.body;
    
                let enrichedSequences = [];
                for (let i=0; i< sequencing.length; i++) {
                    let start = (i==0) ? req.body.parentEvent.startDateTime
                        : keyEvents[i-1].endDateTime;

                    let sequenceUpdateValues = { 
                        description: sequenceOutlines[i],
                        startDateTime: start,
                        endDateTime: keyEvents[i].endDateTime,
                    };

                    let keyEventUpdateValues = { 
                        description: keyEvents[i].description,
                        startDateTime: keyEvents[i].startDateTime,
                        endDateTime: keyEvents[i].endDateTime,
                    }
                    enrichedSequences[i] = Object.assign({}, sequencing[i], sequenceUpdateValues);
                    Object.assign( enrichedSequences[i].keyEvent, keyEventUpdateValues );
                }

                let renderParameters= {
                    title: 'Modifier les séquences',
                    story: story,
                    sequences: enrichedSequences,
                    parentEvent: story.coveringEvent,
                    nb_sequences: enrichedSequences.length,
                    formateDateTime: formateDateTime,
                    errors: errors.errors,
                }

                res.render('sequencing_form', renderParameters);
            } else {

                updateSequence = function( sequenceID, sequenceUpdateValues ) {
                    Event.updateOne(
                        { 
                            _id: sequenceID,
                        },
                        sequenceUpdateValues,
                        function(err) {
                            if(err) {console.log(err)}
                        }
                    );   
                }
                updateKeyEvent = function( keyEventID, keyEventUpdateValues ) {
                    Event.updateOne(
                        { 
                            _id: keyEventID,
                        },
                        keyEventUpdateValues,
                        function(err) {
                            if(err) {console.log(err)}
                        }
                    );   
                }
    
                let { keyEvents, sequenceOutlines } = req.body;
    
                let updatedSequences = []
                for (let i=0; i<sequenceOutlines.length; i++) {
                    let start = (i==0) ? req.body.parentEvent.startDateTime
                        : keyEvents[i-1].endDateTime;
        
                    let sequenceUpdateValues = { 
                        description: sequenceOutlines[i],
                        startDateTime: start,
                        endDateTime: keyEvents[i].endDateTime,
                    };
                            
                    let keyEventUpdateValues = { 
                        description: keyEvents[i].description,
                        startDateTime: keyEvents[i].startDateTime,
                        endDateTime: keyEvents[i].endDateTime,
                    }

                    updatedSequences[i] = [
                        updateSequence( sequencing[i]._id, sequenceUpdateValues ),
                        updateKeyEvent( sequencing[i].keyEvent._id, keyEventUpdateValues )
                    ];
                }
    
                Promise.all( updatedSequences ).then( ()=>{res.redirect(story.url)} );
            }
        });
    }
];


// Display the sequencing deletion form on GET.
exports.sequencing_delete_get = async function(req, res) {
   
    try {
        const story = await Story.findById(req.params.id).populate('coveringEvent');
    
        let renderParameters = {
            title: 'Supprimer les séquences',
            story: story,
        }

        if( req.query.deleteEvents === '1') {
            renderParameters.deleteEvents=true;
        }
    
        res.render( 'sequencing_delete', renderParameters );
    } catch {
        res.send('Il y a un problème: sequences delete GET');
    }
    
};

// Handle sequencing deletion on POST.
exports.sequencing_delete_post = async function(req, res) {

    let story= await Story.findById(req.params.id);

    if( req.query.deleteEvents === '1' && req.body.deleteEvents === '1') {
        try{
            let eventsToDelete = await Event.aggregate( [
                { // Trouve l'événement
                    $match: 
                        { 
                            parentId: story.coveringEvent,
                            isSequence: true,
                        }
                },
                { // Calcule les éléments de l'arbre d'événements
                    $graphLookup: {
                        from: "events",
                        startWith: "$_id",
                        connectFromField: "_id",
                        connectToField: "parentId",
                        as: "descendants"
                    } 
                }
            ]);
            
            for(let i=0; i<eventsToDelete.length; i++) {
                console.log(eventsToDelete[i]._id);
                if ( eventsToDelete[i].descendants ) {
                    for(let j=0; j<eventsToDelete[i].descendants.length; j++) {
                        Event.findByIdAndRemove(eventsToDelete[i].descendants[j]._id,
                            (err) => console.log('erreur'));
                    }
                    Event.findByIdAndRemove(eventsToDelete[i]._id,
                        (err) => console.log('erreur'));
                }
            }
            res.redirect(story.url);

        } catch{
            res.send('Problème: sequences delete POST');
        }
    } else {
        try{
            let sequencesToDelete = await Event.aggregate( [
                { // Trouve l'événement
                    $match: 
                        { 
                            parentId: story.coveringEvent,
                            isSequence: true,
                        }
                },
                { // Calcule les éléments de l'arbre d'événements
                    $graphLookup: {
                        from: "events",
                        startWith: "$_id",
                        connectFromField: "_id",
                        connectToField: "parentId",
                        as: "descendants",
                        maxDepth: 0,
                    } 
                }
            ]);

            for(let i=0; i<sequencesToDelete.length; i++) {
                if ( sequencesToDelete[i].descendants ) {
                    for(let j=0; j<sequencesToDelete[i].descendants.length; j++) {
                        Event.updateOne( {_id: sequencesToDelete[i].descendants[j]._id },
                            {parentId: story.coveringEvent},
                            (err) => { if(err){console.log('erreur pour reattribuer')} });
                    }
                    Event.findByIdAndRemove(sequencesToDelete[i]._id,
                        (err) => { if(err){console.log('erreur pour reattribuer')} });
                }
            }
            res.redirect(story.url);
            
        } catch{
            res.send('Problème: sequences delete POST');
        }
    }
    
};

// Display the sequence merging form on GET.
exports.sequencing_reduce_get = async function(req, res) {
    try{
        let sequenceToKeep = await Event.findOne({_id: req.query.sequenceID});
        let sequenceToMerge = await Event.findOne(
            {
                parentId: sequenceToKeep.parentId,
                isSequence: true,
            }
        ).where('startDateTime').gt(sequenceToKeep.startDateTime)
        .sort({startDateTime:1});

        let renderParameters = {
            title: 'Fusionner les séquences',
            sequenceToKeep: sequenceToKeep,
            sequenceToMerge: sequenceToMerge,
            formateDateTime: formateDateTime,
        }
        res.render( 'sequencing_reduce', renderParameters );
    } catch {
        res.send('problème: sequences merging GET');
    }
};



// Handle sequence merging on POST.
exports.sequencing_reduce_post = [
    body('outline').isLength({ min: 1 })
    .withMessage('La description de la séquence fusionnée ne peut pas être vide.'),    
    
    async function(req, res) {
        // Extract the validation errors from a request.
        const errors = validationResult( req );

        if(!errors.isEmpty()) {
            let sequenceToKeep = await Event.findOne({_id: req.query.sequenceID});
            let sequenceToMerge = await Event.findOne(
                {
                parentId: sequenceToKeep.parentId,
                isSequence: true,
                }
            ).where('startDateTime').gt(sequenceToKeep.startDateTime)
            .sort({startDateTime:1});

            let renderParameters = {
                title: 'Fusionner les séquences',
                sequenceToKeep: sequenceToKeep,
                sequenceToMerge: sequenceToMerge,
                formateDateTime: formateDateTime,
                errors: errors.errors,
                outline: req.body.outline,
            }
            res.render( 'sequencing_reduce', renderParameters );
        } else {
            try{
                console.log(req.body);
                let sequenceToKeep = await Event.findOne({_id: req.query.sequenceID});
                let story = await Story.findOne({coveringEvent: sequenceToKeep.parentId});
                let numSequence = await Event.countDocuments({
                    parentId: sequenceToKeep.parentId,
                    isSequence: true,
                }).where('startDateTime').lte(sequenceToKeep.startDateTime);
        
                let sequences = await Event.find(
                        {
                            parentId: sequenceToKeep.parentId,
                            isSequence: true,
                         }
                ).where('startDateTime').gt(sequenceToKeep.startDateTime)
                .sort({startDateTime: 1});
        
                // Changement de la date de fin et du résumé
                Event.updateOne(
                    { 
                        _id: sequenceToKeep._id,
                    },
                    {
                        description: req.body.outline,
                        endDateTime: sequences[0].endDateTime,
                    },
                    function(err ) {if(err) {console.log(err)}}
                );        
        
                // Le point de bascule de la séquence n'est plus un point de bascule
                Event.updateOne(
                    { 
                        parentId: sequenceToKeep._id,
                        isKey : true,
                    },
                    {
                        isKey : false,
                    },
                    function(err ) {if(err) {console.log(err)}}
                );
        
                // Réattribution des enfants de la séquence suivante:
                let events = await Event.updateMany({ parentId: sequences[0]._id},
                    { parentId: sequenceToKeep._id });
        
                // Suppression de la séquence suivante
                Event.findByIdAndDelete( sequences[0]._id, function(err ) {if(err) {console.log(err)}});
        
                // Renommage des autres séquences à la suite        
                for (i=1; i<sequences.length; i++){
                    Event.updateOne(
                        { 
                            _id: sequences[i]._id,
                        },
                        {
                            name: "Séquence "+ (numSequence+i).toString(),
                        },
                        function(err ) {if(err) {console.log(err)}}
                    );
                }
                
                res.redirect('/story/'+ story._id.toString());
            } catch {
                res.send('problème: sequences merge GET');
            }
        }
    }
];

// Display the sequence bisecting form on GET.
exports.sequencing_augment_get = async function(req, res) {
    try{
        let sequenceToSplit = await Event.findOne({_id: req.query.sequenceID});

        let renderParameters = {
            title: 'Scission d\'une séquence',
            sequenceToSplit: sequenceToSplit,
            formateDateTime: formateDateTime,
        }

        // Chercher les événements qui sont susceptibles de servir de pont de bascule
        let events = await Event.find({parentId: sequenceToSplit._id})
            .sort({startDateTime: 1});

        let candidateKeyEvents = [];
        events.forEach( (event) => {
            if(!event.isKey) {

                let intersectingEvents= events.filter((e) => {
                    return (
                        (e.startDateTime <= event.endDateTime)
                        && (e.endDateTime > event.endDateTime)
                    );
                });
                if (!intersectingEvents.length){
                    candidateKeyEvents=[...(candidateKeyEvents), event];
                }
            }
        });

        // S'il y a des événements candidats, on les affiche pour choix.
        if(candidateKeyEvents.length) {
            renderParameters.candidateKeyEvents = candidateKeyEvents;
        }

        res.render('sequencing_augment', renderParameters);
    } catch {
        console.log(err);
        res.send('problème: sequences bissect GET');
    }
};

// Handle sequence bisecting on POST.
exports.sequencing_augment_post = [

// Mise en forme des données du formulaire
    (req, res, next) => {
        
        let sequenceOutlines= [
            req.body['outline1'].trim(),
            req.body['outline2'].trim(),
        ]
        delete req.body['outline1'];
        delete req.body['outline2'];
        req.body.sequenceOutlines = sequenceOutlines
        next();
    },
    body('sequenceOutlines.*').isLength({ min: 1 })
    .withMessage('Les descriptions des séquences ne peuvent pas être vides.'),

    body('keyEventCandidate').isLength({ min: 1 })
    .withMessage('Il faut choisir un point de bascule.'),

    async function(req, res) {

        // Extract the validation errors from a request.
        const errors = validationResult( req );

        if(!errors.isEmpty()) {
            let sequenceToSplit = await Event.findOne({_id: req.query.sequenceID});

            let renderParameters = {
                title: 'Scission d\'une séquence',
                sequenceToSplit: sequenceToSplit,
                formateDateTime: formateDateTime,
                errors: errors.errors,
                sequenceOutlines: req.body.sequenceOutlines,
                keyEventCandidate: req.body.keyEventCandidate
            }

            // Chercher les événements qui sont susceptibles de servir de pont de bascule
            let events = await Event.find({parentId: sequenceToSplit._id})
                .sort({startDateTime: 1});

            let candidateKeyEvents = [];
            events.forEach( (event) => {
                if(!event.isKey) {

                    let intersectingEvents= events.filter((e) => {
                        return (
                            (e.startDateTime <= event.endDateTime)
                            && (e.endDateTime > event.endDateTime)
                        );
                    });
                    if (!intersectingEvents.length){
                        candidateKeyEvents=[...(candidateKeyEvents), event];
                    }
                }
            });

            // S'il y a des événements candidats, on les affiche pour choix.
            if(candidateKeyEvents.length) {
                renderParameters.candidateKeyEvents = candidateKeyEvents;
            }

            res.render('sequencing_augment', renderParameters);
        } else {
            try{
                let sequenceToSplit = await Event.findOne({_id: req.query.sequenceID});
                let newKeyEvent = await Event.findOne({_id: req.body.keyEventCandidate});
                let story = await Story.findOne({coveringEvent: sequenceToSplit.parentId});
                let numSequence = await Event.countDocuments({
                    parentId: sequenceToSplit.parentId,
                    isSequence: true,
                }).where('startDateTime').lte(sequenceToSplit.startDateTime);

                let sequences = await Event.find(
                {
                    parentId: sequenceToSplit.parentId,
                    isSequence: true,
                }
                ).where('startDateTime').gt(sequenceToSplit.startDateTime)
                .sort({startDateTime: 1});

                // Vérification que le keyEvent ne pose pas problème.
                let events = await Event.find({parentId: sequenceToSplit._id});
                let problemEvents = events.filter((e) => {
                    return (
                        (e.startDateTime <= newKeyEvent.endDateTime)
                        && (e.endDateTime > newKeyEvent.endDateTime)
                    );
                });
                if ( problemEvents.length ) {
                    throw new Error('Problème avec l\'événement point de bascule');
                }

                //Création de la nouvelle séquence
                let newSequence = new Event({
                    name: 'Séquence ' + (numSequence+1).toString(),
                    description: req.body.sequenceOutlines[1],
                    startDateTime: newKeyEvent.endDateTime,
                    endDateTime: sequenceToSplit.endDateTime,
                    parentId: sequenceToSplit.parentId,
                    isSequence: true,
                    isKey: false
                });
                newSequence.save(function(err ) {if(err) {console.log(err)}});

                // Attribution des événements après le nouveau point de bascule à la nouvelle séquence
                let eventsToReattribute = events.filter((e) => {
                    return (
                    (e.startDateTime >= newKeyEvent.endDateTime)
                    );
                });

                for (let i=0; i<eventsToReattribute.length; i++){
                    Event.updateOne(
                        { 
                            _id: eventsToReattribute[i]._id,
                        },
                        {
                            parentId: newSequence._id
                        },
                        function(err, event ) {
                            if(err) {console.log(err)};
                        }
                    );
                }

                //Mise à jour de la sequence scindée et attribution de son point de bascule
                Event.updateOne(
                    { 
                        _id: sequenceToSplit._id,
                    },
                    {
                        description: req.body.sequenceOutlines[0],
                        endDateTime: newKeyEvent.endDateTime,
                    },
                    function(err ) {if(err) {console.log(err)}}
                );
                Event.updateOne(
                    { 
                        _id: newKeyEvent._id,
                    },
                    {
                        isKey: true,
                    },
                    function(err ) {if(err) {console.log(err)}}
                );

                // Rénumérotation des séquences suivantes
                for (let i=0; i<sequences.length; i++){
                    Event.updateOne(
                        { 
                            _id: sequences[i]._id,
                        },
                        {
                            name: "Séquence "+ (numSequence+i+2).toString(),
                        },
                        function(err ) {if(err) {console.log(err)}}
                    );
                }

            res.redirect( story.url );
            } catch {
                res.send('Problem: sequences bisect POST');
            }
        }
    }
];