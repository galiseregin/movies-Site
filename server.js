const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const cookie = require('cookie');
const querystring = require('querystring');

const htmlFilePath = path.join(__dirname, 'movies_with_javascript.html');
const authFilePath = path.join(__dirname, 'auth.html');
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'disney_characters_db';
const charactersCollectionName = 'characters';
const usersCollectionName = 'users';

async function connectToMongo() {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db(dbName);
}

function getLoggedInUser(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    return cookies.username;  // Returns the logged in user's username or undefined if not logged in
}

const server = http.createServer(async (req, res) => {
    const db = await connectToMongo();
	const loggedInUser = getLoggedInUser(req);

    if (req.url === '/' && req.method === 'GET') {
        if (!loggedInUser) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'text/html');
            res.end('<h1>Access Denied: Please <a href="/auth.html">login</a></h1>');
            return;
        }

        const characters = await db.collection(charactersCollectionName).find().toArray();
		
        const characterRows = characters.map(character => `
            <tr>
                <td>${character.name}</td>
                <td>${character.year}</td>
                <td>${character.weapon}</td>
                <td>${character.villain}</td>
                <td><img src="${character.picture}" alt="${character.name}" width="100"></td>
            </tr>
        `).join('');

        fs.readFile(htmlFilePath, 'utf8', (err, data) => {
            const page = data.replace('{{characters}}', characterRows);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(page);
        });
    } 
	
	
	else if (req.url === '/auth.html' && req.method === 'GET') {
        fs.readFile(authFilePath, 'utf8', (err, data) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(data);
        });
    }
	
	
	else if (req.url === '/register' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const { username, password } = querystring.parse(body);

            const existingUser = await db.collection(usersCollectionName).findOne({ username });
            if (existingUser) {
                res.statusCode = 400;
                res.end('<h1>User already exists</h1>');
                return;
            }

            await db.collection(usersCollectionName).insertOne({ username, password });
            res.writeHead(302, { 'Location': '/auth.html' });
            res.end();
        });
    }

	else if (req.url === '/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            var { username, password } = querystring.parse(body);
			//password = JSON.parse(password)
            //const user = await db.collection(usersCollectionName).findOne({ username, password });
			const query = { username, password }; // Parse the raw body directly as a JSON object
			
			console.log(query);
			const user = await db.collection(usersCollectionName).findOne(query);


            if (user) {
                res.setHeader('Set-Cookie', `username=${username}; Path=/`);
                res.writeHead(302, { 'Location': '/' });
                res.end();
            } else {
                res.statusCode = 401;
                res.end('<h1>Invalid username or password</h1>');
            }
        });
    }

	else if (req.url === '/logout' && req.method === 'POST') {
        //res.setHeader('Set-Cookie', 'username=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        res.writeHead(302, { 'Location': '/auth.html' });
        res.end();
    } 
	
	
	else if (req.url === '/addcharacters' && req.method === 'POST') {
		
		if (!loggedInUser) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'text/html');
            res.end('<h1>Access Denied: Please <a href="/auth.html">login</a></h1>');
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const { name, year, weapon, villain, picture } = querystring.parse(body);
            const existingCharacter = await db.collection(charactersCollectionName).findOne({ name });

            if (existingCharacter) {
                res.statusCode = 400;
                res.end('<h1>Character already exists</h1>');
                return;
            }

            await db.collection(charactersCollectionName).insertOne({ name, year, weapon, villain, picture });
            res.writeHead(302, { 'Location': '/' });
            res.end();
        });
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
