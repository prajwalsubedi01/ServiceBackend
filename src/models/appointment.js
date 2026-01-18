import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
  appointmentId: {
    type: String,
    unique: true,
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceCategory: {
    type: String,
    required: true
  },
  serviceDescription: {
    type: String,
    required: true
  },
  appointmentDate: {
    type: Date,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  // NEW: Estimated hours for service
  estimatedHours: {
    type: Number,
    required: true,
    min: 1,
    max: 24
  },
  status: {
    type: String,
    enum: ['pending', 'admin_approved', 'admin_rejected', 'provider_accepted', 'provider_rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  price: {
    type: Number,
    required: true
  },
  // NEW: Store hourly rate at time of booking
  hourlyRate: {
    type: Number,
    required: true
  },
  location: {
    address: String,
    district: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  customerNotes: String,
  adminNotes: String,
  providerNotes: String,
  adminApprovedAt: Date,
  providerAcceptedAt: Date,
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for better query performance
appointmentSchema.index({ userId: 1, createdAt: -1 });
appointmentSchema.index({ providerId: 1, createdAt: -1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ appointmentDate: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;