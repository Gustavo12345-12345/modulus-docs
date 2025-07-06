const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./db_postgres');


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

// Login
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

// GET registros
app.get('/api/registros', (req, res) => {
  db.all('SELECT * FROM registros ORDER BY id DESC', (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao consultar banco.' });
    }
    res.json(rows);
  });
});

// POST - inserir ou atualizar
app.post('/api/data', (req, res) => {
  const data = req.body;
  const autor = req.cookies.authUser || 'DESCONHECIDO';

  const required = ['Projeto','TipoObra','TipoProjeto','TipoDoc','Disciplina','Sequencia','Revisao','CodigoArquivo','Data'];
  for (let field of required) {
    if (!data[field]) {
      console.error('Campo faltando:', field);
      return res.status(400).json({ error: `Campo obrigatório faltando: ${field}` });
    }
  }

  const sql = `
    INSERT OR REPLACE INTO registros
    (Projeto, TipoObra, TipoProjeto, TipoDoc, Disciplina, Sequencia, Revisao, CodigoArquivo, Data, Autor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
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
  ];

  db.run(sql, values, function(err) {
    if (err) {
      console.error('Erro SQL:', err);
      return res.status(500).json({ error: 'Erro ao salvar no banco.' });
    }
    console.log('Registro salvo com sucesso!');
    broadcast({ action: 'update' });
    res.sendStatus(200);
  });
});

// DELETE
app.delete('/api/data/:codigoArquivo', (req, res) => {
  const codigo = req.params.codigoArquivo;
  db.run('DELETE FROM registros WHERE CodigoArquivo = ?', [codigo], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao deletar.' });
    }
    broadcast({ action: 'delete' });
    res.sendStatus(200);
  });
});

// PUT - atualizar campo específico
app.put('/api/data/:codigoArquivo/campo', (req, res) => {
  const { campo, valor } = req.body;
  const codigo = req.params.codigoArquivo;

  if (!['Sequencia', 'Revisao'].includes(campo)) {
    return res.status(400).json({ error: 'Campo inválido.' });
  }

  const sql = `UPDATE registros SET ${campo} = ? WHERE CodigoArquivo = ?`;
  db.run(sql, [valor, codigo], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao atualizar campo.' });
    }
    broadcast({ action: 'update' });
    res.sendStatus(200);
  });
});

// Exportar CSV
app.get('/api/exportar-csv', (req, res) => {
  db.all('SELECT * FROM registros', (err, rows) => {
    if (err || !rows.length) {
      return res.send('Nenhum registro para exportar.');
    }
    const header = Object.keys(rows[0]).join(',');
    const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('dados.csv').send(csv);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
