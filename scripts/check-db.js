const path = require('path');
const { Client } = require(path.join(__dirname, '..', 'server', 'node_modules', 'pg'));

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '123456',
    database: 'testcasevinago_db',
  });

  try {
    await client.connect();
    console.log('Connected to testcasevinago_db');

    // List tables
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    console.log('\n=== Tables in database ===');
    if (tables.rows.length === 0) {
      console.log('(No tables found!)');
    } else {
      tables.rows.forEach(r => console.log(' -', r.table_name));
    }

    // Check users count
    try {
      const users = await client.query('SELECT COUNT(*) as cnt FROM users');
      console.log('\n=== Users count:', users.rows[0].cnt, '===');
      
      if (parseInt(users.rows[0].cnt) > 0) {
        const userList = await client.query('SELECT id, email, full_name, role FROM users');
        userList.rows.forEach(u => console.log(' -', u.email, '|', u.full_name, '|', u.role));
      }
    } catch (e) {
      console.log('\nCould not query users table:', e.message);
    }
  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
  }
}

main();
