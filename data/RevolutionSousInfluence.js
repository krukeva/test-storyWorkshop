const yearMin = 2023;
const yearMax = 2040;


const story = {
    title: 'Une révolution sous influence',
    outline: 'Un pays en voie de développement a reçu des investissements étrangers massifs qui ont bénéficié inégalement à la population.'
    +' Si les élites dirigeantes ont vu leur niveau de vie atteindre celui des pays occidentaux, les populations reçoivent un salire de misère pour leur travail dans des mines, des usines et de grandes plantations.'
    +' Un mouvement ouvrier pour obtenir des conditions de vie décentes commence à s\'organiser.'
    +' Ce mouvement, qui fait l\'objet d\'une repressions sévère, est soutenu apr divers organisations non-gouvernementales d\'obédiences religieuses variées.'
    +' Une série d\'accidents industriels spectaculaires révèle les conditions insalubres et dangereuses qui sont imposées aux ouvriers.'
    +' C\'est le déclencahement d\'un mouvement de protestation massif qui conduit à de violents manifestations, des émeutes et finalement une sitaution de guerre civile.'
    +' Les investisseurs étrangers tentent de faire intervenir des mercenaires pour reprendre le contrôle  de la situation.'
    + 'Cela de fait qu\'aggraver la situation.',
}


const sequences = [
    {
        start           : 'La population vit dans une grande pauvreté. Les seuls emplois sont fournis par des multinationales étrangères qui exploitent une main d\'œuvre à bas coût dans des conditions de travail insalubres.',
        globalSituation : 'L\'accident qui ouvre la séquence, le plus meurtrier depuis des années, s\'inscrit dans une série d\'événements similaires dont le bilan global se chiffre en milliers de victimes.',
        crisisRationale : 'Le mécontentement qui était largement perceptible dans la population se cristalise sous l\'effet de leaders charismatiques qui semblent émerger de nulle part. Des grèves se multiplient ainsi que quelques actions de sabotage.',
    },
    {
        start           : 'Les grands propriétaires et la clique au pouvoir tentent de calmer la situation en promettant des mesures sociales. En parallèle, des arrestations brutales visent les \"terroristes\" qui commettent les sabotages.',
        globalSituation : 'Les dirigeants et leurs alliés étrangers peinent à reprendre le contrôle de la situation. Ils tentent de diviser les mouvements de protestation en proposants des arragements locaux.',
        crisisRationale : 'Les opposants veulent garder l\'initiative et appellent la population à maintenir la pression sur le gouvernement.',
    },
    {
        start           : 'Une personne, porte-parole des manifestants, a été blessée pendant les émeutes et succombe à ses blessures.',
        globalSituation : 'La mort de cette personne devient le symbole de l\'oppression pour une frange de la population qui durcit sa position. Les proches de la personne morte pendant les émeutes tiennent une ligne d\'action modérée pour obtenir des réformes de fond selon un processus démocratique. La frange plus dure, dont le leader se fait appeler AKABA, prone la révolution et obtient de plus en plus de soutien chez les jeunes.',
        crisisRationale : 'Les efforts des dirigeants pour briser l\'union des opposants portent leurs fruits et des combats internes minent les mouvements de révolte.',
    },
    {
        start           : 'L\'attentat fait basculer de nombreux modérés dans le camps des révolutionnaires. Les voix qui s\'élèvent pour incriminer AKABA sont ridiculisées ou harcelées.',
        globalSituation : 'Les troubles s\'intensifient et les autorités renforcent la présence policière et mobilisent l\'armée.',
        crisisRationale : 'La rhétorique révolutionnaire du parti radical a complètement polarisé l\'opinion. Les voix modérées ne sont plus audibles. Plusieurs investisseurs étrangers se retirent en emmenant les machines et les stocks. La découverte de ces fuites met le feu aux poudres.',
    }

];

const keyEvents = [
    {
        name :          'Mouvement massif de protestation dans plusieurs grandes villes',
        description :   'Une série de manifestations a lieu pour protester contre la main-mise d\'industriels étrangers dont les usines tuent la population locale.',
    },
    {
        name :          'Emeutes dans la capitale',
        description :   'Une manifestation dans la capitale tourne à l\'émeute quand les forces de sécurité font un usage massif de gaz lacrimogènes puis tirent sur la foule. Le bilan est de 54 morts chez les manifestants et trois chez les forces de l\'ordre.',
    },
    {
        name :          'Attentat',
        description :   'Un leader des protestataires modérés est victime de coups de feux tirés depuis une voiture. Son pronostic vital est engagé.',
    },
    {
        name :          'Coup d\'état',
        description :   'Le parti radical saisit le palais présidentiel et prend en otage le gouvernement.',
    }
];

module.exports = { yearMin, yearMax, story, keyEvents, sequences };