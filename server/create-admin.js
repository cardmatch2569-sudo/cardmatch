require('dotenv').config();
const { connectDB } = require('./config/db');
const User = require('./models/User');

const ADMIN_EMAIL    = 'admin@cardmatch.local';
const ADMIN_PASSWORD = 'CardMatch@2026';
const ADMIN_USERNAME = 'admin';

(async () => {
  await connectDB();

  // Check if already exists
  const existing = await User.findByEmail(ADMIN_EMAIL);
  if (existing) {
    console.log('\n✅ Admin account already exists:');
    console.log('   Email   :', ADMIN_EMAIL);
    console.log('   Username:', existing.username);
    console.log('   IsAdmin :', existing.isAdmin);
    process.exit(0);
  }

  const user = await User.create({
    username: ADMIN_USERNAME,
    email:    ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    isAdmin:  true,
  });

  console.log('\n🛡  Admin account created!');
  console.log('─────────────────────────────');
  console.log('   Email   :', ADMIN_EMAIL);
  console.log('   Password:', ADMIN_PASSWORD);
  console.log('   Username:', user.username);
  console.log('─────────────────────────────');
  console.log('→  ไปที่ http://localhost:3000/login');
  console.log('→  กด "เข้าสู่ระบบ Admin" (ด้านล่างปุ่ม Google)');
  console.log('→  ใส่ email และ password ด้านบน\n');

  process.exit(0);
})();
