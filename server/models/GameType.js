const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../config/db');

const fmt = (row) => {
  if (!row) return null;
  return {
    _id:           row.id,
    name:          row.name,
    nameTh:        row.name_th,
    description:   row.description   || '',
    descriptionTh: row.description_th || '',
    imageUrl:      row.image_url      || '',
    color:         row.color          || '#6366f1',
    isActive:      !!row.is_active,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
};

const GameType = {
  async findAll() {
    const { rows } = await getPool().query(
      'SELECT * FROM GameTypes WHERE is_active=TRUE ORDER BY name'
    );
    return rows.map(fmt);
  },

  async findAllAdmin() {
    const { rows } = await getPool().query('SELECT * FROM GameTypes ORDER BY name');
    return rows.map(fmt);
  },

  async findById(id) {
    const { rows } = await getPool().query('SELECT * FROM GameTypes WHERE id=$1', [id]);
    return fmt(rows[0]);
  },

  async findByName(name) {
    const { rows } = await getPool().query('SELECT * FROM GameTypes WHERE name=$1', [name]);
    return fmt(rows[0]);
  },

  async create({ name, nameTh, description = '', descriptionTh = '', imageUrl = '', color = '#6366f1', isActive = true }) {
    const id = uuidv4();
    const { rows } = await getPool().query(
      `INSERT INTO GameTypes (id,name,name_th,description,description_th,image_url,color,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, name, nameTh, description, descriptionTh, imageUrl, color, isActive]
    );
    return fmt(rows[0]);
  },

  async update(id, { name, nameTh, description, descriptionTh, imageUrl, color, isActive }) {
    const { rows } = await getPool().query(
      `UPDATE GameTypes
       SET name=$1,name_th=$2,description=$3,description_th=$4,
           image_url=$5,color=$6,is_active=$7,updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, nameTh, description ?? '', descriptionTh ?? '', imageUrl ?? '', color ?? '#6366f1', isActive !== undefined ? isActive : true, id]
    );
    return fmt(rows[0]);
  },

  async delete(id) {
    await getPool().query('DELETE FROM GameTypes WHERE id=$1', [id]);
  },
};

module.exports = GameType;
