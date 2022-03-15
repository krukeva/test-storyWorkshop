const { body, validationResult } = require("express-validator");
const StoryTemplate = require("../models/storyTemplate");


// Display list of all StoryTemplates.
exports.storyTemplate_list = function(req, res) {
    StoryTemplate.find().sort({name : 1}).exec((err, template_list) => {
        if (err) { return next(err); }

        let renderParameters = {
            title: 'Liste des synopsis',
            template_list: template_list,
        }
        
        res.render('storyTemplate_list', renderParameters);
    });

};

// Display detail page for a specific StoryTemplate.
exports.storyTemplate_detail = function(req, res) {
    
    StoryTemplate.findById(req.params.id).exec( (err, template) => {
        if (err) { return next(err); }

        res.render('storyTemplate_details',
        {
            title: 'Synopsis',
            storyTemplate: template,
        });
    });
};

// Display StoryTemplate create form on GET.
exports.storyTemplate_create_get = function(req, res) {
    let renderParameters = {
        title: 'Création d\'un synopsis',
        nb_sequences: req.query.nb_sequences
    }
    res.render('storyTemplate_form', renderParameters );
};

// Handle StoryTemplate create on POST.
exports.storyTemplate_create_post = [
        
// Mise en forme des données du formulaire
    (req, res, next) => {

        let startingConditions=[];
        let sequenceOutlines=[];
        let shiftingConditions=[];
        let keyEvents=[];
    
        let i=1;
        while( i <= parseInt(req.query.nb_sequences) ) {

            let startingC  = req.body['startingConditions' + i.toString()].trim();
            let sequenceO  = req.body['sequenceOutline'    + i.toString()].trim();
            let shiftingC  = req.body['shiftingConditions' + i.toString()].trim();
            let keyEvent   = req.body['keyEvent'           + i.toString()].trim();

            let test = startingC + sequenceO + shiftingC + keyEvent;
            if( test != '') {
                startingConditions.push(startingC);
                sequenceOutlines.push(sequenceO);
                shiftingConditions.push(shiftingC);
                keyEvents.push(keyEvent);
            }
            i++;
        }

        req.body.startingConditions = startingConditions;
        req.body.sequenceOutlines   = sequenceOutlines;
        req.body.shiftingConditions = shiftingConditions;
        req.body.keyEvents          = keyEvents;

        next();
    },

    // Validate and sanitize the name field.
    body('name', 'Il faut un nom pour ce synopsis.').trim().isLength({ min: 1 }),
    body('description', 'Il faut une description.').trim().isLength({ min: 1 }),
    body('startingConditions.*', 'Les conditions de début de séquence ne doivent pas être nulles.').isLength({ min: 1 }),
    body('sequenceOutlines.*', 'Les déroulements de séquence ne doivent pas être nulles.').isLength({ min: 1 }),
    body('shiftingConditions.*', 'Les conditions de fin de séquence ne doivent pas être nulles.').isLength({ min: 1 }),
    body('keyEvents.*', 'Les événements de séquence ne doivent pas être vides.').isLength({ min: 1 }),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult( req );

        // Create an object with escaped and trimmed data.
        let { startingConditions, sequenceOutlines, shiftingConditions, keyEvents } = req.body;
        let sequences = [];
        for (let i=0; i<sequenceOutlines.length; i++) {
            sequences[i] = {
                startingConditions: startingConditions[i],
                outline: sequenceOutlines[i],
                shiftingConditions: shiftingConditions[i],
                keyEvent: keyEvents[i],
            };
        }  

        let mySynopsis = {
            name: req.body.name,
            description: req.body.description,
            sequences: sequences,
        };

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            let renderParameters = {
                title: 'Création d\'un synopsis',
                synopsis: mySynopsis,
                nb_sequences: sequences.length,
                errors: errors.array(),
            }
            res.render('storyTemplate_form', renderParameters );
            return;

        } else {
            StoryTemplate.findOne( { name: req.body.name, _id: { $ne: req.params.id } })
            .exec( function(err, found_template) {
                if (err) { return next(err); }

                if (found_template) {
                    // Un monde avec ce nom existe déjà. On redirige vers sa page.

                    let renderParameters = {
                        title: 'Création d\'un synopsis',
                        synopsis: mySynopsis,
                        nb_sequences: sequences.length,
                        errors: [{
                                value: mySynopsis.name,
                                msg: 'Un synopsis avec le même nom existe déjà.',
                                param: 'name',
                                location: 'body'
                        }],
                    }
                    res.render( 'storyTemplate_form', renderParameters );
                    return;

                } else {
                    let template = new StoryTemplate( mySynopsis );
            
                    template.save(function (err) {
                        if (err) { return next(err); }
                
                        res.redirect('/storytemplates');
                    });
                }
            });
        }

    }
];

