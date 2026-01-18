// routes/appointments.js
import express from 'express';
const router = express.Router();
import {
  createAppointment,
  getUserAppointments,
  getProviderAppointments,
  getAllAppointments,
  updateAppointmentStatus,
  updateProviderAppointmentStatus,
  getAppointmentById
} from '../controllers/appointmentController.js';
import auth from '../middlewares/authMiddleware.js';
import adminAuth from '../middlewares/adminAuth.js';

// User routes
router.post('/', auth, createAppointment);
router.get('/my-appointments', auth, getUserAppointments);
router.get('/:id', auth, getAppointmentById);

// Provider routes
router.get('/provider/my-appointments', auth, getProviderAppointments);
router.put('/provider/:id', auth, updateProviderAppointmentStatus);

// Admin routes
router.get('/admin/all', adminAuth, getAllAppointments);
router.put('/admin/:id', adminAuth, updateAppointmentStatus);

export default router;