const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let dbPromise;
let isInitialized = false;

async function initDb() {
  const db = await open({
    filename: path.join(__dirname, 'vocabopd.sqlite'),
    driver: sqlite3.Database
  });

  console.log('✓ Successfully connected to SQLite database (Local Mode)');

  // Create tables using SQLite syntax
  await db.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      hospital VARCHAR(255),
      password VARCHAR(255) NOT NULL,
      specialty VARCHAR(100),
      phone VARCHAR(20),
      profile_picture TEXT,
      experience VARCHAR(50),
      location VARCHAR(100),
      license VARCHAR(100),
      education VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER REFERENCES doctors(id),
      patient VARCHAR(255) NOT NULL,
      age VARCHAR(10),
      gender VARCHAR(20),
      symptoms TEXT,
      medical_history TEXT,
      transcript TEXT,
      language VARCHAR(50) DEFAULT 'english',
      consultation_date TIMESTAMP,
      consultation_time VARCHAR(20),
      diagnosis TEXT,
      prescription TEXT,
      advice TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER REFERENCES doctors(id),
      patient VARCHAR(255) NOT NULL,
      time VARCHAR(20) NOT NULL,
      type VARCHAR(50) DEFAULT 'Consultation',
      appointment_date DATE DEFAULT CURRENT_DATE,
      status VARCHAR(20) DEFAULT 'scheduled',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      unread BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('✓ SQLite tables initialized. You can login without PostgreSQL.');
  isInitialized = true;
  return db;
}

dbPromise = initDb().catch(console.error);

// Mock the 'pg' Pool interface
const pool = {
  query: async function(text, params = [], callback) {
    // Handle overload: pool.query('SELECT...', callback)
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    try {
      const db = await dbPromise; // Wait for init!
      
      // Convert PostgreSQL $1, $2, $3 to SQLite ? positional parameters
      const sqliteQuery = text.replace(/\$\d+/g, '?');
      
      // Mock for standard ping query used in server.js
      if (sqliteQuery.toUpperCase().includes('SELECT NOW()')) {
         const res = { rows: [{ now: new Date() }], rowCount: 1 };
         if (callback) return callback(null, res);
         return res;
      }
      
      const isSelect = sqliteQuery.trim().toUpperCase().startsWith('SELECT');
      const hasReturning = sqliteQuery.toUpperCase().includes('RETURNING');
      
      let res;
      if (isSelect || hasReturning) {
        // We use .all() to get an array of results, which supports RETURNING in SQLite >3.35
        const rows = await db.all(sqliteQuery, ...params);
        res = { rows: rows || [], rowCount: rows ? rows.length : 0 };
      } else {
        // Insert / Update / Delete without RETURNING
        const result = await db.run(sqliteQuery, ...params);
        res = { rows: [], rowCount: result.changes };
      }
      
      if (callback) return callback(null, res);
      return res;
    } catch (error) {
      console.error('SQLite Query Error:');
      console.error('Query:', text);
      console.error('Params:', params);
      
      // Let the pg style error surface
      if (callback) return callback(error);
      throw error;
    }
  }
};

module.exports = pool;