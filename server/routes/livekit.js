const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const { protect } = require('../middleware/auth');

const router = express.Router();

// POST /api/livekit/token
// role: 'publisher' (player going live) | 'subscriber' (spectator)
router.post('/token', protect, async (req, res) => {
  try {
    const { roomName, role = 'subscriber' } = req.body;
    if (!roomName) return res.status(400).json({ message: 'roomName is required' });

    const apiKey    = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl     = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return res.status(503).json({ message: 'LiveKit is not configured on this server' });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: String(req.user._id),
      name:     req.user.username,
      ttl:      '2h',
    });

    at.addGrant({
      room:           roomName,
      roomJoin:       true,
      canPublish:     role === 'publisher',
      canSubscribe:   true,
      canPublishData: false,
    });

    const token = await at.toJwt();
    res.json({ token, wsUrl, roomName, role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
