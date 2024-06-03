// Se instaló EXPRESS (npm install express) 
const express = require("express");

//solucionar problema de el Servidor no reconoce los CSS
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const fs = require('fs');
const {Pool} = require('pg');


//intalar websockets :::::::::::::::::::::::::::::::::::::::::::::::::::::::::
const { Server: WebSocketServer } = require('socket.io');
const http = require('http');
const server = http.createServer(app);
const io = new WebSocketServer(server);

//se instaló UUID para agregar id aleatorio a cada chat: npm i uuid
const { v4: uuid } = require('uuid');


//arreglo para almacenar los chats
const chats = [];

io.on('connection', (socket) =>{
    console.log('conexion socket nueva:', socket.id);
    //recarga las notas del arrelo chats
    socket.emit('server:loadchats', chats);

    socket.on('client: newchat', message => {
        const newChat =   {message, id: uuid(), sentByMe: true};
        //console.log(newChat);
        chats.push(newChat);
        //devuelve las notas al cliente
        io.emit('server:newchat', newChat);
    });
});


//Gestion de Puntos y Palabras por WebSockets y TIMER


let timerInterval = null; // Mantén una referencia al temporizador global

// Función para obtener una palabra aleatoria de la base de datos
async function getRandomWordFromDB() {
    try {
        const result = await pool.query('SELECT texto FROM palabra ORDER BY RANDOM() LIMIT 1');
        return result.rows[0].texto;
    } catch (error) {
        console.error('Error al obtener la palabra aleatoria de la base de datos:', error);
        return null;
    }
}

// Iniciar el Juego
// conexión del WebSocket
io.on('connection', (socket) => {
    socket.currentWord = '';

    // Obtener una palabra al inicio del juego
    startGame(socket);

    socket.on('client:newchat', (message) => {
        // Obtener la palabra actual asociada con este socket
        const currentWord = socket.currentWord;

        // Validar
        if (message.toLowerCase() === currentWord.toLowerCase()) {
            io.emit('server:correctGuess', socket.id);
        }
    });
});

// Función para iniciar el juego
async function startGame(socket) {
    clearInterval(timerInterval); // Detener el temporizador
    socket.currentWord = await getRandomWordFromDB();
    
    io.emit('server:randomWord', socket.currentWord);

    // Iniciar un nuevo juego cuando el temporizador llegue a 0
    let timer = 60;
    timerInterval = setInterval(() => {
        timer--;
        if (timer === 0) {
            clearInterval(timerInterval);
            io.emit('server:timeUp');

            // Limpiar el arreglo de chats 
            // chats.length = 0;
            //io.emit('server:resetChat');
            startGame(socket);
        } else {
            io.emit('server:updateTimer', timer);
        }
    }, 1000);
}





//Socket para Dibujo



//::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

//ruta de paginas estaticas para llamarlas 
//app.use(express.static("public"));
//solucionar problema de rutas CSS
//app.use(express.static(path.join(__dirname, 'public')));
//procesar datos Jason
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

//Conectar Base de Datos ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::


const config ={
    user: 'postgres',
    host:'localhost',
    password: '123456',
    database: 'pinturillo'
};

const pool = new Pool(config);

app.use(express.json());
app.use(express.urlencoded({extended:false}));


// Agregar palabra ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

app.post('/insertarpalabra', function(req, res){
    const newformAndWord = req.body;
    const palabra = newformAndWord.newpalabra;
       // Filtrar que la palabra Exista $1 sintaxis de postgress
    const buscarPalabra = "SELECT * FROM palabra WHERE texto = $1";
    
    pool.query(buscarPalabra, [palabra], function(error, results){
        if(error){
            throw error;
        } else {

            if(results.rows.length > 0){
                res.send('<script>alert("La palabra ya existe"); window.location.href = "/src/editor.html";</script>');
            } else {
                const registro1 = "INSERT INTO palabra (texto) VALUES ($1)";
                pool.query(registro1, [palabra], function(error){
                    if(error){
                        throw error;
                    } else {
                        res.send('<script>alert("Palabra agregada"); window.location.href = "/src/editor.html";</script>');
                    }
                });
            }
        }
    });
});


//Eliminar la palabra si existe
app.delete('/eliminarpalabra/:palabra', (req, res) => {
    const palabra = req.params.palabra;

    // comprobar si la palabra existe
    const buscarPalabra = "SELECT * FROM palabra WHERE texto = $1";

    pool.query(buscarPalabra, [palabra], (error, results) => {
        if (error) {
            res.status(500).send('Error al buscar la palabra en la base de datos');
        } else {
            if (results.rows.length === 0) {
                res.status(404).send('La palabra no existe en la base de datos');
            } else {
                // La palabra existe, consulta SQL para eliminarla
                const eliminarPalabra = "DELETE FROM palabra WHERE texto = $1";

                pool.query(eliminarPalabra, [palabra], (error) => {
                    if (error) {
                        res.status(500).send('Error al eliminar la palabra de la base de datos');
                    } else {
                        res.status(200).send('Palabra eliminada correctamente');
                    }
                });
            }
        }
    });
});

