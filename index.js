const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true}));
app.use(express.json());
app.use(express.static('views'));
app.use(session({
    secret: 'segredo-super-seguro',
    resave: false,
    saveUninitialized: true,
}));

const urlMongo = 'mongodb+srv://Caires:pedrinho_08@cluster0.i0bi5jo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const nomeBanco = 'sistemaLogin';

app.get('/registro', redirecionarSeLogado, (req, res) => {
    res.sendFile(__dirname + '/views/registro.html');
});

app.post('/registro', async (req, res) => {
    const cliente = new MongoClient(urlMongo)
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios');

        const usuarioExistente = await colecaoUsuarios.findOne({ usuario: req.body.usuario});

        if (usuarioExistente) {
            res.redirect('/registro?erro=usuario-existe');
        } else {
            const senhaCriptografada = await bcrypt.hash(req.body.senha, 10);

            await colecaoUsuarios.insertOne({
                usuario: req.body.usuario,
                senha: senhaCriptografada
            });
            res.redirect('/login');
        }
    } catch (erro) {
        res.send('Erro ao registrar usuário');
    } finally {
        cliente.close()
    }
});

app.get('/login', redirecionarSeLogado, (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/home.html');
});

app.post('/login', async (req, res) => {
    const cliente = new MongoClient(urlMongo);
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios')

        const usuario = await colecaoUsuarios.findOne({ usuario: req.body.usuario });

        if (usuario && await bcrypt.compare(req.body.senha, usuario.senha)) {
            req.session.usuario = req.body.usuario;
            res.redirect('/bemvindo');
        } else {
            res.redirect('/erro');
        }
    } catch (erro) {
        res.send('Erro ao realizar login');
    } finally {
        cliente.close();
    }
});

function protegerRota(req, res, proximo) {
    if (req.session.usuario) {
        proximo();
    } else {
        res.redirect('/login')
    }
}

function redirecionarSeLogado(req, res, proximo) {
    if (req.session.usuario) {
        res.redirect('/');
    } else {
        proximo();
    }
}

app.get('/bemvindo', protegerRota, (req,res) => {
    res.sendFile(__dirname + '/views/bemvindo.html');
});

app.get('/erro', (req, res) => {
    res.sendFile(__dirname + '/views/erro.html');
});

app.get('/home', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/views/home.html');
});

app.get('/plataforma', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/views/plataforma.html');
});

// Nova rota para a página de perfil
app.get('/perfil', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/views/perfil.html');
});

// Rota para buscar dados do perfil
app.get('/perfil/dados', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo);
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoPerfis = banco.collection('perfis');

        const perfil = await colecaoPerfis.findOne({ usuario: req.session.usuario });
        
        res.json(perfil || {});
    } catch (erro) {
        console.log('Erro ao buscar perfil:', erro);
        res.status(500).json({ erro: 'Erro ao buscar dados do perfil' });
    } finally {
        cliente.close();
    }
});

// Rota para atualizar dados do perfil
app.post('/perfil/atualizar', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo);
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoPerfis = banco.collection('perfis');

        const dadosPerfil = {
            usuario: req.session.usuario,
            nomeCompleto: req.body.nomeCompleto,
            email: req.body.email,
            bio: req.body.bio,
            instituicao: req.body.instituicao,
            corAvatar: req.body.corAvatar,
            dataAtualizacao: new Date()
        };

        await colecaoPerfis.updateOne(
            { usuario: req.session.usuario },
            { $set: dadosPerfil },
            { upsert: true }
        );

        res.json({ sucesso: true, mensagem: 'Perfil atualizado com sucesso' });
    } catch (erro) {
        console.log('Erro ao atualizar perfil:', erro);
        res.status(500).json({ erro: 'Erro ao atualizar perfil' });
    } finally {
        cliente.close();
    }
});

app.get('/sair', (req,res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send('Erro ao sair!');
        }
        res.redirect('/login');
    });
});

app.get('/status', (req, res) => {
    res.json({ 
        logado: !!req.session.usuario,
        usuario: req.session.usuario || null 
    });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`)
})