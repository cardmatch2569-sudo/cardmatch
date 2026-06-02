require('dotenv').config();
const { connectDB } = require('./config/db');
const GameType = require('./models/GameType');

const GAMES = [
  { name: 'Battle of Talingchan', nameTh: 'แบทเทิลออฟตลิ่งชัน', description: 'Thai card battle game.', descriptionTh: 'เกมการ์ดต่อสู้สัญชาติไทย', color: '#e11d48' },
  { name: 'Cardfight!! Vanguard', nameTh: 'การ์ดไฟต์!! แวนการ์ด', description: 'Japanese trading card game by Bushiroad.', descriptionTh: 'เกมการ์ดญี่ปุ่นโดย Bushiroad', color: '#1d4ed8' },
];

(async () => {
  await connectDB();
  console.log('Seeding game types...');
  for (const g of GAMES) {
    const existing = await GameType.findByName(g.name);
    if (existing) { console.log(`  ✓ Exists: ${g.name}`); }
    else           { await GameType.create(g); console.log(`  + Seeded: ${g.name}`); }
  }
  console.log('Seed complete!');
  process.exit(0);
})();
