// routes/adminRoutes.js
import express from "express";
import { body } from "express-validator";
import { 
  getProviderApplications, 
  getProviderApplication, 
  updateProviderStatus,
  getUsers,
  getDashboardStats
} from "../controllers/adminController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All routes protected and admin only
router.use(protect);
router.use(authorizeRoles('admin'));

// Dashboard stats
router.get("/dashboard/stats", getDashboardStats);

// Provider applications
router.get("/providers", getProviderApplications);
router.get("/providers/:id", getProviderApplication);
router.put("/providers/:id/status",
  [
    body("status").isIn(["approved", "rejected", "pending"]).withMessage("Invalid status"),
    body("rejectionReason").optional().isString()
  ],
  updateProviderStatus
);

// Users management
router.get("/users", getUsers);

export default router;