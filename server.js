// server.js
const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

let clients = [];
wss.on('connection', ws => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});
function broadcast(message) {
  const msg = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ====== LOGIN ======
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.post('/login', (req, res) => {
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      res.cookie('authUser', data.user, { httpOnly: false });
      res.sendStatus(200);
    } catch {
      res.sendStatus(400);
    }
  });
});
app.get('/logout', (req, res) => {
  res.clearCookie('authUser');
  res.redirect('/login');
});

// ====== API ======
app.get('/api/registros', (req, res) => {
  const rows = db.prepare('SELECT * FROM registros ORDER BY id DESC').all();
  res.json(rows);
});

app.post('/api/data', (req, res) => {
  const data = req.body;
  const autor = req.cookies.authUser || 'DESCONHECIDO';

  const required = ['Projeto','TipoObra','TipoProjeto','TipoDoc','Disciplina','Sequencia','Revisao','CodigoArquivo','Data'];
  for (let field of required) {
    if (!data[field]) {
      return res.status(400).json({ error: `Campo obrigatório faltando: ${field}` });
    }
  }

  try {
    db.prepare(`
      INSERT OR REPLACE INTO registros
      (Projeto, TipoObra, TipoProjeto, TipoDoc, Disciplina, Sequencia, Revisao, CodigoArquivo, Data, Autor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.Projeto,
      data.TipoObra,
      data.TipoProjeto,
      data.TipoDoc,
      data.Disciplina,
      data.Sequencia,
      data.Revisao,
      data.CodigoArquivo,
      data.Data,
      autor
    );

    broadcast({ action: 'update' });
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar no banco.' });
  }
});

app.delete('/api/data/:codigoArquivo', (req, res) => {
  db.prepare('DELETE FROM registros WHERE CodigoArquivo = ?').run(req.params.codigoArquivo);
  broadcast({ action: 'delete' });
  res.sendStatus(200);
});

app.put('/api/data/:codigoArquivo/campo', (req, res) => {
  const { campo, valor } = req.body;
  if (!['Sequencia', 'Revisao'].includes(campo)) {
    return res.status(400).json({ error: 'Campo inválido.' });
  }
  db.prepare(`UPDATE registros SET ${campo} = ? WHERE CodigoArquivo = ?`).run(valor, req.params.codigoArquivo);
  broadcast({ action: 'update' });
  res.sendStatus(200);
});

app.get('/api/exportar-csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM registros').all();
  if (!rows.length) {
    return res.send('Nenhum registro para exportar.');
  }
  const header = Object.keys(rows[0]).join(',');
  const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
  res.header('Content-Type', 'text/csv');
  res.attachment('dados.csv').send(csv);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
