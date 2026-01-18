import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: {
    public_id: String,
    url: String
  },
  role: { type: String, enum: ["user","provider","admin"], default: "user" },
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  // Service Provider Specific Fields
  providerProfile: {
    status: { 
      type: String, 
      enum: ["unapproved", "approved", "rejected", "pending"], 
      default: "unapproved" 
    },
    phone: { type: String },
    address: {
      district: { 
        type: String, 
        enum: ["birtamode", "damak", "mechinagar", "bhadrapur", "arjundhara", "kankai", "gauradaha", "other"] 
      },
      otherDistrict: { type: String },
      fullAddress: { type: String }
    },
    age: { type: Number },
    experience: { type: String },
    serviceCategory: {
      type: String,
      required: function() { return this.role === 'provider'; },
      enum: ["plumbing", "electrical", "cleaning", "carpentry", "painting", "ac-repair", "appliance-repair", "computer-repair", "mobile-repair", "beauty-services", "tutoring", "driving", "other"]
    },
    // NEW: Hourly rate field
    hourlyRate: {
      type: Number,
      required: function() { return this.role === 'provider'; },
      min: 100,
      max: 5000
    },
    experienceCertificate: {
      public_id: String,
      url: String
    },
    citizenship: {
      front: {
        public_id: String,
        url: String
      },
      back: {
        public_id: String,
        url: String
      }
    },
    cv: {
      public_id: String,
      url: String
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 1,
      max: 5
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    completedJobs: {
      type: Number,
      default: 0
    },
    rejectionReason: { type: String },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
userSchema.index({ role: 1, 'providerProfile.status': 1, 'providerProfile.serviceCategory': 1 });
userSchema.index({ 'providerProfile.serviceCategory': 1, 'providerProfile.status': 1 });

// Hash password before saving
userSchema.pre("save", async function(next) {
  if(!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Update category provider count when provider is approved/rejected
userSchema.post('save', async function(doc) {
  if (doc.role === 'provider' && doc.providerProfile?.serviceCategory) {
    try {
      const Category = mongoose.model('Category');
      await Category.updateProviderCounts();
    } catch (error) {
      console.error('Error updating category counts:', error);
    }
  }
});

// Compare password
userSchema.methods.matchPassword = async function(enteredPassword){
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate email verification token
userSchema.methods.getVerificationToken = function() {
  const token = crypto.randomBytes(20).toString("hex");
  this.verificationToken = crypto.createHash("sha256").update(token).digest("hex");
  return token;
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function() {
  const token = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  return token;
};

// Virtual for formatted address
userSchema.virtual('formattedAddress').get(function() {
  if (!this.providerProfile?.address) return 'Location not specified';
  
  const { district, otherDistrict, fullAddress } = this.providerProfile.address;
  const primaryDistrict = district === 'other' ? otherDistrict : district;
  
  if (fullAddress) {
    return `${fullAddress}, ${primaryDistrict}`;
  }
  
  return primaryDistrict;
});

const User = mongoose.model("User", userSchema);
export default User;