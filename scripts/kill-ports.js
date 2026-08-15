const { execSync } = require('child_process');

const ports = [3001, 5173];

console.log(`🔍 Đang kiểm tra các tiến trình chiếm port: ${ports.join(', ')}...`);

ports.forEach((port) => {
  try {
    let output = '';
    if (process.platform === 'win32') {
      try {
        const psCmd = `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`;
        output = execSync(psCmd, { encoding: 'utf-8' });
      } catch {
        output = '';
      }

      if (output) {
        const lines = output.trim().split(/\r?\n/);
        const killedPids = new Set();
        lines.forEach((line) => {
          const pid = line.trim();
          if (pid && /^\d+$/.test(pid) && parseInt(pid, 10) > 0 && !killedPids.has(pid)) {
            killedPids.add(pid);
            try {
              console.log(`⚠️ Đang dừng tiến trình PID: ${pid} trên Port ${port}...`);
              execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
              console.log(`✅ Đã giải phóng Port ${port} (PID: ${pid})`);
            } catch (e) {
              // Ignore if already terminated
            }
          }
        });
      } else {
        console.log(`ℹ️ Port ${port} đang trống.`);
      }
    } else {
      // Unix/macOS
      try {
        execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'ignore' });
        console.log(`✅ Đã giải phóng Port ${port}`);
      } catch {
        console.log(`ℹ️ Port ${port} đang trống.`);
      }
    }
  } catch (err) {
    console.error(`Lỗi khi kiểm tra port ${port}:`, err.message);
  }
});

console.log('✨ Kiểm tra port hoàn tất!');
