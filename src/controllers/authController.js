import User from "../models/User.js";
import crypto from "crypto";
import { generateToken, generateRefreshToken } from "../utils/generateToken.js";
import { sendEmail } from "../utils/SendEmail.js";
import { validationResult } from "express-validator";
import cloudinary from "../config/cloudinary.js";

// @desc    Register normal user
export const registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if(userExists) return res.status(400).json({ message: "Email already registered" });

    const userData = { name, email, password, role: "user" };

    // Handle profile image upload
    if (req.file) {
      userData.profileImage = {
        public_id: req.file.filename,
        url: req.file.path
      };
    }

    const user = await User.create(userData);

    // Generate email verification token
    const verificationToken = user.getVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${req.protocol}://${req.get("host")}/api/auth/verify-email/${verificationToken}`;
    const message = `<p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`;

    try {
      await sendEmail({ email: user.email, subject: "Email Verification", message });
      res.status(201).json({ 
        message: "Registration successful. Verify your email.",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      user.verificationToken = undefined;
      await user.save({ validateBeforeSave: false });
      res.status(500).json({ message: "Email could not be sent" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error during registration" });
  }
};

// @desc    Register service provider
// @desc    Register service provider
export const registerProvider = async (req, res) => {
  try {
    const errors = validationResult(req);
    if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { 
      name, 
      email, 
      password, 
      phone, 
      address, 
      age, 
      experience,
      serviceCategory,
      hourlyRate
    } = req.body;

    const userExists = await User.findOne({ email });
    if(userExists) return res.status(400).json({ message: "Email already registered" });

    // Set status to "pending" when provider registers
    const userData = { 
      name, 
      email, 
      password, 
      role: "provider",
      providerProfile: {
        phone: phone || '',
        address: typeof address === 'string' ? JSON.parse(address) : address || {},
        age: age || '',
        experience: experience || '',
        serviceCategory: serviceCategory || '',
        hourlyRate: hourlyRate || 0,
        status: "pending",
        experienceCertificate: null,
        citizenship: null,
        cv: null,
        rejectionReason: null,
        approvedAt: null,
        approvedBy: null
      }
    };

    // Handle file uploads
    const files = req.files;

    // MAKE PROFILE IMAGE AND CITIZENSHIP REQUIRED
    if (files?.profileImage) {
      userData.profileImage = {
        public_id: files.profileImage[0].filename,
        url: files.profileImage[0].path
      };
    } else {
      return res.status(400).json({ message: "Profile image is required" });
    }

    if (files?.experienceCertificate) {
      userData.providerProfile.experienceCertificate = {
        public_id: files.experienceCertificate[0].filename,
        url: files.experienceCertificate[0].path
      };
    }

    // MAKE CITIZENSHIP PHOTOS REQUIRED
    if (files?.citizenshipFront && files?.citizenshipBack) {
      userData.providerProfile.citizenship = {
        front: {
          public_id: files.citizenshipFront[0].filename,
          url: files.citizenshipFront[0].path
        },
        back: {
          public_id: files.citizenshipBack[0].filename,
          url: files.citizenshipBack[0].path
        }
      };
    } else {
      return res.status(400).json({ message: "Both citizenship front and back photos are required" });
    }

    if (files?.cv) {
      userData.providerProfile.cv = {
        public_id: files.cv[0].filename,
        url: files.cv[0].path
      };
    }

    const user = await User.create(userData);

    // Generate email verification token
    const verificationToken = user.getVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${req.protocol}://${req.get("host")}/api/auth/verify-email/${verificationToken}`;
    const message = `
      <h2>Service Provider Registration</h2>
      <p>Your provider account has been created and is pending admin approval.</p>
      <p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>
      <p>You will be notified once your account is approved by admin.</p>
    `;

    try {
      await sendEmail({ 
        email: user.email, 
        subject: "Service Provider Registration - Email Verification", 
        message 
      });
      
      // console.log(`Verification email sent to: ${user.email}`);
      
      // Return success response
      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profileImage: user.profileImage,
        providerProfile: user.providerProfile
      };

      return res.status(201).json({ 
        success: true,
        message: "Provider registration submitted. Verify your email and wait for admin approval.",
        user: userResponse
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Don't fail registration if email fails, just inform user
      user.verificationToken = undefined;
      await user.save({ validateBeforeSave: false });
      
      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profileImage: user.profileImage,
        providerProfile: user.providerProfile
      };

      return res.status(201).json({ 
        success: true,
        message: "Provider registration submitted but verification email failed. Please contact support to verify your email.",
        user: userResponse,
        warning: "Email verification failed"
      });
    }

  } catch (error) {
    console.error('Provider registration error:', error);
    
    // More specific error messages
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: "Validation failed", 
        errors 
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: "Email already exists" 
      });
    }
    
    return res.status(500).json({ 
      message: "Server error during provider registration",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Verify email
export const verifyEmail = async (req,res) => {
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({ verificationToken: hashedToken });
  if(!user) return res.status(400).json({ message: "Invalid or expired token" });

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save({ validateBeforeSave: false });
  res.status(200).json({ message: "Email verified successfully" });
};

// @desc    Login user
// @desc    Login user
// In your authController.js - make sure login returns fresh data
export const loginUser = async (req,res) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  
  // Use .select('+password') to include password for verification
  const user = await User.findOne({ email }).select('+password');
  if(!user) return res.status(401).json({ message: "Invalid credentials" });
  if(!user.isVerified) return res.status(401).json({ message: "Email not verified" });

  // Check if provider is approved
  if(user.role === "provider" && user.providerProfile?.status !== "approved") {
    return res.status(401).json({ 
      message: "Provider account pending admin approval",
      status: user.providerProfile?.status 
    });
  }

  if(user && await user.matchPassword(password)){
    const accessToken = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7*24*60*60*1000
    });

    // IMPORTANT: Re-fetch the user to get fresh data without password
    const freshUser = await User.findById(user._id)
      .select('-password')
      .lean();

    // console.log('🔐 BACKEND - User role:', freshUser.role); // Debug

    res.json({ 
      accessToken, 
      user: freshUser // Use fresh user data
    });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
};
// Other functions remain the same (refreshToken, forgotPassword, resetPassword)
// In your authController.js
export const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  
  if (!token) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const accessToken = generateToken(user._id, user.role);
    res.json({ accessToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    // console.log('Request body:', req.body); // Debug log
    
    // Handle different possible request body formats
    let email;
    
    if (typeof req.body === 'string') {
      // If body is stringified JSON
      try {
        const parsedBody = JSON.parse(req.body);
        email = parsedBody.email;
      } catch (parseError) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid request format" 
        });
      }
    } else if (typeof req.body === 'object') {
      // If body is already an object
      if (req.body.email && typeof req.body.email === 'string') {
        email = req.body.email;
      } else if (req.body.email && typeof req.body.email === 'object') {
        // Handle nested email object (your current issue)
        email = req.body.email.email;
      }
    }
    
    // Validate email
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }
    
    if (typeof email !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: "Email must be a string" 
      });
    }

    // Trim and validate email format
    email = email.trim().toLowerCase();
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide a valid email address" 
      });
    }

    // console.log('Searching for user with email:', email); // Debug log

    const user = await User.findOne({ email });
    
    // Always return success for security reasons
    const responseMessage = "If the email exists, password reset instructions have been sent";

    if (!user) {
      return res.json({ 
        success: true,
        message: responseMessage 
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password/${resetToken}`;
    
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background-color: #d62828; width: 50px; height: 50px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
            <span style="color: white; font-weight: bold; font-size: 18px;">SS</span>
          </div>
          <h1 style="color: #d62828; margin: 10px 0;">Sajilo Sewa</h1>
        </div>
        
        <h2 style="color: #333; border-bottom: 2px solid #d62828; padding-bottom: 10px;">
          Password Reset Request
        </h2>
        
        <p>Hello ${user.name},</p>
        
        <p>You recently requested to reset your password for your Sajilo Sewa account. Click the button below to reset it.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #d62828; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Reset Your Password
          </a>
        </div>
        
        <p>This password reset link will expire in <strong>10 minutes</strong>.</p>
        
        <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            If you're having trouble clicking the password reset button, copy and paste the URL below into your web browser:
          </p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">
            ${resetUrl}
          </p>
        </div>
      </div>
    `;

    try {
      await sendEmail({ 
        email: user.email, 
        subject: "Sajilo Sewa - Password Reset Instructions", 
        message 
      });
      
      // console.log('Password reset email sent to:', email); // Debug log
      
      res.json({ 
        success: true,
        message: responseMessage 
      });
    } catch (err) {
      console.error('Email send error:', err);
      
      // Reset the token since email failed
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      
      res.status(500).json({ 
        success: false,
        message: "Failed to send email. Please try again later." 
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server error. Please try again later." 
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    // console.log('Reset password request body:', req.body); // Debug log
    
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired reset token" 
      });
    }

    // Handle different password formats
    let password;
    
    if (typeof req.body === 'string') {
      try {
        const parsedBody = JSON.parse(req.body);
        password = parsedBody.password;
      } catch (parseError) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid request format" 
        });
      }
    } else if (typeof req.body === 'object') {
      if (req.body.password && typeof req.body.password === 'string') {
        password = req.body.password;
      } else if (req.body.password && typeof req.body.password === 'object') {
        // Handle nested password object
        password = req.body.password.password;
      }
    }
    
    // Validate password
    if (!password) {
      return res.status(400).json({ 
        success: false,
        message: "Password is required" 
      });
    }
    
    if (typeof password !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: "Password must be a string" 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be at least 6 characters long" 
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    
    res.json({ 
      success: true,
      message: "Password reset successful" 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server error during password reset" 
    });
  }
};