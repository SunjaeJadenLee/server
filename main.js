const express = require('express');
const hdbs = require('express-handlebars');
const sessions = require('express-session');
const dotenv = require('dotenv');
dotenv.config();
const sequelize = require('sequelize');
const sanitizeHTML = require('sanitize-html');
const pg = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

var session;

const HTTP_PORT = process.env.PORT || 8000;

const seq = new sequelize('d9ujm213gftcu8', 'hxsfcouwqezsve', '2509ec298306086e1f888d00d53fdf1bc444956db52a7a3a69868d85d37e9fe5', {
    host: 'ec2-54-204-40-248.compute-1.amazonaws.com',
    dialect: 'postgres',
    port: 5432,
    dialectOptions: {
        ssl: true,
    }
})
const app = express();

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(sessions({
    secret: '@!$!@%!@3asda',
    resave: false,
    saveUninitialized: true
}))
const users = seq.define('users',
    {
        id: {
                type: sequelize.INTEGER,
                primaryKey: true,
                autoIncrement:true
            },
        userName: sequelize.STRING,
        password: sequelize.STRING,
        firstName: sequelize.STRING,
        lastName: sequelize.STRING,
        city: sequelize.STRING,
        state: sequelize.STRING,
        postal: sequelize.STRING,
        phoneNumber: sequelize.STRING
    });

const boards = seq.define('boards', {
    id: {
        type: sequelize.INTEGER,
        primaryKey: true,
        autoIncrement:true
    },
    boardTitle: sequelize.STRING,
    boardContent: sequelize.STRING,
    userName: sequelize.STRING
})

const comments = seq.define('comments', {
    id: {
        type: sequelize.INTEGER,
        primaryKey: true,
        autoIncrement:true
    },
    boardId: sequelize.INTEGER,
    userName: sequelize.STRING,
    commentContent: sequelize.STRING
})

boards.hasMany(comments, { foreignKey: 'fk_boardId', sourceKey: 'id' });
comments.belongsTo(boards, { foreignKey: 'fk_boardId', targetKey: 'id', as: 'Commnet' });

const hbs = hdbs.create({
    extname: 'hbs',
    layoutsDir: 'views/layouts',
    defaultLayout: 'layout',
    helpers:{
        sanitized: (text)=>{
            return sanitizeHTML(text);
        }
    }
})

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

app.use(express.static('public'));
app.use(express.static('public/css'));
app.get('/', (req, res) => {
    session = req.session;
    res.render('index', { user: session.user });
})
app.get('/signup', (req, res) => {
    session = req.session;
    res.render('accounts/signup');
})

app.post('/signup', (req, res) => {
    session = req.session;
    seq.sync().then(() => users.findAll({
        where: { userName: req.body.userName }
    })).then(response => {
        if (response.length >= 1) {
            res.render('accounts/signup', { info: "User Name already exists." });
        } else {
            if (req.body.password != req.body.confirmPassword) {
                res.render('accounts/signup', { info: "Password and Confirm Password do not match" });
            } else {
                seq.sync()
                    .then(() => users.create({
                        userName: req.body.userName,
                        firstName: req.body.firstName,
                        lastName: req.body.lastName,
                        password: req.body.password,
                        city: req.body.city,
                        state: req.body.state,
                        postal: req.body.postal,
                        phoneNumber: req.body.phoneNumber
                    }));
                res.redirect('/');
            }

        }
    });

})

app.get('/login', (req, res) => {
    res.render('accounts/login');
})

app.post('/login', (req, res) => {
    session = req.session;
    seq.sync().then(() => users.findOne({
        where: { userName: req.body.userName, password: req.body.password }
    })).then(response => {
        if (response) {
            session.user = response;
            res.render('index', { user: session.user });
        } else {
            res.render('accounts/login', { info: "Your User Name or Password is invalid" });
        }

    });
})

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        console.log(err);
        res.redirect('/');
    })
})

