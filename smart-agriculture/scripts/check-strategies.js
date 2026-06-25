const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function main() {
  const db = await open({
    filename: './smart_agriculture.db',
    driver: sqlite3.Database
  });

  try {
    // Check if strategies table exists
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='strategies'"
    );
    console.log('Strategies table exists:', !!tableExists);

    if (tableExists) {
      const strategies = await db.all('SELECT * FROM strategies');
      console.log('Current strategies:', JSON.stringify(strategies, null, 2));
    } else {
      console.log('Strategies table does not exist. Creating it...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS strategies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          actuator_id TEXT NOT NULL,
          action TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Strategies table created.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.close();
  }
}

main();
