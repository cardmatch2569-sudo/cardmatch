const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../config/db');

const Room = {
  async create({ roomId, gameTypeId, players = [] }) {
    const pool   = getPool();
    const id     = uuidv4();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO Rooms (id, room_id, game_type_id, status) VALUES ($1,$2,$3,'active')`,
        [id, roomId, gameTypeId]
      );
      for (const userId of players) {
        await client.query(
          'INSERT INTO RoomPlayers (room_id, user_id) VALUES ($1,$2)',
          [roomId, userId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateStatus(roomId, status) {
    await getPool().query(
      `UPDATE Rooms SET status=$1, ended_at=$2 WHERE room_id=$3`,
      [status, status === 'ended' ? new Date() : null, roomId]
    );
  },
};

module.exports = Room;
