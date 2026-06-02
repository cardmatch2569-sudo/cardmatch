require('dotenv').config();
const { connectDB } = require('./config/db');
const GameType = require('./models/GameType');

const GAMES = [
  { name: 'Battle of Talingchan', nameTh: 'แบทเทิลออฟตลิ่งชัน', description: 'Thai card battle game.', descriptionTh: 'เกมการ์ดต่อสู้สัญชาติไทย', color: '#e11d48' },
  { name: 'Riftbound',            nameTh: 'ริฟต์บาวด์',          description: 'Fantasy trading card game.', descriptionTh: 'การ์ดเกมแฟนตาซี', color: '#7c3aed' },
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
