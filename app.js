import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import categoryRoutes from './src/routes/categories.js';
import providerRoutes from './src/routes/providers.js';
import { errorHandler, notFound } from "./src/middlewares/errorMiddleware.js";
import appointmentRoutes  from './src/routes/appointments.js';

dotenv.config();
connectDB();

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.get("/", (req, res) => {
  res.send("Service Booking API is running!");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/appointments',appointmentRoutes)

// Error handler
app.use(notFound);
app.use(errorHandler);

export default app;