// Display StoryTemplate delete form on GET.
exports.storyTemplate_delete_get = function(req, res) {

    StoryTemplate.findById(req.params.id).exec( (err, template) => {
        if (err) { return next(err); }

        res.render('storyTemplate_delete',
        {
            title: 'Story workshop',
            pageTitle: 'Suppression d\'un synopsis',
            storyTemplate: template,
        });
    });
};

// Handle StoryTemplate delete on POST.
exports.storyTemplate_delete_post = function(req, res) {
    StoryTemplate.findByIdAndRemove( req.body.storyTemplateID, ( err ) => {
            if (err) { return next(err); }
            res.redirect('/storytemplates');
    });
};

// Display world update form on GET.
exports.storyTemplate_update_get = function(req, res) {
    StoryTemplate.findById( req.params.id ).exec( (err, template) => {
        if (err) { return next(err); }

        let renderParameters = {
            title: 'Modification d\'un synopsis',
            nb_sequences: template.sequences.length,
            synopsis: template,
        };

        res.render( 'storyTemplate_form', renderParameters );
    } );
};

// Handle world update on POST.
exports.storyTemplate_update_post = [
    // Mise en forme des données du formulaire
    (req, res, next) => {

        let startingConditions=[];
        let sequenceOutlines=[];
        let shiftingConditions=[];
        let keyEvents=[];
    
        let i=1;
        while( req.body['startingConditions' + i.toString()] ) {

            let startingC  = req.body['startingConditions' + i.toString()].trim();
            let sequenceO  = req.body['sequenceOutline'    + i.toString()].trim();
            let shiftingC  = req.body['shiftingConditions' + i.toString()].trim();
            let keyEvent   = req.body['keyEvent'           + i.toString()].trim();

            let test = startingC + sequenceO + shiftingC + keyEvent;
            if( test != '') {
                startingConditions.push(startingC);
                sequenceOutlines.push(sequenceO);
                shiftingConditions.push(shiftingC);
                keyEvents.push(keyEvent);
            }
            i++;
        }

        req.body.startingConditions = startingConditions;
        req.body.sequenceOutlines   = sequenceOutlines;
        req.body.shiftingConditions = shiftingConditions;
        req.body.keyEvents          = keyEvents;

        next();
    },
    // Validate and sanitize the name field.
    body('name', 'Il faut un nom pour ce synopsis.').trim().isLength({ min: 1 }),
    body('description', 'Il faut une description.').trim().isLength({ min: 1 }),
    body('startingConditions.*', 'Les conditions de début de séquence ne doivent pas être nulles.').isLength({ min: 1 }),
    body('sequenceOutlines.*', 'Les déroulements de séquence ne doivent pas être nulles.').isLength({ min: 1 }),
    body('shiftingConditions.*', 'Les conditions de fin de séquence ne doivent pas être nulles.').isLength({ min: 1 }),
    body('keyEvents.*', 'Les événements de séquence ne doivent pas être vides.').isLength({ min: 1 }),


    // Process request after validation and sanitization.
    (req, res, next) => {
        // Extract the validation errors from a request.
        const errors = validationResult( req );

        // Create an object with trimmed data.
        let { startingConditions, sequenceOutlines, shiftingConditions, keyEvents} = req.body;
        let sequences = [];

        for (let i=0; i<sequenceOutlines.length; i++) {
            sequences[i] = {
                startingConditions: startingConditions[i],
                outline: sequenceOutlines[i],
                shiftingConditions: shiftingConditions[i],
                keyEvent: keyEvents[i],
            };
        }  

        let mySynopsis = {
            name: req.body.name,
            description: req.body.description,
            sequences: sequences,
        };

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            let renderParameters = {
                title: 'Modification d\'un synopsis',
                synopsis: mySynopsis,
                nb_sequences: sequences.length,
                errors: errors.errors,
            }
            res.render( 'storyTemplate_form', renderParameters );
            return;
            
        } else {       
            // Check if a StoryTemplate with the same name already exists.
            StoryTemplate.findOne( { name: req.body.name, _id: { $ne: req.params.id } })
            .exec( function(err, found_template) {
                if (err) { return next(err); }

                if (found_template) {
                    // Un monde avec ce nom existe déjà. On redirige vers sa page.

                    let renderParameters = {
                        title: 'Modification d\'un synopsis',
                        synopsis: mySynopsis,
                        nb_sequences: sequences.length,
                        errors: [{
                                value: mySynopsis.name,
                                msg: 'Un synopsis avec le même nom existe déjà.',
                                param: 'name',
                                location: 'body'
                        }],
                    }
                    res.render( 'storyTemplate_form', renderParameters );
                    return;

                } else {
                    StoryTemplate.findByIdAndUpdate( req.params.id, mySynopsis, function( err, theWorld ) {
                        if (err) { return next(err); }

                        res.redirect( '/storytemplates' )
                    });
                }
            });
        }
    }
];
