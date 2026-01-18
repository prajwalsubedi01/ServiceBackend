import Appointment from '../models/appointment.js';

import User from '../models/User.js';
// import { sendEmail } from '../utils/SendEmail.js';
import { sendAppointmentEmail } from '../utils/AppointmentEmail.js';

// Generate unique appointment ID
const generateAppointmentId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `APP-${timestamp}-${random}`.toUpperCase();
};

// Create new appointment
export const createAppointment = async (req, res) => {
  try {
    const {
      providerId,
      serviceDescription,
      appointmentDate,
      appointmentTime,
      estimatedHours,
      customerNotes,
      location
    } = req.body;

    // console.log('📦 Received booking data:', {
    //   providerId,
    //   serviceDescription,
    //   appointmentDate,
    //   appointmentTime,
    //   estimatedHours,
    //   customerNotes,
    //   location
    // });

    // Validate date (max 1 week in future)
    const selectedDate = new Date(appointmentDate);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);
    
    if (selectedDate > maxDate) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date cannot be more than 1 week from today'
      });
    }

    // Check if date is in past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date cannot be in the past'
      });
    }

    // Validate estimated hours
    if (!estimatedHours || estimatedHours < 1 || estimatedHours > 24) {
      return res.status(400).json({
        success: false,
        message: 'Estimated hours must be between 1 and 24 hours'
      });
    }

    const provider = await User.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Check if provider is approved
    if (provider.providerProfile?.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Provider account is not approved'
      });
    }

    // FIX: Get hourly rate from provider with proper validation
    const hourlyRate = provider.providerProfile?.hourlyRate;
    // console.log('💰 Provider hourly rate:', hourlyRate);
    
    if (!hourlyRate || isNaN(hourlyRate)) {
      return res.status(400).json({
        success: false,
        message: 'Provider hourly rate is not set or invalid'
      });
    }

    // FIX: Calculate price with proper validation
    const estimatedHoursNum = parseInt(estimatedHours);
    const totalPrice = hourlyRate * estimatedHoursNum;
    
    // console.log('🧮 Price calculation:', {
    //   hourlyRate,
    //   estimatedHours: estimatedHoursNum,
    //   totalPrice
    // });

    if (isNaN(totalPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid price calculation'
      });
    }

    const appointmentId = generateAppointmentId();

    // console.log('📝 Creating appointment with:', {
    //   appointmentId,
    //   providerId,
    //   hourlyRate,
    //   totalPrice,
    //   estimatedHours: estimatedHoursNum
    // });

    const appointment = new Appointment({
      appointmentId,
      providerId,
      userId: req.user.id,
      serviceCategory: provider.providerProfile.serviceCategory,
      serviceDescription,
      appointmentDate: selectedDate,
      appointmentTime,
      estimatedHours: estimatedHoursNum,
      price: totalPrice,
      hourlyRate: hourlyRate, // FIX: Include hourly rate
      location,
      customerNotes,
      status: 'pending'
    });

    await appointment.save();

    // Populate the appointment for response
    await appointment.populate('providerId', 'name email phone profileImage providerProfile');
    await appointment.populate('userId', 'name email phone');

    // FIX: Send email with proper error handling
    try {
      await sendNewAppointmentEmailToAdmin(appointment);
    } catch (emailError) {
      console.error('📧 Email sending failed:', emailError);
      // Don't fail the appointment creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully. Waiting for admin approval.',
      appointment
    });

  } catch (error) {
    console.error('❌ Appointment creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating appointment'
    });
  }
};


// Get appointments by user
export const getUserAppointments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = { userId: req.user.id };
    if (status && status !== 'all') {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .populate('providerId', 'name profileImage serviceCategory rating phone formattedAddress')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    // Get recent appointments (last 5)
    const recentAppointments = await Appointment.find({ userId: req.user.id })
      .populate('providerId', 'name serviceCategory profileImage')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      appointments,
      recentAppointments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get user appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching appointments'
    });
  }
};

