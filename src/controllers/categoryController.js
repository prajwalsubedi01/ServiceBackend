import Category from '../models/Category.js';
import User from '../models/User.js';

// Initialize categories if they don't exist
const initializeCategories = async () => {
  const categories = [
    {
      name: 'Plumbing',
      slug: 'plumbing',
      description: 'Professional plumbing services including repairs, installations, and maintenance',
      icon: '🔧',
      startingPrice: 500
    },
    {
      name: 'Electrical',
      slug: 'electrical',
      description: 'Electrical repairs, installations, and safety inspections',
      icon: '⚡',
      startingPrice: 300
    },
    {
      name: 'Cleaning',
      slug: 'cleaning',
      description: 'Home and office cleaning services',
      icon: '🧹',
      startingPrice: 800
    },
    {
      name: 'Carpentry',
      slug: 'carpentry',
      description: 'Woodworking, furniture repair, and carpentry services',
      icon: '🪚',
      startingPrice: 600
    },
    {
      name: 'Painting',
      slug: 'painting',
      description: 'Interior and exterior painting services',
      icon: '🎨',
      startingPrice: 400
    },
    {
      name: 'AC Repair',
      slug: 'ac-repair',
      description: 'Air conditioner installation, repair, and maintenance',
      icon: '❄️',
      startingPrice: 600
    },
    {
      name: 'Other',
      slug: 'other',
      description: 'Various other professional services',
      icon: '🔧',
      startingPrice: 300
    }
  ];

  for (const categoryData of categories) {
    await Category.findOneAndUpdate(
      { name: categoryData.name },
      categoryData,
      { upsert: true, new: true }
    );
  }
  // console.log('Categories initialized successfully');
};

// Get featured categories
export const getFeaturedCategories = async (req, res) => {
  try {
    // Ensure categories exist
    await initializeCategories();

    const categories = await Category.find({ isActive: true })
      .sort({ providerCount: -1 })
      .limit(8);

    // Update provider counts for each category
    const categoriesWithUpdatedCounts = await Promise.all(
      categories.map(async (category) => {
        await category.updateProviderCount();
        return await Category.findById(category._id);
      })
    );

    res.json(categoriesWithUpdatedCounts);
  } catch (error) {
    console.error('Error fetching featured categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    await initializeCategories();
    
    const categories = await Category.find({ isActive: true });
    
    // Update provider counts
    const updatedCategories = await Promise.all(
      categories.map(async (category) => {
        await category.updateProviderCount();
        return await Category.findById(category._id);
      })
    );

    res.json(updatedCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get category by ID
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await category.updateProviderCount();
    const updatedCategory = await Category.findById(req.params.id);

    res.json(updatedCategory);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get category by slug
export const getCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await category.updateProviderCount();
    const updatedCategory = await Category.findOne({ slug: req.params.slug });

    res.json(updatedCategory);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Server error' });
  }
};