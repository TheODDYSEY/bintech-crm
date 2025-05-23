const express = require("express");
const router = express.Router();
const Deal = require("../models/deals");

// GET all deals
router.get("/", async (req, res) => {
  try {
    const deals = await Deal.find().sort({ createdAt: -1 });
    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch deals" });
  }
});

// POST a new deal
router.post("/", async (req, res) => {
  try {
    const newDeal = new Deal(req.body);
    await newDeal.save();
    res.json({ success: true, deal: newDeal });
  } catch (error) {
    console.error("Deal save error:", error);
    res.status(500).json({ success: false, error: "Failed to save deal" });
  }
});

module.exports = router;