// Get appointments by provider
// Get appointments by provider - UPDATED VERSION
export const getProviderAppointments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    // Only show appointments that are admin_approved or beyond
    let query = { 
      providerId: req.user.id,
      status: { $in: ['admin_approved', 'provider_accepted', 'provider_rejected', 'completed'] }
    };
    
    // If specific status filter is applied, use it (but only for allowed statuses)
    if (status && status !== 'all') {
      const allowedStatuses = ['admin_approved', 'provider_accepted', 'provider_rejected', 'completed'];
      if (allowedStatuses.includes(status)) {
        query.status = status;
      }
    }

    const appointments = await Appointment.find(query)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      appointments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get provider appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching appointments'
    });
  }
};

// Admin: Get all appointments
export const getAllAppointments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, providerId, userId } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status && status !== 'all') query.status = status;
    if (providerId) query.providerId = providerId;
    if (userId) query.userId = userId;

    const appointments = await Appointment.find(query)
      .populate('providerId', 'name serviceCategory phone email')
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    // Get stats for dashboard
    const stats = {
      total: await Appointment.countDocuments(),
      pending: await Appointment.countDocuments({ status: 'pending' }),
      admin_approved: await Appointment.countDocuments({ status: 'admin_approved' }),
      provider_accepted: await Appointment.countDocuments({ status: 'provider_accepted' }),
      completed: await Appointment.countDocuments({ status: 'completed' })
    };

    res.json({
      success: true,
      appointments,
      stats,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get all appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching appointments'
    });
  }
};

// Admin: Update appointment status
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('providerId', 'name email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Update appointment
    appointment.status = status;
    appointment.adminNotes = adminNotes;
    appointment.adminApprovedAt = status === 'admin_approved' ? new Date() : undefined;
    appointment.updatedAt = new Date();

    await appointment.save();

    // Send emails based on status
    if (status === 'admin_approved') {
      // Send email to provider about new booking
      await sendNewBookingEmailToProvider(appointment);
      // Send email to user about admin approval
      await sendAdminApprovalEmailToUser(appointment);
    } else if (status === 'admin_rejected') {
      await sendAdminRejectionEmailToUser(appointment);
    }

    res.json({
      success: true,
      message: `Appointment ${status.replace('_', ' ')} successfully`,
      appointment
    });

  } catch (error) {
    console.error('Update appointment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating appointment'
    });
  }
};

// Provider: Update appointment status
export const updateProviderAppointmentStatus = async (req, res) => {
  try {
    const { status, providerNotes } = req.body;
    
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      providerId: req.user.id
    })
    .populate('userId', 'name email phone')
    .populate('providerId', 'name email');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Validate status transition
    if (appointment.status !== 'admin_approved' && status === 'provider_accepted') {
      return res.status(400).json({
        success: false,
        message: 'Appointment must be approved by admin first'
      });
    }

    appointment.status = status;
    appointment.providerNotes = providerNotes;
    appointment.providerAcceptedAt = status === 'provider_accepted' ? new Date() : undefined;
    appointment.updatedAt = new Date();

    await appointment.save();

    // Send emails based on status
    if (status === 'provider_accepted') {
      await sendProviderAcceptanceEmailToUser(appointment);
      await sendProviderAcceptanceEmailToAdmin(appointment);
    } else if (status === 'provider_rejected') {
      await sendProviderRejectionEmailToUser(appointment);
      await sendProviderRejectionEmailToAdmin(appointment);
    }

    res.json({
      success: true,
      message: `Appointment ${status.replace('_', ' ')} successfully`,
      appointment
    });

  } catch (error) {
    console.error('Provider update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating appointment'
    });
  }
};

// Get appointment by ID
export const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('providerId', 'name email phone serviceCategory profileImage rating experience')
      .populate('userId', 'name email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if user has access to this appointment
    if (req.user.role === 'user' && appointment.userId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'provider' && appointment.providerId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching appointment'
    });
  }
};

