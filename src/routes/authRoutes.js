import express from "express";
import { body } from "express-validator";
import { 
  registerUser, 
  loginUser, 
  verifyEmail, 
  forgotPassword, 
  resetPassword, 
  refreshToken,
  registerProvider 
} from "../controllers/authController.js";
import { uploadUserProfile, uploadProviderDocuments } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

// Normal user registration
router.post("/register",
  uploadUserProfile,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min:6 }).withMessage("Password must be at least 6 characters")
  ],
  registerUser
);

// Service provider registration
router.post("/register-provider",
  uploadProviderDocuments,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min:6 }).withMessage("Password must be at least 6 characters"),
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("address").custom((value) => {
      const address = typeof value === 'string' ? JSON.parse(value) : value;
      if (!address.district) throw new Error("District is required");
      if (address.district === 'other' && !address.otherDistrict) {
        throw new Error("Other district details are required");
      }
      if (!address.fullAddress) throw new Error("Full address is required");
      return true;
    }),
    body("age").isInt({ min: 18 }).withMessage("Age must be at least 18"),
    body("experience").notEmpty().withMessage("Experience details are required"),
    body("hourlyRate") // ADD THIS VALIDATION
      .isFloat({ min: 100, max: 5000 })
      .withMessage("Hourly rate must be between ₹100 and ₹5000"),
    body("serviceCategory").notEmpty().withMessage("Service category is required")
  ],
  registerProvider
);

// Login
router.post("/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required")
  ],
  loginUser
);

// Email verification
router.get("/verify-email/:token", verifyEmail);

// Refresh token
router.get("/refresh-token", refreshToken);

// Forgot / Reset password
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);

export default router;