import express from 'express';
import {
  getFeaturedCategories,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug
} from '../controllers/categoryController.js';

const router = express.Router();

router.get('/featured', getFeaturedCategories);
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);
// router.get('/slug/:slug', getCategoryBySlug);
router.get('/slug/:slug', getCategoryBySlug);

export default router;