async function sendNewAppointmentEmailToAdmin(appointment) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    
    if (!adminEmail) {
      console.warn('📧 No admin email configured');
      return;
    }

    const subject = '📋 New Appointment Booking Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d62828;">New Appointment Booking Request</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #d62828;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Customer:</strong> ${appointment.userId?.name || 'N/A'} (${appointment.userId?.email || 'N/A'})</p>
          <p><strong>Provider:</strong> ${appointment.providerId?.name || 'N/A'} - ${appointment.serviceCategory}</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
          <p><strong>Estimated Hours:</strong> ${appointment.estimatedHours}</p>
          <p><strong>Hourly Rate:</strong> ₹${appointment.hourlyRate}</p>
          <p><strong>Total Price:</strong> ₹${appointment.price}</p>
          <p><strong>Location:</strong> ${appointment.location?.address || 'N/A'}</p>
          ${appointment.customerNotes ? `<p><strong>Customer Notes:</strong> ${appointment.customerNotes}</p>` : ''}
        </div>
        <p style="margin-top: 20px;">
          Please review this appointment request in the admin dashboard.
        </p>
      </div>
    `;

    await sendAppointmentEmail(adminEmail, subject, html);
   
  } catch (emailError) {
    console.error('📧 Failed to send admin email:', emailError);
  }
}

async function sendNewBookingEmailToProvider(appointment) {
  try {
    if (!appointment.providerId?.email) {
      console.warn('📧 No provider email found for appointment:', appointment._id);
      return;
    }

    const subject = '🎉 New Booking Request - Admin Approved';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">New Booking Request</h2>
        <p>Hello ${appointment.providerId.name},</p>
        <p>You have a new booking request that has been approved by admin. Please review and accept or reject this appointment.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Customer:</strong> ${appointment.userId?.name || 'N/A'}</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Date & Time:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
          <p><strong>Estimated Hours:</strong> ${appointment.estimatedHours}</p>
          <p><strong>Total Price:</strong> ₹${appointment.price}</p>
          <p><strong>Location:</strong> ${appointment.location?.address || 'N/A'}</p>
          <p><strong>Customer Contact:</strong> ${appointment.userId?.phone || 'N/A'}</p>
          ${appointment.customerNotes ? `<p><strong>Customer Notes:</strong> ${appointment.customerNotes}</p>` : ''}
        </div>
        <p style="margin-top: 20px;">
          Please respond to this booking request within 24 hours.
        </p>
      </div>
    `;

    await sendAppointmentEmail(appointment.providerId.email, subject, html);
    // console.log('📧 Provider notification email sent successfully');
  } catch (emailError) {
    console.error('📧 Failed to send provider email:', emailError);
  }
}

async function sendAdminApprovalEmailToUser(appointment) {
  try {
    if (!appointment.userId?.email) {
      console.warn('📧 No user email found for appointment:', appointment._id);
      return;
    }

    const subject = '✅ Your Appointment has been Approved by Admin';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Appointment Approved!</h2>
        <p>Hello ${appointment.userId.name},</p>
        <p>Great news! Your appointment request has been approved by our admin team and sent to the service provider.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Provider:</strong> ${appointment.providerId?.name || 'N/A'}</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Date & Time:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
          <p><strong>Estimated Hours:</strong> ${appointment.estimatedHours}</p>
          <p><strong>Total Price:</strong> ₹${appointment.price}</p>
          <p><strong>Location:</strong> ${appointment.location?.address || 'N/A'}</p>
        </div>
        <p><strong>Next Step:</strong> Waiting for provider confirmation. You will be notified once the provider accepts your booking.</p>
      </div>
    `;

    await sendAppointmentEmail(appointment.userId.email, subject, html);
    // console.log('📧 User approval email sent successfully');
  } catch (emailError) {
    console.error('📧 Failed to send user approval email:', emailError);
  }
}

async function sendAdminRejectionEmailToUser(appointment) {
  try {
    if (!appointment.userId?.email) {
      console.warn('📧 No user email found for appointment:', appointment._id);
      return;
    }

    const subject = '❌ Appointment Request Declined';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Appointment Declined</h2>
        <p>Hello ${appointment.userId.name},</p>
        <p>We regret to inform you that your appointment request has been declined by our admin team.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Provider:</strong> ${appointment.providerId?.name || 'N/A'}</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
          <p><strong>Admin Notes:</strong> ${appointment.adminNotes || 'No specific reason provided'}</p>
        </div>
        <p>You can book another appointment with a different provider or contact support for more information.</p>
      </div>
    `;

    await sendAppointmentEmail(appointment.userId.email, subject, html);
    // console.log('📧 User rejection email sent successfully');
  } catch (emailError) {
    console.error('📧 Failed to send user rejection email:', emailError);
  }
}