//Editar Palabras

app.get('/verificarpalabra/:palabra', (req, res) => {
    const palabraOriginal = req.params.palabra;

    // consulta a la base de datos 
    pool.query('SELECT * FROM palabra WHERE texto = $1', [palabraOriginal], (error, results) => {
        if (error) {
            console.error('Error al verificar la palabra en la BD:', error);
            res.status(500).send('Error al verificar la palabra en la BD');
        } else {
          //Si la palabra Existe
            if (results.rows.length > 0) {
                res.sendStatus(200); 
            } else {
                res.sendStatus(404); 
            }
        }
    });
});


app.put('/editarpalabra/:palabraOriginal', (req, res) => {
    const palabraOriginal = req.params.palabraOriginal;
    const nuevaPalabra = req.body.nuevaPalabra;

    // consulta SQL para editar
    const editarPalabra = "UPDATE palabra SET texto = $1 WHERE texto = $2";

    pool.query(editarPalabra, [nuevaPalabra, palabraOriginal], (error) => {
        if (error) {
            res.status(500).send('Error al editar la palabra en la base de datos');
        } else {
            res.status(200).send('Palabra editada correctamente');
        }
    });
});


//Agregar Categoría :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

app.post('/insertarcategoria', function(req, res){
    const newformAndWord = req.body;
    const categoria = newformAndWord.newcategoria;

    // Filtrar que la palabra Exista $1 sintaxis de postgress
    const buscarCategoria = "SELECT * FROM categoria WHERE nombre = $1";

    pool.query(buscarCategoria, [categoria], function(error, results){
        if(error){
            throw error;
        } else {
            if(results.rows.length > 0){
                res.send('<script>alert("La categoría ya existe"); window.location.href = "/src/editor.html";</script>');
            } else {
                const registro1 = "INSERT INTO categoria (nombre) VALUES ($1)";
                pool.query(registro1, [categoria], function(error){
                    if(error){
                        throw error;
                    } else {
                        res.send('<script>alert("Categoría agregada"); window.location.href = "/src/editor.html";</script>');
                    }
                });
            }
        }
    });
});


//Eliminar Categoria

app.delete('/eliminarcategoria/:categoria', (req, res) => {
    const categoria = req.params.categoria;

    // Comprobar si la categoría existe
    const buscarCategoria = "SELECT * FROM categoria WHERE nombre = $1";

    pool.query(buscarCategoria, [categoria], (error, results) => {
        if (error) {
            res.status(500).send('Error al buscar la categoría en la base de datos');
        } else {
            if (results.rows.length === 0) {
                res.status(404).send('La categoría no existe en la base de datos');
            } else {
                // La categoría existe, consulta SQL para eliminarla
                const eliminarCategoria = "DELETE FROM categoria WHERE nombre = $1";

                pool.query(eliminarCategoria, [categoria], (error) => {
                    if (error) {
                        res.status(500).send('Error al eliminar la categoría de la base de datos');
                    } else {
                        res.status(200).send('Categoría eliminada correctamente');
                    }
                });
            }
        }
    });
});


//Editar Categoria

app.get('/verificarcategoria/:categoria', (req, res) => {
    const categoriaOriginal = req.params.categoria;

    // Realizar una consulta a la base de datos para verificar si la categoría existe
    pool.query('SELECT * FROM categoria WHERE nombre = $1', [categoriaOriginal], (error, results) => {
        if (error) {
            console.error('Error al verificar la categoría en la base de datos:', error);
            res.status(500).send('Error al verificar la categoría en la base de datos');
        } else {
            // Si la consulta devuelve resultados, la categoría existe en la base de datos
            if (results.rows.length > 0) {
                res.sendStatus(200); // Enviar código de estado 200 (OK)
            } else {
                res.sendStatus(404); // Enviar código de estado 404 (No encontrado)
            }
        }
    });
});

app.put('/editarcategoria/:categoriaOriginal', (req, res) => {
    const categoriaOriginal = req.params.categoriaOriginal;
    const nuevaCategoria = req.body.nuevaCategoria;

    // Consulta SQL para editar la categoría
    const editarCategoria = "UPDATE categoria SET nombre = $1 WHERE nombre = $2";

    pool.query(editarCategoria, [nuevaCategoria, categoriaOriginal], (error) => {
        if (error) {
            res.status(500).send('Error al editar la categoría en la base de datos');
        } else {
            res.status(200).send('Categoría editada correctamente');
        }
    });
});









//Iniciar Servidor :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

server.listen(3000,function(){
    console.log("El servidor es http://localhost:3000");
});




//configuraciones del motor de plantillas EJS
//se crea carpeta VIEWS que va a tener los archivos .ejs que son los que se encargan de comunicarse con la base de datos, 
//son archivos iguales que HTML pero .ejs los HTML puros son archivos estáticos, no se comunican con la BD.
/*app.set("view engine", "ejs");

app.get("/", function(req,res){
    res.render("index");
});*/



