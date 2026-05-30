const express = require('express');
const GameType = require('../models/GameType');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Public: active games only
router.get('/', async (req, res) => {
  try {
    const games = await GameType.findAll();
    res.json({ games });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: all games
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const games = await GameType.findAllAdmin();
    res.json({ games });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: create game
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, nameTh, description, descriptionTh, imageUrl, color } = req.body;
    if (!name || !nameTh) {
      return res.status(400).json({ message: 'name and nameTh are required' });
    }
    const existing = await GameType.findByName(name);
    if (existing) return res.status(400).json({ message: 'Game name already exists' });

    const game = await GameType.create({ name, nameTh, description, descriptionTh, imageUrl, color });
    res.status(201).json({ game });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: update game
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const game = await GameType.update(req.params.id, req.body);
    if (!game) return res.status(404).json({ message: 'Game type not found' });
    res.json({ game });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: delete game
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await GameType.delete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