async function sendProviderAcceptanceEmailToUser(appointment) {
  try {
    if (!appointment.userId?.email) {
      console.warn('📧 No user email found for appointment:', appointment._id);
      return;
    }

    const subject = '🎊 Booking Confirmed! Provider Accepted Your Appointment';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Booking Confirmed!</h2>
        <p>Hello ${appointment.userId.name},</p>
        <p>Great news! ${appointment.providerId?.name || 'The provider'} has accepted your booking request.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Provider:</strong> ${appointment.providerId?.name || 'N/A'}</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Confirmed Date & Time:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
          <p><strong>Estimated Hours:</strong> ${appointment.estimatedHours}</p>
          <p><strong>Total Price:</strong> ₹${appointment.price}</p>
          <p><strong>Location:</strong> ${appointment.location?.address || 'N/A'}</p>
          <p><strong>Provider Contact:</strong> ${appointment.providerId?.phone || 'N/A'}</p>
          ${appointment.providerNotes ? `<p><strong>Provider Notes:</strong> ${appointment.providerNotes}</p>` : ''}
        </div>
        <p style="margin-top: 20px; color: #d62828; font-weight: bold;">
          📍 Please be available at the scheduled time and location.
        </p>
        <p>You can contact the provider directly if you have any questions.</p>
      </div>
    `;

    await sendAppointmentEmail(appointment.userId.email, subject, html);
    // console.log('📧 User confirmation email sent successfully');
  } catch (emailError) {
    console.error('📧 Failed to send user confirmation email:', emailError);
  }
}

async function sendProviderRejectionEmailToUser(appointment) {
  try {
    if (!appointment.userId?.email) {
      console.warn('📧 No user email found for appointment:', appointment._id);
      return;
    }

    const subject = '❌ Provider Declined Your Appointment';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Appointment Declined by Provider</h2>
        <p>Hello ${appointment.userId.name},</p>
        <p>We regret to inform you that ${appointment.providerId?.name || 'the provider'} has declined your booking request.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Provider:</strong> ${appointment.providerId?.name || 'N/A'}</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
          <p><strong>Provider Notes:</strong> ${appointment.providerNotes || 'No specific reason provided'}</p>
        </div>
        <p>You can book another appointment with a different provider or contact support for assistance.</p>
      </div>
    `;

    await sendAppointmentEmail(appointment.userId.email, subject, html);
    // console.log('📧 User provider rejection email sent successfully');
  } catch (emailError) {
    console.error('📧 Failed to send user provider rejection email:', emailError);
  }
}

