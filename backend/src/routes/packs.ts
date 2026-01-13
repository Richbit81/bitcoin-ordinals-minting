import express from 'express';
import {
  getPackAvailability,
  getAllPackAvailability,
  incrementPackSupply,
  canMintPack,
} from '../services/packSupply';

const router = express.Router();

/**
 * GET /api/packs/availability
 * Gibt die Verfügbarkeit aller Packs zurück
 */
router.get('/availability', (req, res) => {
  try {
    const availability = getAllPackAvailability();
    res.json(availability);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/packs/:packId/availability
 * Gibt die Verfügbarkeit eines spezifischen Packs zurück
 */
router.get('/:packId/availability', (req, res) => {
  try {
    const { packId } = req.params;
    const availability = getPackAvailability(packId);
    
    if (!availability) {
      return res.status(404).json({ error: 'Pack nicht gefunden' });
    }
    
    res.json(availability);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/packs/:packId/increment
 * Inkrementiert den Verkaufszähler eines Packs
 */
router.post('/:packId/increment', (req, res) => {
  try {
    const { packId } = req.params;
    
    if (!canMintPack(packId)) {
      return res.status(400).json({ 
        error: 'Pack ist ausverkauft',
        soldOut: true,
      });
    }
    
    const success = incrementPackSupply(packId);
    
    if (!success) {
      return res.status(400).json({ 
        error: 'Konnte Supply nicht inkrementieren',
      });
    }
    
    const availability = getPackAvailability(packId);
    res.json({
      success: true,
      availability,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;








