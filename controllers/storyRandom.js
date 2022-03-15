const Story = require('../models/story');
const World = require('../models/world');
const Event = require('../models/event');
const StoryTemplate = require("../models/storyTemplate");

const { DateTime, Duration, Interval } = require('luxon');
const { body, validationResult } = require("express-validator");

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const { getRandomInt, getRandomDateTime, getRandomDuration } = require('./utils-randomDateTime');
const { map } = require('async');



exports.story_random = async function(req, res) {

    const { 
        theStory,
        coveringEvent,
        keyEventsAsEvents,
        SequencesAsEvents,
        myEvents
    } = require('./newScenario.js');

/*    res.json([
        theStory,
        coveringEvent,
        keyEventsAsEvents,
        SequencesAsEvents,
        myEvents
    ])
*/
    // Il faut choisir un monde
    let theWorld = await World.findOne();
    theStory.world = theWorld._id
    let myStory = new Story( theStory );

    try{
        myStory.save();
        coveringEvent.save();
        for (let i=0; i<SequencesAsEvents.length; i++) {
            SequencesAsEvents[i].save();
            keyEventsAsEvents[i].save();
        }
        res.redirect(myStory.url);
    } catch {
        res.send('Il y a un problème');
    }
}

exports.story_fromTemplate_get = function(req, res) {

    let storyTemplate_list = StoryTemplate.find().sort({name : 1}).exec();
    let world_list = World.find().sort({name : 1}).exec();
    
    Promise.all( [storyTemplate_list, world_list] ).then(([storyTemplate_list, world_list]) => {
        let renderParameters = {
            title: 'Création d\'une histoire aléatoire à partir d\'un template',
            storyTemplate_list: storyTemplate_list,
            world_list: world_list,
        };

        res.render('randomStory_form', renderParameters);
    });
}

exports.story_fromTemplate_post = [

    body('title', 'Il faut un titre.').trim().isLength({ min: 1 }),
    
    async function(req, res) {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // On crée une variable qui est presque un objet Story
        let story = {
            title: req.body.title,
            world: {_id: req.body.world},
            template: {_id: req.body.storyTemplate},
        }
    
        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/error messages.
        
            let storyTemplate_list = StoryTemplate.find().sort({name : 1}).exec();
            let world_list = World.find().sort({name : 1}).exec();
        
            Promise.all( [storyTemplate_list, world_list] ).then(([storyTemplate_list, world_list]) => {
                let renderParameters = {
                    title: 'Création d\'une histoire aléatoire à partir d\'un template',
                    storyTemplate_list: storyTemplate_list,
                    world_list: world_list,
                    story: story,
                    errors: errors.array(),
                };
    
                res.render('randomStory_form', renderParameters);
                return;
            });
        } else {

            let template = await StoryTemplate.findById( req.body.storyTemplate );

            // Paramètres arbitraires
            const minSequenceDuration = Duration.fromObject({days:3});
            const maxSequenceDuration = Duration.fromObject({days:90});
            const minKeyEventDuration = Duration.fromObject({minutes:30});
            const maxKeyEventDuration = Duration.fromObject({days:3});

            // Calcul de dates aléatoires pour notre histoire
            const startDateTime = getRandomDateTime();

            let previousDateTime = startDateTime;
            let keyEvents = [];
            for ( let i=0 ; i < template.numberOfSequences ; i++ ) {
                let startDateTime = getRandomDateTime( 
                    previousDateTime.plus(minSequenceDuration),
                    previousDateTime.plus(maxSequenceDuration)
                );
                let endDateTime = startDateTime.plus(
                    getRandomDuration( minKeyEventDuration, maxKeyEventDuration )
                );
                keyEvents.push( { 
                    startDateTime:  startDateTime.toISO().slice(0,19),
                    endDateTime:    endDateTime.toISO().slice(0,19),
                } );
                previousDateTime = endDateTime;
            }

            // Préparation des données à insérer dans la base.
            // L'événement principal :
            const coveringEvent = new Event( {
                name: 'Evénement couvrant pour l\'histoire ' + story.title,
                description: template.description,
                startDateTime: startDateTime.startOf('day').toISO().slice(0,19),
                endDateTime: keyEvents[keyEvents.length-1].endDateTime,
                parentId: null,
                isSequence: false,
                isKey: false,
            });

            // L'histoire :
            delete story.template;
            story.world = story.world._id;
            story.coveringEvent = coveringEvent._id;
            const theStory = new Story ( story );

            // Les séquences
            let sequencesAsEvents = template.sequences.map( (sequence, index) => (
                new Event( {
                    name: 'Séquence '+ (index+1).toString(),
                    description: sequence.startingConditions+' '+sequence.outline+' '+sequence.shiftingConditions,
                    startDateTime: (index==0 ? coveringEvent.startDateTime : keyEvents[index-1].endDateTime),
                    endDateTime: keyEvents[index].endDateTime,
                    parentId: coveringEvent._id,
                    isSequence: true,
                    isKey: false,
                })
            ));

            // Les points de bascule
            let keyEventsAsEvents = keyEvents.map( (event, index) => (
                new Event( {
                    name: '[Point de bascule de la sequence ' + (index+1).toString() + ']',
                    description:  template.sequences[index].keyEvent,
                    startDateTime: event.startDateTime,
                    endDateTime: event.endDateTime,
                    parentId: sequencesAsEvents[index]._id,
                    isSequence: false,
                    isKey: true,
                })
            ));

            try{
                Promise.all(
                    [ theStory.save(), coveringEvent.save() ]
                    .concat( sequencesAsEvents.map( sequence => sequence.save() ))
                    .concat(keyEventsAsEvents.map( event => event.save() ))
                ).then( () => res.redirect(theStory.url))
            } catch {
                res.send('Il y a un problème');
            }
        }
    }
];