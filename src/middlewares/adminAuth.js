import { protect, authorizeRoles } from './authMiddleware.js';

// Create a middleware function that runs both protect and authorizeRoles
const adminAuth = (req, res, next) => {
  protect(req, res, (err) => {
    if (err) return next(err);
    authorizeRoles('admin')(req, res, next);
  });
};

export default adminAuth;