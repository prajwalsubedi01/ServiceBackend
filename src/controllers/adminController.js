// controllers/adminController.js
import User from "../models/User.js";
import { sendEmail } from "../utils/SendEmail.js";

import Category from '../models/Category.js';
// @desc    Get all provider applications
export const getProviderApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let filter = { role: 'provider' };
    if (status && status !== 'all') {
      filter['providerProfile.status'] = status;
    }

    const providers = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      providers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching providers" });
  }
};

// @desc    Get single provider application
export const getProviderApplication = async (req, res) => {
  try {
    const provider = await User.findById(req.params.id)
      .select('-password')
      .populate('approvedBy', 'name email');

    if (!provider || provider.role !== 'provider') {
      return res.status(404).json({ message: "Provider not found" });
    }

    res.json(provider);
  } catch (error) {
    res.status(500).json({ message: "Server error fetching provider" });
  }
};

// @desc    Update provider status
export const updateProviderStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const provider = await User.findById(req.params.id);

    if (!provider || provider.role !== 'provider') {
      return res.status(404).json({ message: "Provider not found" });
    }

    // Store previous status for comparison
    const previousStatus = provider.providerProfile.status;

    // Update provider status
    provider.providerProfile.status = status;
    provider.providerProfile.rejectionReason = rejectionReason || null;
    
    if (status === 'approved') {
      provider.providerProfile.approvedAt = new Date();
      provider.providerProfile.approvedBy = req.user._id;
    } else {
      provider.providerProfile.approvedAt = null;
      provider.providerProfile.approvedBy = null;
    }

    await provider.save();

    // CRITICAL: Update category provider counts
    if (provider.providerProfile?.serviceCategory) {
      try {
        const Category = mongoose.model('Category');
        await Category.updateProviderCounts();
        // console.log(`✅ Updated category counts for provider: ${provider.name}`);
      } catch (categoryError) {
        console.error('❌ Error updating category counts:', categoryError);
      }
    }

    // Send email notification to provider
    let emailMessage = '';
    let emailSubject = '';

    if (status === 'approved') {
      emailSubject = 'Provider Account Approved - Sajilo Sewa';
      emailMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669;">Account Approved!</h1>
          </div>
          
          <p>Hello ${provider.name},</p>
          
          <p>Great news! Your provider account has been approved by our admin team.</p>
          
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0;">Your account is now active!</h3>
            <p style="margin: 10px 0 0 0;">You can now start receiving service appointments from customers.</p>
          </div>
          
          <p>Next steps:</p>
          <ul>
            <li>Complete your service profile</li>
            <li>Set your availability</li>
            <li>Start receiving appointments</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/provider/dashboard" 
               style="background-color: #059669; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;
                      font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
        </div>
      `;
    } else if (status === 'rejected') {
      emailSubject = 'Provider Account Update - Sajilo Sewa';
      emailMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626;">Account Status Update</h1>
          </div>
          
          <p>Hello ${provider.name},</p>
          
          <p>After careful review, we're unable to approve your provider account at this time.</p>
          
          ${rejectionReason ? `
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #dc2626; margin: 0;">Reason:</h4>
            <p style="margin: 10px 0 0 0;">${rejectionReason}</p>
          </div>
          ` : ''}
          
          <p>You can update your application and submit it again for review.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/contact-support" 
               style="background-color: #dc2626; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;
                      font-weight: bold;">
              Contact Support
            </a>
          </div>
        </div>
      `;
    }

    if (emailMessage) {
      await sendEmail({
        email: provider.email,
        subject: emailSubject,
        message: emailMessage
      });
    }

    res.json({
      message: `Provider ${status} successfully`,
      provider: {
        id: provider._id,
        name: provider.name,
        email: provider.email,
        status: provider.providerProfile.status,
        serviceCategory: provider.providerProfile.serviceCategory
      }
    });
  } catch (error) {
    console.error('Update provider status error:', error);
    res.status(500).json({ message: "Server error updating provider status" });
  }
};
// @desc    Get all users
export const getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;
    
    let filter = {};
    if (role && role !== 'all') {
      filter.role = role;
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching users" });
  }
};

// In your provider approval function, add:


// @desc    Get dashboard stats
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalProviders = await User.countDocuments({ role: 'provider' });
    const pendingProviders = await User.countDocuments({ 
      role: 'provider',
      'providerProfile.status': 'pending' 
    });
    const approvedProviders = await User.countDocuments({ 
      role: 'provider',
      'providerProfile.status': 'approved' 
    });

    // Recent provider applications (last 7 days)
    const recentApplications = await User.find({
      role: 'provider',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
    .select('name email providerProfile.status createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

    res.json({
      stats: {
        totalUsers,
        totalProviders,
        pendingProviders,
        approvedProviders
      },
      recentApplications
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: "Server error fetching dashboard stats" });
  }
};