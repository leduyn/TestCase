const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const dirsToClean = [
  path.join(rootDir, 'client', 'node_modules', '.vite'),
  path.join(rootDir, 'client', 'dist'),
  path.join(rootDir, 'server', 'dist'),
];

console.log('🧹 Đang dọn dẹp cache...');

dirsToClean.forEach((dir) => {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✅ Đã xóa: ${path.relative(rootDir, dir)}`);
    } catch (err) {
      console.warn(`⚠️ Không thể xóa ${path.relative(rootDir, dir)}: ${err.message}`);
    }
  }
});

console.log('✨ Dọn dẹp cache hoàn tất!');