async function sendProviderAcceptanceEmailToAdmin(appointment) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    
    if (!adminEmail) {
      console.warn('📧 No admin email configured');
      return;
    }

    const subject = '✅ Provider Accepted Appointment';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Provider Accepted Appointment</h2>
        <p>The provider has accepted the following appointment:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Provider:</strong> ${appointment.providerId?.name || 'N/A'} (${appointment.providerId?.email || 'N/A'})</p>
          <p><strong>Customer:</strong> ${appointment.userId?.name || 'N/A'} (${appointment.userId?.email || 'N/A'})</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Confirmed Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
          <p><strong>Total Price:</strong> ₹${appointment.price}</p>
          <p><strong>Location:</strong> ${appointment.location?.address || 'N/A'}</p>
          ${appointment.providerNotes ? `<p><strong>Provider Notes:</strong> ${appointment.providerNotes}</p>` : ''}
        </div>
        <p>The appointment is now confirmed and scheduled.</p>
      </div>
    `;

    await sendAppointmentEmail(adminEmail, subject, html);
    // console.log('📧 Admin provider acceptance notification sent successfully');
  } catch (emailError) {
    console.error('📧 Failed to send admin provider acceptance email:', emailError);
  }
}

async function sendProviderRejectionEmailToAdmin(appointment) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    
    if (!adminEmail) {
      console.warn('📧 No admin email configured');
      return;
    }

    const subject = '❌ Provider Declined Appointment';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Provider Declined Appointment</h2>
        <p>A provider has declined the following appointment:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Provider:</strong> ${appointment.providerId?.name || 'N/A'} (${appointment.providerId?.email || 'N/A'})</p>
          <p><strong>Customer:</strong> ${appointment.userId?.name || 'N/A'} (${appointment.userId?.email || 'N/A'})</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
          <p><strong>Provider Notes:</strong> ${appointment.providerNotes || 'No reason provided'}</p>
        </div>
        <p>You may need to assign this appointment to another provider or contact the customer.</p>
      </div>
    `;

    await sendAppointmentEmail(adminEmail, subject, html);
    // console.log('📧 Admin provider rejection notification sent successfully');
  } catch (emailError) {
    console.error('📧 Failed to send admin provider rejection email:', emailError);
  }
}

async function sendAppointmentCompletionEmailToUser(appointment) {
  try {
    if (!appointment.userId?.email) {
      console.warn('📧 No user email found for appointment:', appointment._id);
      return;
    }

    const subject = '✅ Service Completed - Thank You!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Service Completed</h2>
        <p>Hello ${appointment.userId.name},</p>
        <p>Your service appointment has been marked as completed. We hope you had a great experience!</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Provider:</strong> ${appointment.providerId?.name || 'N/A'}</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Service Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()}</p>
          <p><strong>Total Amount:</strong> ₹${appointment.price}</p>
        </div>
        <p style="margin-top: 20px;">
          Thank you for using our service. We look forward to serving you again!
        </p>
      </div>
    `;

    await sendAppointmentEmail(appointment.userId.email, subject, html);
    // console.log('📧 User completion email sent successfully');
  } catch (emailError) {
    console.error('📧 Failed to send user completion email:', emailError);
  }
}

async function sendAppointmentCancellationEmailToUser(appointment) {
  try {
    if (!appointment.userId?.email) {
      console.warn('📧 No user email found for appointment:', appointment._id);
      return;
    }

    const subject = '❌ Appointment Cancelled';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Appointment Cancelled</h2>
        <p>Hello ${appointment.userId.name},</p>
        <p>Your appointment has been cancelled.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
          <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
          <p><strong>Provider:</strong> ${appointment.providerId?.name || 'N/A'}</p>
          <p><strong>Service:</strong> ${appointment.serviceDescription}</p>
          <p><strong>Original Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}</p>
          <p><strong>Cancellation Reason:</strong> ${appointment.cancellationNotes || 'No reason provided'}</p>
        </div>
        <p>You can book another appointment anytime. We apologize for any inconvenience.</p>
      </div>
    `;

    await sendAppointmentEmail(appointment.userId.email, subject, html);
    // console.log('📧 User cancellation email sent successfully');
  } catch (emailError) {
    console.error('📧 Failed to send user cancellation email:', emailError);
  }
}