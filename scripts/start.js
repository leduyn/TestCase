const { execSync, spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Kill ports
require('./kill-ports');

// 2. Clean cache
require('./clean');

console.log('\n=========================================================');
console.log('   AI TEST CASE GENERATOR & MANAGEMENT SYSTEM');
console.log('=========================================================\n');
console.log('🌐 Server API:     http://localhost:3001');
console.log('💻 Frontend UI:    http://localhost:5173');
console.log('📋 Database Setup: http://localhost:5173/setup\n');

if (process.platform === 'win32') {
  const serverPath = path.join(rootDir, 'server');
  const clientPath = path.join(rootDir, 'client');

  // Use start with /D to set working directory and run npm run dev
  execSync(`start "Backend Server (Port 3001)" /D "${serverPath}" cmd /k "npm run dev"`, { shell: 'cmd.exe' });
  execSync(`start "Frontend Client (Port 5173)" /D "${clientPath}" cmd /k "npm run dev"`, { shell: 'cmd.exe' });

  console.log('=========================================================');
  console.log('🎉 Da khoi chay Server va Client trong 2 cua so moi!');
  console.log('👉 Mo trinh duyet: http://localhost:5173');
  console.log('=========================================================\n');
} else {
  spawn('npm', ['run', 'dev'], { cwd: path.join(rootDir, 'server'), stdio: 'inherit', shell: true });
  spawn('npm', ['run', 'dev'], { cwd: path.join(rootDir, 'client'), stdio: 'inherit', shell: true });
}
