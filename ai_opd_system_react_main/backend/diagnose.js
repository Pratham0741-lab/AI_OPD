console.log("🔍 VocabOPD System Diagnostic\n");
console.log("=" .repeat(50));

// Check 1: Node.js version
console.log("\n1. Node.js Version:");
console.log("   " + process.version);

// Check 2: Required modules
console.log("\n2. Checking Required Modules:");
const modules = ['express', 'cors', 'pg', 'bcrypt', 'jsonwebtoken'];
modules.forEach(mod => {
  try {
    require.resolve(mod);
    console.log(`   ✓ ${mod} installed`);
  } catch (e) {
    console.log(`   ❌ ${mod} NOT installed`);
  }
});

// Check 3: Database configuration
console.log("\n3. Database Configuration:");
try {
  const dbConfig = require('./db');
  console.log("   ✓ db.js file found");
  console.log("   Database: vocabopd");
  console.log("   User: postgres");
  console.log("   Host: localhost");
  console.log("   Port: 5432");
} catch (e) {
  console.log("   ❌ db.js file not found or has errors");
}

// Check 4: Server file
console.log("\n4. Server Configuration:");
try {
  const fs = require('fs');
  const serverExists = fs.existsSync('./server.js');
  if (serverExists) {
    console.log("   ✓ server.js file found");
  } else {
    console.log("   ❌ server.js file not found");
  }
} catch (e) {
  console.log("   ❌ Error checking server.js");
}

// Check 5: Environment
console.log("\n5. Environment:");
console.log("   Platform:", process.platform);
console.log("   Architecture:", process.arch);
console.log("   Working Directory:", process.cwd());

console.log("\n" + "=".repeat(50));
console.log("\n📋 Next Steps:");
console.log("   1. If modules are missing: npm install");
console.log("   2. Test database: node test-connection.js");
console.log("   3. Start server: npm start");
console.log("\n");
