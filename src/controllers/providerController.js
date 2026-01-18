// controllers/providerController.js
import User from '../models/User.js';
import Category from '../models/Category.js';

export const providerController = {
  // Get providers with filtering and pagination
  getProviders: async (req, res) => {
    try {
      const { 
        category, 
        district, 
        minRating, 
        page = 1, 
        limit = 12, 
        sort = 'rating' 
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      let query = { 
        role: 'provider', 
        'providerProfile.status': 'approved' 
      };

      // Category filter - FIXED: Use slug directly
      if (category && category !== 'all') {
        query['providerProfile.serviceCategory'] = category;
      }

      // District filter
      if (district && district !== 'all') {
        query['providerProfile.address.district'] = district;
      }

      // Rating filter
      if (minRating) {
        query['providerProfile.rating'] = { $gte: parseFloat(minRating) };
      }

      // Sort options
      const sortOptions = {
        rating: { 'providerProfile.rating': -1 },
        experience: { 'providerProfile.experience': -1 },
        jobs: { 'providerProfile.completedJobs': -1 },
        newest: { createdAt: -1 }
      };

      const sortQuery = sortOptions[sort] || sortOptions.rating;

      // Get providers with pagination
      const providers = await User.find(query)
        .select('name email profileImage providerProfile createdAt')
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum)
        .lean();

      // Get total count for pagination
      const totalProviders = await User.countDocuments(query);
      const totalPages = Math.ceil(totalProviders / limitNum);

      // Format response
      const formattedProviders = providers.map(provider => ({
        _id: provider._id,
        name: provider.name,
        email: provider.email,
        profileImage: provider.profileImage,
        rating: provider.providerProfile?.rating || 4.5,
        reviewCount: provider.providerProfile?.reviewCount || 0,
        experience: provider.providerProfile?.experience || '2+ years',
        serviceCategory: provider.providerProfile?.serviceCategory,
        startingPrice: getStartingPrice(provider.providerProfile?.serviceCategory),
        district: provider.providerProfile?.address?.district || 'Multiple locations',
        phone: provider.providerProfile?.phone,
        age: provider.providerProfile?.age,
         hourlyRate: provider.providerProfile?.hourlyRate || getStartingPrice(provider.providerProfile?.serviceCategory),
        completedJobs: provider.providerProfile?.completedJobs || 0,
        formattedAddress: getFormattedAddress(provider.providerProfile?.address),
        memberSince: provider.createdAt
      }));

      res.json({
        success: true,
        providers: formattedProviders,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalProviders,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        },
        filters: {
          category: category || null,
          district: district || null,
          minRating: minRating || null,
          sort
        }
      });
    } catch (error) {
      console.error('Error fetching providers:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch providers',
        error: process.env.NODE_ENV === 'production' ? undefined : error.message 
      });
    }
  },

  // Get provider by ID
  getProviderById: async (req, res) => {
    try {
      const provider = await User.findOne({
        _id: req.params.id,
        role: 'provider',
        'providerProfile.status': 'approved'
      }).select('-password -verificationToken -resetPasswordToken -resetPasswordExpire');

      if (!provider) {
        return res.status(404).json({ 
          success: false,
          message: 'Provider not found' 
        });
      }

      // Get category details
      const category = await Category.findOne({ 
        slug: provider.providerProfile.serviceCategory 
      });

      const providerData = provider.toObject();
      providerData.categoryDetails = category;
      providerData.formattedAddress = getFormattedAddress(provider.providerProfile?.address);

      res.json({
        success: true,
        provider: providerData
      });
    } catch (error) {
      console.error('Error fetching provider:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch provider',
        error: process.env.NODE_ENV === 'production' ? undefined : error.message 
      });
    }
  },

  // Get providers by category
  getProvidersByCategory: async (req, res) => {
    try {
      const { category } = req.params;
      const { page = 1, limit = 12 } = req.query;

      // Validate category exists
      const categoryExists = await Category.findOne({ slug: category });
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const providers = await User.find({
        role: 'provider',
        'providerProfile.status': 'approved',
        'providerProfile.serviceCategory': category
      })
      .select('name email profileImage providerProfile createdAt')
      .sort({ 'providerProfile.rating': -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

      const totalProviders = await User.countDocuments({
        role: 'provider',
        'providerProfile.status': 'approved',
        'providerProfile.serviceCategory': category
      });

      const totalPages = Math.ceil(totalProviders / limitNum);

      const formattedProviders = providers.map(provider => ({
        _id: provider._id,
        name: provider.name,
        email: provider.email,
        profileImage: provider.profileImage,
        rating: provider.providerProfile?.rating || 4.5,
        reviewCount: provider.providerProfile?.reviewCount || 0,
        experience: provider.providerProfile?.experience || '2+ years',
        serviceCategory: provider.providerProfile?.serviceCategory,
        startingPrice: getStartingPrice(provider.providerProfile?.serviceCategory),
        district: provider.providerProfile?.address?.district || 'Multiple locations',
        phone: provider.providerProfile?.phone,
        age: provider.providerProfile?.age,
          hourlyRate: provider.providerProfile?.hourlyRate || getStartingPrice(provider.providerProfile?.serviceCategory),
        completedJobs: provider.providerProfile?.completedJobs || 0,
        formattedAddress: getFormattedAddress(provider.providerProfile?.address),
        memberSince: provider.createdAt
      }));

      res.json({
        success: true,
        providers: formattedProviders,
        category: categoryExists,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalProviders,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      });
    } catch (error) {
      console.error('Error fetching providers by category:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch providers',
        error: process.env.NODE_ENV === 'production' ? undefined : error.message 
      });
    }
  },

  // Search providers
  searchProviders: async (req, res) => {
    try {
      const { q, category, district, page = 1, limit = 12 } = req.query;

      if (!q) {
        return res.status(400).json({ 
          success: false,
          message: 'Search query is required' 
        });
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build search query
      let query = {
        role: 'provider',
        'providerProfile.status': 'approved',
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { 'providerProfile.serviceCategory': { $regex: q, $options: 'i' } },
          { 'providerProfile.address.district': { $regex: q, $options: 'i' } }
        ]
      };

      // Additional filters
      if (category && category !== 'all') {
        query['providerProfile.serviceCategory'] = category;
      }

      if (district && district !== 'all') {
        query['providerProfile.address.district'] = district;
      }

      const providers = await User.find(query)
        .select('name email profileImage providerProfile createdAt')
        .sort({ 'providerProfile.rating': -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      const totalProviders = await User.countDocuments(query);
      const totalPages = Math.ceil(totalProviders / limitNum);

      const formattedProviders = providers.map(provider => ({
        _id: provider._id,
        name: provider.name,
        email: provider.email,
        profileImage: provider.profileImage,
        rating: provider.providerProfile?.rating || 4.5,
        reviewCount: provider.providerProfile?.reviewCount || 0,
        experience: provider.providerProfile?.experience || '2+ years',
        serviceCategory: provider.providerProfile?.serviceCategory,
        hourlyRate:provider.providerProfile?.hourlyRate,
        district: provider.providerProfile?.address?.district || 'Multiple locations',
        formattedAddress: getFormattedAddress(provider.providerProfile?.address)
      }));

      res.json({
        success: true,
        providers: formattedProviders,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalProviders,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        },
        searchQuery: q
      });
    } catch (error) {
      console.error('Error searching providers:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to search providers',
        error: process.env.NODE_ENV === 'production' ? undefined : error.message 
      });
    }
  }
};

// Helper functions
const getStartingPrice = (category) => {
  const prices = {
    plumbing: 500,
    electrical: 300,
    cleaning: 800,
    carpentry: 600,
    painting: 400,
    'ac-repair': 600,
    other: 300
  };
  return prices[category] || 300;
};

const getFormattedAddress = (address) => {
  if (!address) return 'Location not specified';
  
  const { district, otherDistrict, fullAddress } = address;
  const primaryDistrict = district === 'other' ? otherDistrict : district;
  
  if (fullAddress) {
    return `${fullAddress}, ${primaryDistrict}`;
  }
  
  return primaryDistrict;
};