app.get('/userProfile', (req, res) => {
    console.log(req.session.user.userName);
    var name = req.session.user.userName
    session = req.session;
    seq.sync().then(() => boards.findAll({
        where: { userName: name }
    })).then(response => res.render('accounts/userProfile', { user: session.user, board: response }));

})

app.get('/board', (req, res) => {
    session = req.session;
    seq.sync().then(() => boards.findAll())
        .then(response => res.render('boards/board', { board: response, user: session.user }));

})

app.post('/board_search', (req, res) => {
    session = req.session;
    seq.sync().then(() => {
        if (req.body.searchList == "Title") {

            boards.findAll({
                where: {
                    boardTitle: seq.where(seq.fn('LOWER', sequelize.col('boardTitle')), 'LIKE', '%' + req.body.searchContent + '%')
                }
            }).then(response => res.render('boards/board', { board: response, user: session.user }))
        } else if (req.body.searchList == "User Name") {
            boards.findAll({
                where: {
                    userName: seq.where(seq.fn('LOWER', sequelize.col('userName')), 'LIKE', '%' + req.body.searchContent + '%')

                }
            }).then(response => res.render('boards/board', { board: response, user: session.user }))
        }
    })
})

app.get('/create', (req, res) => {
    session = req.session;
    if (session.user == undefined) {
        res.render('accounts/login',{info:"You cannot create a board without login"});
        return;
    }else{
        res.render('boards/create', { user: session.user });
    }

})

app.post('/create/:value', (req, res) => {
    if (session.user == undefined) {
        res.redirect('/login');
        return;
    }
    session = req.session;
    if (session.user.userName == req.params.value) {
        seq.sync().then(boards.findById(req.body.id)
            .then(response => res.render('boards/create', { board: response, user: session.user })));
    }
    else {
        seq.sync().then(() => boards.findAll())
            .then(response => res.render('boards/board', { info: "Modification is not possible except by the author.", board: response, user: session.user }));
    }
})

app.post('/create_edit', (req, res) => {
    session = req.session;
    seq.sync().then(boards.update(req.body, { where: { id: req.body.id } }));
    seq.sync().then(() => boards.findAll())
        .then(response => res.render('boards/board', { board: response, user: session.user }));
})

app.post('/comment_create', (req, res) => {
    session = req.session;
    if(session.user == undefined){
        res.render('accounts/login',{info:"You cannot comment without login"});
    }else{
        var aComment = seq.sync()
        .then(() => comments.create({
            userName: session.user.userName,
            boardId: req.body.boardId,
            commentContent: req.body.commentContent
        }))
        seq.sync().then(comments.findAll({where:{ boardId : req.body.boardId}})).then(resp=>console.log(resp));
        res.redirect(`/detail/${req.body.boardId}`);
    }
})

app.get('/detail/:value', (req, res) => {
    session = req.session;
    seq.sync().then(boards.findById(req.params.value)
        .then(response => {
            seq.sync().then(comments.findAll({ where: { boardId: response.id } })
            .then(resp => {
                res.render('boards/detail', { board: response, user: session.user, comment: resp })
            }))
        }));
})

app.post('/create', (req, res) => {
    session = req.session;
    seq.sync()
        .then(() => boards.create({
            userName: req.body.userName,
            boardTitle: req.body.boardTitle,
            boardContent: req.body.boardContent,
        }));
    res.redirect('/');
})

app.get('/delete/:value/:title', (req, res) => {
    session = req.session;
    if (session.user.userName == req.params.value) {
        seq.sync().then(() => boards.destroy({
            where: {
                userName: req.params.value,
                boardTitle: req.params.title
            }
        }).then(res.redirect('/')))
    } else {
        seq.sync().then(() => boards.findAll())
            .then(response => res.render('boards/board', { info: "You cannot delete it except by the author.", board: response, user: session.user }));
    }
})


app.listen(HTTP_PORT, () => {
    console.log('port 3000 start');
});