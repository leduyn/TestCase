const path = require('path');
const { Client } = require(path.join(__dirname, '..', 'server', 'node_modules', 'pg'));
const bcrypt = require(path.join(__dirname, '..', 'server', 'node_modules', 'bcryptjs'));
const crypto = require('crypto');

async function createAdmin() {
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

    // Check existing users
    const existing = await client.query('SELECT COUNT(*) as cnt FROM users');
    if (parseInt(existing.rows[0].cnt) > 0) {
      console.log('Admin user already exists! Skipping...');
      const users = await client.query('SELECT email, full_name, role FROM users');
      users.rows.forEach(u => console.log(' -', u.email, '|', u.full_name, '|', u.role));
      return;
    }

    // Create admin
    const email = 'admin@vinago.com';
    const password = 'Admin@123';
    const fullName = 'System Admin';
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, 'ADMIN', NOW(), NOW())`,
      [id, email, passwordHash, fullName]
    );

    console.log('\n✅ Admin user created successfully!');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   Role: ADMIN');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

createAdmin();
