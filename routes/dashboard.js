import express from "express";
import { createDashboard } from "../services/grafanaService.js";

const router = express.Router();

router.get("/dashboard", (req,res)=>{
  res.render("dashboard");
});

router.post("/dashboard/create", async (req,res)=>{
  try{
    await createDashboard(req.body);
    res.json({success:true});
  }catch(err){
    res.status(500).json({
      success:false,
      error: err.message
    });
  }
});

export default router;