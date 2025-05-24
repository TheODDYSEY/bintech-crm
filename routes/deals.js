const express = require("express");
const router = express.Router();
const Deal = require("../models/deals"); // Make sure path is correct

// POST: Save a new deal
router.post("/", async (req, res) => {
  console.log('🎯 External deals route hit!');
  console.log('🚀 Received deal data:', JSON.stringify(req.body, null, 2));
  
  try {
    const newDeal = new Deal({
      name: req.body.name,
      amount: req.body.amount,
      stage: req.body.stage,
      customerNumber: req.body.customerNumber,
      inquiryDate: req.body.inquiryDate,
      customer: req.body.customer,
      company: req.body.company,
      email: req.body.email,
      phone: req.body.phone,
      source: req.body.source,
      product: req.body.product,
      brand: req.body.brand,
      followUpPhone: req.body.followUpPhone,
      followUpEmail: req.body.followUpEmail,
      quotationDate: req.body.quotationDate
    });

    const savedDeal = await newDeal.save();
    console.log('✅ Deal saved successfully:', savedDeal);
    res.status(201).json({ success: true, data: savedDeal });
  } catch (error) {
    console.error("❌ POST /api/deals error:", error);
    console.error("❌ Error details:", error.message);
    res.status(500).json({ success: false, error: "Failed to save deal.", details: error.message });
  }
});

// GET: Fetch all deals
router.get("/", async (req, res) => {
  console.log('📋 GET /api/deals route hit!');
  try {
    const deals = await Deal.find();
    console.log(`✅ Found ${deals.length} deals`);
    res.json(deals);
  } catch (error) {
    console.error("❌ GET /api/deals error:", error);
    res.status(500).json({ success: false, error: "Failed to load deals." });
  }
});

// DELETE: Delete a deal
router.delete("/", async (req, res) => {
  console.log('🗑️ DELETE /api/deals route hit!');
  console.log('🚀 Delete criteria:', req.body);
  
  try {
    const result = await Deal.deleteOne({
      name: req.body.name,
      customer: req.body.customer
    });
    
    if (result.deletedCount === 0) {
      console.log('❌ No deal found to delete');
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    
    console.log('✅ Deal deleted successfully');
    res.json({ success: true });
  } catch (error) {
    console.error("❌ DELETE /api/deals error:", error);
    res.status(500).json({ success: false, error: "Failed to delete deal." });
  }
});

// PUT: Update a deal
router.put("/:id", async (req, res) => {
  console.log('✏️ PUT /api/deals route hit!');
  console.log('🆔 Deal ID:', req.params.id);
  console.log('🚀 Update data:', JSON.stringify(req.body, null, 2));
  
  try {
    const updatedDeal = await Deal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedDeal) {
      console.log('❌ Deal not found for update');
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    
    console.log('✅ Deal updated successfully:', updatedDeal);
    res.json({ success: true, data: updatedDeal });
  } catch (error) {
    console.error("❌ PUT /api/deals error:", error);
    res.status(500).json({ success: false, error: "Failed to update deal." });
  }
});

module.exports = router;