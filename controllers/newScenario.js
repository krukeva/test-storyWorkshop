const { DateTime, Duration, Interval } = require('luxon');
const { getRandomInt, getRandomDateTime, getRandomDuration } = require('./utils-randomDateTime');

const { story, keyEvents, sequences } = require('../data/RevolutionSousInfluence.js');

const Story = require('../models/story');
const World = require('../models/world');
const Event = require('../models/event');


// Paramètres arbitraires
const minSequenceDuration = Duration.fromObject({days:3});
const maxSequenceDuration = Duration.fromObject({days:90});
const minKeyEventDuration = Duration.fromObject({minutes:30});
const maxKeyEventDuration = Duration.fromObject({days:3});

// Calcul de dates aléatoires pour notre histoire
const startDateTime = getRandomDateTime();

let previousDateTime = startDateTime;
for ( let i=0 ; i < keyEvents.length ; i++ ) {
    keyEvents[i].startDateTime = getRandomDateTime( 
        previousDateTime.plus(minSequenceDuration),
        previousDateTime.plus(maxSequenceDuration)
     );
    keyEvents[i].endDateTime = keyEvents[i].startDateTime.plus(
        getRandomDuration( minKeyEventDuration, maxKeyEventDuration )
    );
    previousDateTime = keyEvents[i].endDateTime;
}

// Préparation des données à insérer dans la base.
let coveringEvent = new Event( {
    name: 'Evénement couvrant pour l\'histoire ' + story.title,
    description: story.outline,
    startDateTime: startDateTime.startOf('day').toISO(),
    endDateTime: keyEvents[keyEvents.length-1].endDateTime.endOf('day').toISO(),
    parentId: null,
    isSequence: false,
    isKey: false,
});


//Pour l'histoire
const theStory = {
    title: story.title,
    world: null,
    coveringEvent: coveringEvent._id,
};

let SequencesAsEvents = sequences.map( (sequence, index) => (
    new Event( {
        name: 'Séquence '+ (index+1).toString(),
        description: sequence.start+ ' '+sequence.globalSituation+ ' '+sequence.crisisRationale,
        startDateTime: (index==0 ? startDateTime.startOf('day') : keyEvents[index-1].endDateTime),
        endDateTime: keyEvents[index].endDateTime,
        parentId: coveringEvent._id,
        isSequence: true,
        isKey: false,
    })
));

let keyEventsAsEvents = keyEvents.map( (event, index) => (
    new Event( {
        name: event.name,
        description: '[Point de bascule de la sequence ' + (index+1).toString() + event.description,
        startDateTime: event.startDateTime.toISO(),
        endDateTime: event.endDateTime.toISO(),
        parentId: SequencesAsEvents[index]._id,
        isSequence: false,
        isKey: true,
    })
));


module.exports = { theStory, coveringEvent, keyEventsAsEvents, SequencesAsEvents };