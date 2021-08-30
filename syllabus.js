var mysql = require('mysql2');
var conn = mysql.createConnection({
    host: "165.22.14.77",
    user: "b27",
    password: "b27",
    database: "dbSyllabus"
});

var express = require('express');
var app = express();
app.use(express.urlencoded({extended: true}));
app.use(express.json());
var port = 4000;

var validator = require("email-validator");
var passwordValidator = require('password-validator');
const { v4: uuidv4 } = require('uuid');

const validateTokenMiddleware = (req, res, next) => {
    const path = req.path;
    if(path == "/api/signup" || path == "/api/login") {
        next();
    }
    else {
        const authorizeHeader = req.headers.authorization;
        if(authorizeHeader == undefined || authorizeHeader == null) {
            res.status(401).send({"Message":"Unauthorised"});
        }
        else {
            req.token=authorizeHeader;
            next();
        }
    }
}

const getUserIdFromTokenMiddleware = (req, res, next) => {
    const path = req.path;
    if(path == "/api/signup" || path == "/api/login") {
        next();
    }
    else {
        var sqlQuery = "select userId from users where token = ?";
        var values = [req.token];
        console.log(values);
        conn.execute(sqlQuery,values, (err,result, fields) => {
            if(err) throw err;
            if(result.length != 0) {
                var userId = result[0].userId;
                req.userId = userId;
                next();
            }
            else {
                res.status(401).send({"Message":"unauthorised user"})
            }
        })
    }
}

app.use(validateTokenMiddleware);
app.use(getUserIdFromTokenMiddleware);

app.post('/api/signup', (req,res)=>{
    var userName = req.body.userName;
    var password = req.body.password;
    if(validator.validate(userName) == true)
    {
        var schema = new passwordValidator();
        schema
        .is().min(6)                                    
        .has().uppercase()                              
        .has().lowercase()                              
        .has().digits(1)
        .has().symbols(1)                              
        .has().not().spaces()
        if(schema.validate(password) == true)
        {
            var token = uuidv4();
            var sqlQuery = "insert into users(userName, password, token) values(?, ?, ?)";
            var values = [userName, password, token];
            conn.execute(mysql.format(sqlQuery, values), (err, result, fields)=>{
                if (err) throw err;
                if(result.length != 0) {
                    res.status(201);
                    res.send(result);    
                }
            })
        }
        else {
            res.status(400);
            res.send({"Error Message":"Password should contain altleast one digit, uppercase, lowercase, special character and minimum 6 characters."})
        }
    }
    else {
        res.status(400);
        res.send({"Error Message":"invalid email/please enter email"});
    }
})

app.post('/api/login', (req,res)=>{
    const errorResponse = {};
    var userName = req.body.userName;
    var password = req.body.password;
    var sqlQuery = "select token from users where userName = ? and password = ?";
    var values = [userName, password];
    if(values[0] == null || values[1] == null) {
        if(values[0] == null)
        {
            errorResponse["userName"] = "Please enter username.";
        }
        if(values[1] == null)
        {
            errorResponse["password"] = "Please enter password.";
        }
    }
    else {
        conn.promise().execute(sqlQuery,values)
        .then((result)=>{
            if(result.length != 0) {
                res.status(200);
                res.send(result);    
            }
            else {
                res.status(401);
                res.send({"errorMessag":"Invalid userName/password"});
            }
        }).catch(err => console.log(err));
    }
})

app.get('/api/syllabus', (req, res) => {
    var userId = req.userId;
    conn.promise().execute("select syllabusId, syllabusTitle, description, objectives from syllabus where userId = ?", [userId])
   .then((result)=> {
        if(result[0].length != 0) {
            res.status(200);
            res.send(result[0]);
        }
    }).catch(err => console.log(err));
})

app.post('/api/syllabus', (req, res) => {
    const errorResponse = {};
    const sqlQuery = "insert into syllabus(syllabusTitle, description, objectives, userId, status) VALUES (?, ?, ?, ?, 1)";
    const values = [req.body.syllabusTitle, req.body.description, req.body.objectives, req.userId];
    console.log(values);
    if(values[0] == null || values[1] == null || values[2] == null || values[3] == null)
    {
        res.status(400)
        if(values[0] == null)
        {
            errorResponse["syllabusTitle"] = "Please enter syllabus title.";
        }
        if(values[1] == null)
        {
            errorResponse["description"] = "Please enter description.";
        }
        if(values[2] == null)
        {
            errorResponse["objective"] = "Please enter objectives.";
        }
        if(values[3] == null)
        {
            errorResponse["userId"] = "Please enter userId.";
        }
        res.send(errorResponse);
    }
    else {
        conn.promise().execute(sqlQuery, values)
        .then((result) => {
            if(result.length != 0) {
                res.status(201).send({"Message":"Inserted successfully."});    
            }		
            else {
                res.status(400).send({"Message":"400 Bad Request."});
            }
        }).catch(err => console.log(err));
    }
})

app.put('/api/syllabus/:syllabusId', (req, res)=>{
    const syllabusId = req.params.syllabusId;
    validateSyllabusId(syllabusId, res, () => {
        const sqlQuery = "UPDATE syllabus SET syllabusTitle = ?, description = ?, objectives = ? WHERE syllabusId = ? and userId = ?";
        const values = [req.body.syllabusTitle, req.body.description, req.body.objectives, syllabusId, req.userId];
        conn.promise().execute(sqlQuery,values)
        .then((result) => {
            if(result[0].affectedRows != 0) {
                res.status(200).send({"message":"updated succcessfully."});
            }
            else {
                res.status(403).send({"Message":"No access."});
            }
        }).catch(err => console.log(err));
    })
})

app.delete('/api/syllabus/:syllabusId', (req, res) => {
    const syllabusId = req.params.syllabusId;
    validateSyllabusId(syllabusId, res, () => {
        const sqlQuery = "UPDATE syllabus SET status = 0 WHERE syllabusId = ? and userId = ?";
        const values = [syllabusId, req.userId]
        conn.promise().execute(sqlQuery,values)
        .then((result) => {
            if(result[0].affectedRows != 0) {
                res.status(204).send(result);
            }
            else {
                res.status(403).send({"Message":"No access."});
            }
        }).catch(err => console.log(err));
    })
})

app.get('/api/syllabus/:syllabusId', (req, res) => {    
    var syllabusId = req.params.syllabusId;
    validateSyllabusId(syllabusId, res, () => {
        const sqlQuery = "select syllabusId, syllabusTitle, description, objectives from syllabus where syllabusId = ? and userId = ?";
        const values = [syllabusId, req.userId];
        conn.promise().execute(sqlQuery,values)
        .then( (result) => {
            if(result[0].length != 0) {
                res.status(200).send(result[0]);
            }
            else {
                res.status(403).send({"Message":"No access."});
            }
        }).catch(err => console.log(err));
    }); 
})

const validateSyllabusId = (syllabusId, res, callback) => {
    const selectQuery = "select syllabusId from syllabus where syllabusId =? and status = 1";
    conn.promise().execute(selectQuery,[syllabusId])
    .then((result) => {
        if(result.length != 0) {
            callback();   
        }
        else {
            res.status(404).send({"Message":"404 Not found."})
        }
    }).catch(err => console.log(err));
}

app.listen(port, () => {
    console.log("Successfull.");
})