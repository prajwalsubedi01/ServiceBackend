// models/Category.js - UPDATED
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting', 'AC Repair', 'Appliance Repair', 'Computer Repair', 'Mobile Repair', 'Beauty Services', 'Tutoring', 'Driving', 'Other']
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🔧'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  averageRating: {
    type: Number,
    default: 4.5,
    min: 1,
    max: 5
  },
  startingPrice: {
    type: Number,
    default: 300
  },
  providerCount: {
    type: Number,
    default: 0
  },
  approvedProviders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

// Static method to update all category provider counts
categorySchema.statics.updateProviderCounts = async function() {
  const categories = await this.find({ isActive: true });
  
  for (const category of categories) {
    const count = await mongoose.model('User').countDocuments({
      role: 'provider',
      'providerProfile.status': 'approved',
      'providerProfile.serviceCategory': category.slug
    });
    
    category.providerCount = count;
    await category.save();
  }
  
  return categories;
};

// Update provider count for specific category
categorySchema.methods.updateProviderCount = async function() {
  const count = await mongoose.model('User').countDocuments({
    role: 'provider',
    'providerProfile.status': 'approved',
    'providerProfile.serviceCategory': this.slug
  });
  
  this.providerCount = count;
  await this.save();
  return count;
};

const Category = mongoose.model('Category', categorySchema);
export default Category;