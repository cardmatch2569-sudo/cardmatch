const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../config/db');

const OTP_EXPIRES_MIN = 10;

const EmailVerification = {
  async create(email, code, pendingData) {
    const pool      = getPool();
    const id        = uuidv4();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MIN * 60 * 1000);

    // Delete previous unused OTPs for this email
    await pool.query(
      'DELETE FROM EmailVerifications WHERE email=$1 AND used=FALSE',
      [email.toLowerCase()]
    );

    await pool.query(
      `INSERT INTO EmailVerifications (id, email, code, google_data, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, email.toLowerCase(), code, JSON.stringify(pendingData), expiresAt]
    );
  },

  async isRateLimited(email) {
    const cooldown = new Date(Date.now() - 60 * 1000);
    const { rows } = await getPool().query(
      `SELECT id FROM EmailVerifications
       WHERE email=$1 AND created_at > $2 LIMIT 1`,
      [email.toLowerCase(), cooldown]
    );
    return rows.length > 0;
  },

  async verify(email, code) {
    const { rows } = await getPool().query(
      `SELECT * FROM EmailVerifications
       WHERE email=$1 AND code=$2 AND expires_at > NOW() AND used=FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase(), code]
    );
    return rows[0] || null;
  },

  async markUsed(id) {
    await getPool().query(
      'UPDATE EmailVerifications SET used=TRUE WHERE id=$1',
      [id]
    );
  },
};

module.exports = EmailVerification;
