const { DateTime, Duration } = require('luxon');

const { yearMin, yearMax } = require('../data/RevolutionSousInfluence.js');


function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min +1)) + min;
}
  
function getRandomDateTime( dateTimeMin=null, dateTimeMax=null) {
    let start, end;

    if (!dateTimeMin ) {
        start = DateTime.fromObject( { year: yearMin, month: 1, day:1 } );
    } else {
        start = dateTimeMin;
    }

    if (!dateTimeMax ) {
        end = DateTime.fromObject( {
            year: yearMax,
            month: 12,
            day:31,
        }).endOf('day');
    } else {
        end = dateTimeMax;
    }

    return start.plus(getRandomDuration( Duration.fromMillis(0), end.diff(start) ) );
}

function getRandomDuration( minDuration, maxDuration ) {
    const min = minDuration.toMillis();
    const max = maxDuration.toMillis();
    return Duration.fromMillis(getRandomInt( min, max )).normalize();
}

function getRandomSlicesOfDuration( duration, numberOfSlices, minInMinute=10 ) {

    let durationInMillis=duration.toMillis.milliseconds;

    // On vérifie que la durée est suffisante pour des tranches de 10 minutes, avec une marge.
    if ( durationInMillis < 1000*minInMinute*60 * numberOfSlices * 2 ) {
        return;
    }
    
    let listOfInstants = [ 0, durationInMillis ];
    for ( let i=1; i<numberOfSlices-1; i++ ){
        let minTime;
        do {
            let newInstant=getRandomInt(0, durationInMillis);
            minTime = listOfInstants.map( instant => ( Math.abs( instant - newInstant) ) ).sort()[0];
        } while( minTime<1000*minInMinute*60);
        listOfInstants.sort();
    }

    let listeOfDurations=[];
    for ( let i=0; i<listOfInstants.length-1; i++ ){
        listeOfDurations.push( Duration.fromMillis( listOfInstants[i+1] - listOfInstants[i] ).normalize() );
    } 

    return listeOfDurations;
}


// Génération d'événements aléatoires entre l'événement de début du scénario
// et l'événement de début de la fin de la dernière séquence.

function getRandomSubevents( startDateTime, endDateTime, maxDensityPerDay=2 ) {

    const totalDuration = endDateTime.diff(startDateTime);
    const numberOfDays = Math.ceil( totalDuration.shiftTo('days').days );
    const numberOfEvents = getRandomInt( 1, Math.floor(numberOfDays*maxDensityPerDay) );

    const minEventDuration = Duration.fromObject({minutes:5});

    //Calcul d'une durée max des événements 
    const maxEventDuration = Duration.fromObject(
        {
            days: Math.min( numberOfDays/numberOfEvents, numberOfDays/maxDensityPerDay)
        }
    );

    let myEvents    = [];
    for ( let i=0; i<numberOfEvents; i++ ) {
        let theDuration = getRandomDuration(minEventDuration, maxEventDuration);

        let start = getRandomDateTime( startDateTime, endDateTime);
        let end = start.plus( theDuration );

        let spillOver = Math.max(0, endDateTime.diff(end).toMillis());

        if ( spillOver >= 0 ) {
            myEvents.push(
                {
                    start: start,
                    end: end,
                }
            );
        }
    }

    myEvents.sort( ( event2, event1 ) => {
        return event2.start.diff(event1.start).toMillis() > 0;
    } );

    return myEvents;
}

function getRandomEventTree( startDateTime, endDateTime, maxDensityPerDay=2 ) {
    return getRandomSubevents( startDateTime, endDateTime, maxDensityPerDay );
}

module.exports = {
    getRandomInt,
    getRandomDateTime,
    getRandomDuration,
    getRandomSlicesOfDuration,
    getRandomSubevents,
    getRandomEventTree,
};