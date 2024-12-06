import express from "express";
import { getAnalyticsData, getDailySalesData } from "../controllers/analytics.controller.js";
import { adminRoute, protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, adminRoute, async (req, res) => {
    try {
        const analyticsData = await getAnalyticsData();

        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds
        const dailySalesData = await getDailySalesData(startDate, endDate);

        res.json({ analyticsData, dailySalesData });
    } catch (error) {
        console.log("error in getAnalyticsData controller", error.message);
        res.status(500).json({ message: error.message });
    }
});

export default router;