const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Criação da tabela caso ainda não exista
(async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS registros (
      id SERIAL PRIMARY KEY,
      Projeto TEXT,
      TipoObra TEXT,
      TipoProjeto TEXT,
      TipoDoc TEXT,
      Disciplina TEXT,
      Sequencia TEXT,
      Revisao TEXT,
      CodigoArquivo TEXT,
      Data TEXT,
      Autor TEXT
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log("Tabela 'registros' verificada/criada.");
  } catch (err) {
    console.error("Erro ao criar tabela:", err);
  }
})();

module.exports = {
  insertData: async (dados, callback) => {
    const query = `
      INSERT INTO registros (
        Projeto, TipoObra, TipoProjeto, TipoDoc, Disciplina,
        Sequencia, Revisao, CodigoArquivo, Data, Autor
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;
    try {
      const result = await pool.query(query, [
        dados.Projeto,
        dados.TipoObra,
        dados.TipoProjeto,
        dados.TipoDoc,
        dados.Disciplina,
        dados.Sequencia,
        dados.Revisao,
        dados.CodigoArquivo,
        dados.Data,
        dados.Autor
      ]);
      callback(null, result.rows[0]);
    } catch (err) {
      callback(err);
    }
  },

  getAllData: async (callback) => {
    try {
      const result = await pool.query('SELECT * FROM registros');
      callback(null, result.rows);
    } catch (err) {
      callback(err, null);
    }
  },

  deleteRow: async (id, callback) => {
    try {
      await pool.query('DELETE FROM registros WHERE id = $1', [id]);
      callback(null);
    } catch (err) {
      callback(err);
    }
  },

  updateRow: async (id, dados, callback) => {
    const query = `
      UPDATE registros SET
        Projeto=$1, TipoObra=$2, TipoProjeto=$3, TipoDoc=$4, Disciplina=$5,
        Sequencia=$6, Revisao=$7, CodigoArquivo=$8, Data=$9, Autor=$10
      WHERE id=$11
    `;
    try {
      await pool.query(query, [
        dados.Projeto,
        dados.TipoObra,
        dados.TipoProjeto,
        dados.TipoDoc,
        dados.Disciplina,
        dados.Sequencia,
        dados.Revisao,
        dados.CodigoArquivo,
        dados.Data,
        dados.Autor,
        id
      ]);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
};
