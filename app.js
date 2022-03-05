const express = require('express');
//const bodyParser = require('body-parser');

const app = express();
app.set('view engine', 'pug');
app.set('views','./views');

///////////////////////////////////////////////////////////
// Connexion à la base de données
///////////////////////////////////////////////////////////
const mongoose = require('mongoose');
const mongoDB = 'mongodb+srv://tuto:Azerty123@cluster0.zyx00.mongodb.net/myFirstDatabase?retryWrites=true&w=majority';
mongoose.connect( mongoDB,
  { useNewUrlParser: true,
    useUnifiedTopology: true })
  .then(() => console.log('Connexion à MongoDB réussie !'))
  .catch(() => console.log('Connexion à MongoDB échouée !'));

///////////////////////////////////////////////////////////
// Middleware générique
///////////////////////////////////////////////////////////
// Pour ?? et pour servir les fichiers statiques comme les CSS
app.use(express.json());
app.use(express.static('public'));

///////////////////////////////////////////////////////////
// Routage
///////////////////////////////////////////////////////////
// Ajout de headers pour éviter les problèmes de CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content, Accept, Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  next();
});

// Invocation du fichier qui contient toutes les routes
const routes = require('./routes.js');
app.use('/', routes);

///////////////////////////////////////////////////////////
// Export du module
///////////////////////////////////////////////////////////
module.exports = app;