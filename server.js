const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'default_secret_key';
const APP_NAME = process.env.APP_NAME || 'My App';

app.use(express.json());
app.use(express.static('.'));
app.use(cookieParser());

function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Подключено к базе данных SQLite.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        name TEXT,
        avatar TEXT,
        status TEXT,
        last_online DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS friends (
        userId INTEGER,
        friendId INTEGER,
        PRIMARY KEY (userId, friendId),
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (friendId) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        name TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS chat_participants (
        chatId INTEGER,
        userId INTEGER,
        FOREIGN KEY (chatId) REFERENCES chats(id),
        FOREIGN KEY (userId) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        senderId INTEGER,
        chatId INTEGER,
        text TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (senderId) REFERENCES users(id),
        FOREIGN KEY (chatId) REFERENCES chats(id)
    )`);
});

app.post('/register', (req, res) => {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const finalName = `${name} //1L`;

    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка хэширования пароля' });
        }
        db.run('INSERT INTO users (username, password, name, avatar, status) VALUES (?, ?, ?, ?, ?)', 
        [username, hashedPassword, finalName, '', 'offline'], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'Пользователь успешно зарегистрирован', id: this.lastID });
        });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сравнения паролей' });
            }
            if (!isMatch) {
                return res.status(401).json({ error: 'Неверный логин или пароль' });
            }
            const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
            res.status(200).json({ message: 'Вход успешен' });
        });
    });
});

app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.sendStatus(200);
});

app.get('/user', authenticateToken, (req, res) => {
    db.get('SELECT id, name, username, avatar FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(user);
    });
});

app.put('/user/profile', authenticateToken, (req, res) => {
    const { name, avatar } = req.body;
    if (!name && !avatar) {
        return res.status(400).json({ error: 'Нужно указать имя или аватар.' });
    }
    const updateFields = [];
    const updateValues = [];
    if (name) {
        const finalName = `${name} //1L`;
        updateFields.push('name = ?');
        updateValues.push(finalName);
    }
    if (avatar) {
        updateFields.push('avatar = ?');
        updateValues.push(avatar);
    }
    updateValues.push(req.user.id);
    db.run(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateValues, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json({ message: 'Профиль успешно обновлен.' });
    });
});

app.get('/chats', authenticateToken, (req, res) => {
    db.all(`
        SELECT c.id, c.name, m.text AS last_message
        FROM chat_participants cp
        JOIN chats c ON cp.chatId = c.id
        LEFT JOIN messages m ON c.id = m.chatId
        WHERE cp.userId = ?
        ORDER BY m.timestamp DESC
    `, [req.user.id], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/messages/:chatId', authenticateToken, (req, res) => {
    const chatId = req.params.chatId;
    db.all(`
        SELECT m.*, u.name AS senderName
        FROM messages m
        JOIN users u ON m.senderId = u.id
        WHERE m.chatId = ?
        ORDER BY m.timestamp ASC
    `, [chatId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/message', authenticateToken, (req, res) => {
    const { chatId, text } = req.body;
    const senderId = req.user.id;
    if (!chatId || !text) {
        return res.status(400).json({ error: 'ID чата и текст сообщения обязательны.' });
    }
    db.run(
        'INSERT INTO messages (senderId, chatId, text) VALUES (?, ?, ?)',
        [senderId, chatId, text],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            db.get('SELECT timestamp FROM messages WHERE id = ?', [this.lastID], (err, row) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ id: this.lastID, message: 'Сообщение отправлено.', timestamp: row.timestamp });
            });
        }
    );
});

app.get('/searchUsers', authenticateToken, (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.json([]);
    }
    db.all(`
        SELECT id, name, avatar FROM users WHERE name LIKE ? OR username LIKE ? LIMIT 10
    `, [`%${query}%`, `%${query}%`], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/createChat', authenticateToken, (req, res) => {
    const { friendId } = req.body;
    const userId = req.user.id;

    if (userId === friendId) {
        return res.status(400).json({ error: 'Нельзя создать чат с самим собой.' });
    }

    db.get(`
        SELECT c.id FROM chats c
        JOIN chat_participants cp1 ON c.id = cp1.chatId
        JOIN chat_participants cp2 ON c.id = cp2.chatId
        WHERE cp1.userId = ? AND cp2.userId = ? AND c.type = 'private'
    `, [userId, friendId], (err, chat) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (chat) {
            return res.status(200).json({ message: 'Чат уже существует', chatId: chat.id });
        }

        db.get('SELECT name FROM users WHERE id = ?', [friendId], (err, friend) => {
            if (err || !friend) {
                return res.status(404).json({ error: 'Пользователь не найден.' });
            }

            db.run('INSERT INTO chats (type, name) VALUES (?, ?)', ['private', friend.name], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                const newChatId = this.lastID;
                db.run('INSERT INTO chat_participants (chatId, userId) VALUES (?, ?), (?, ?)', [newChatId, userId, newChatId, friendId], (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.status(201).json({ message: 'Чат успешно создан.', chatId: newChatId });
                });
            });
        });
    });
});

app.get('/chats.html', authenticateToken, (req, res) => {
    res.sendFile(__dirname + '/chats.html');
});

const server = app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    console.log('Новое WebSocket-соединение установлено.');
    ws.on('message', message => {
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });
});