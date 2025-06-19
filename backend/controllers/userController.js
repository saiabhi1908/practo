import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { v2 as cloudinary } from 'cloudinary';
import stripe from "stripe";
import Insurance from "../models/Insurance.js";

import nodemailer from 'nodemailer';
import sendEmail from '../utils/emailService.js'; 

// Stripe instance
const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

// Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ========= OTP FUNCTIONS =========

// Send OTP
const sendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userModel.findOne({ email });
        if (!user) return res.json({ success: false, message: 'User not found' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 5 * 60 * 1000;

        await userModel.updateOne({ email }, { otp, otpExpires });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP is ${otp}. It is valid for 5 minutes.`
        });

        res.json({ success: true, message: 'OTP sent' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const sendResetOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userModel.findOne({ email });
        if (!user) return res.json({ success: false, message: 'User not found' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 5 * 60 * 1000;

        user.resetOtp = otp;
        user.resetOtpExpires = otpExpires;
        await user.save();

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            text: `Your password reset OTP is ${otp}. It is valid for 5 minutes.`
        });

        res.json({ success: true, message: 'OTP sent to email' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};


const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) return res.json({ success: false, message: 'User not found' });
        if (user.isEmailVerified) return res.json({ success: false, message: 'User already verified' });
        if (user.otp !== otp) return res.json({ success: false, message: 'Invalid OTP' });
        if (Date.now() > user.otpExpires) return res.json({ success: false, message: 'OTP expired' });

        user.isEmailVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};


// Reset Password
const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const user = await userModel.findOne({ email });

        if (!user || !user.resetVerified) {
            return res.json({ success: false, message: 'OTP not verified or session expired' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;

        // ✅ Reset fields after password is changed
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        user.resetVerified = false;

        await user.save();

        res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};


// ========= USER AUTH =========

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing Details' });
        }

        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" });
        }

        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" });
        }

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.json({ success: false, message: 'Email already registered' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 5 * 60 * 1000;

        const newUser = new userModel({
            name,
            email,
            password: hashedPassword,
            otp,
            otpExpires,
            isVerified: false
        });

        await newUser.save();

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify your email - OTP Code',
            text: `Your OTP is ${otp}. It will expire in 5 minutes.`
        });

        res.json({ success: true, message: 'OTP sent to your email for verification' });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};


const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) return res.json({ success: false, message: "User not found" });

        if (!user.isEmailVerified) {
            return res.json({ success: false, message: "Email not verified. Please complete verification." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ success: false, message: "Invalid credentials" });

        if (user.twoFactorEnabled) {
            return res.json({ success: true, twoFactorRequired: true, email: user.email });
        }

        // No 2FA, generate token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.json({ success: true, token });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};


// ========= USER PROFILE =========

const getProfile = async (req, res) => {
    try {
        const { userId } = req.body;
        const userData = await userModel.findById(userId).select('-password');
        res.json({ success: true, userData });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { userId, name, phone, address, dob, gender } = req.body;
        const imageFile = req.file;

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" });
        }

        await userModel.findByIdAndUpdate(userId, {
            name,
            phone,
            address: JSON.parse(address),
            dob,
            gender
        });

        if (imageFile) {
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
            const imageURL = imageUpload.secure_url;
            await userModel.findByIdAndUpdate(userId, { image: imageURL });
        }

        res.json({ success: true, message: 'Profile Updated' });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

const getAppointmentById = async (req, res) => {
  try {
    const appointment = await appointmentModel.findById(req.params.id);
    if (!appointment) {
      return res.json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ========= APPOINTMENTS =========

const bookAppointment = async (req, res) => {
  try {
    const { userId, docId, slotDate, slotTime, insuranceId } = req.body;

    console.log("📌 DOC ID RECEIVED =", docId);

    const doc = await doctorModel.findById(docId).select("-password");

    console.log("📌 Fetched Doctor =", doc);
    console.log("📌 doc.fees =", doc?.fees);
    console.log("📌 doc.fee =", doc?.fee);

    if (!doc || !doc.available) {
      return res.json({ success: false, message: "Doctor not found or unavailable" });
    }

    const baseFee = typeof doc.fees === 'number' ? doc.fees : doc.fee;

    if (!baseFee || isNaN(baseFee)) {
      return res.status(400).json({ success: false, message: "Doctor fee is missing or invalid." });
    }

    const slots_booked = { ...doc.slots_booked };
    if (slots_booked[slotDate]?.includes(slotTime)) {
      return res.json({ success: false, message: "Slot not available" });
    } else {
      slots_booked[slotDate] = [...(slots_booked[slotDate] || []), slotTime];
    }

    const user = await userModel.findById(userId).select("-password");

    let finalAmount = baseFee;
    let selectedInsurance = null;

    if (insuranceId) {
      const insurance = await Insurance.findById(insuranceId);
      selectedInsurance = insurance?.toObject();
      finalAmount = baseFee * 0.1; // Apply insurance discount
    }

    if (isNaN(finalAmount)) {
      return res.status(400).json({ success: false, message: "Fee calculation error" });
    }

    // ✅ Correct and reliable way to build exact appointment timestamp
    const [day, month, year] = slotDate.split('_').map(Number);
    const [time, modifier] = slotTime.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier.toLowerCase() === 'pm' && hours !== 12) hours += 12;
    if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;

    const appointmentDateTime = new Date(year, month - 1, day, hours, minutes, 0); // exact time

    console.log("📆 Final appointment date object:", appointmentDateTime.toLocaleString());

    const appointment = new appointmentModel({
      userId,
      docId,
      userData: user.toObject(),
      docData: { ...doc.toObject(), slots_booked: undefined },
      amount: Number(finalAmount),
      slotDate,
      slotTime,
      date: appointmentDateTime,
      insurance: selectedInsurance || undefined,
    });

    await appointment.save();
    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    // ✅ Send confirmation email to user
    if (user?.email) {
      const subject = '✅ Appointment Confirmation - Practo HealthCare';
      const message = `
Hi ${user.name || 'Patient'},

Your appointment has been successfully booked with Dr. ${doc.name}.

🗓 Date: ${slotDate}
⏰ Time: ${slotTime}
💳 Fee to be Paid: ${Number(finalAmount).toFixed(2)} ${process.env.CURRENCY?.toUpperCase() || 'USD'}

Thank you for choosing Practo HealthCare.

Regards,  
Practo HealthCare Team
      `;
      await sendEmail(user.email, subject, message);
    }

    return res.json({ success: true, message: "Appointment Booked", appointment });
  } catch (error) {
    console.error("❌ bookAppointment error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};






const cancelAppointment = async (req, res) => {
  try {
    const { userId, appointmentId } = req.body;
    const appointmentData = await appointmentModel.findById(appointmentId);

    if (!appointmentData) {
      return res.json({ success: false, message: 'Appointment not found' });
    }

    if (appointmentData.userId !== userId) {
      return res.json({ success: false, message: 'Unauthorized action' });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true });

    const { docId, slotDate, slotTime, userData, docData } = appointmentData;

    const doctorData = await doctorModel.findById(docId);

    if (!doctorData) {
      return res.json({ success: false, message: 'Doctor not found' });
    }

    let slots_booked = doctorData.slots_booked || {};
    if (slots_booked[slotDate]) {
      slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime);

      // If the array is now empty, delete the key
      if (slots_booked[slotDate].length === 0) {
        delete slots_booked[slotDate];
      }
    }

    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    // ✅ Send cancellation email to user
    if (userData?.email && docData?.name) {
      const subject = "❌ Appointment Cancelled - Practo HealthCare";
      const message = `
Hi ${userData.name || "Patient"},

Your appointment with Dr. ${docData.name} has been cancelled.

🗓 Date: ${slotDate}
⏰ Time: ${slotTime}

If this was a mistake, you may book another appointment anytime.

Regards,  
Practo HealthCare Team
      `;

      await sendEmail(userData.email, subject, message);
      console.log(`📨 Cancellation email sent to ${userData.email}`);
    }

    res.json({ success: true, message: 'Appointment Cancelled' });
  } catch (error) {
    console.log("❌ cancelAppointment error:", error);
    res.json({ success: false, message: error.message });
  }
};


const listAppointment = async (req, res) => {
    try {
        const { userId } = req.body;
        const appointments = await appointmentModel.find({ userId });
        res.json({ success: true, appointments });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// ========= PAYMENTS =========

const paymentStripe = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const { origin } = req.headers;

    const appointmentData = await appointmentModel.findById(appointmentId);

    if (!appointmentData || appointmentData.cancelled) {
      return res.json({ success: false, message: 'Appointment Cancelled or not found' });
    }

    const amount = Number(appointmentData.amount);

    if (isNaN(amount) || amount <= 0) {
      console.log('❌ Invalid appointment amount:', appointmentData.amount);
      return res.json({ success: false, message: 'Invalid appointment amount' });
    }

    const currency = (process.env.CURRENCY || 'usd').toLowerCase();

    const line_items = [{
      price_data: {
        currency,
        product_data: { name: "Appointment Fees" },
        unit_amount: Math.round(amount * 100), // Stripe wants amount in cents
      },
      quantity: 1,
    }];

    const session = await stripeInstance.checkout.sessions.create({
      success_url: `${origin}/verify?success=true&appointmentId=${appointmentData._id}`,
      cancel_url: `${origin}/verify?success=false&appointmentId=${appointmentData._id}`,
      line_items,
      mode: 'payment',
    });

    res.json({ success: true, session_url: session.url });
  } catch (error) {
    console.error('Stripe payment error:', error);
    res.json({ success: false, message: error.message });
  }
};


const verifyResetOTP = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (user.resetOtp !== otp || Date.now() > user.resetOtpExpires) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        user.resetVerified = true; // ✅ Mark user as verified
        await user.save();

        res.json({ success: true, message: 'OTP verified. You can now reset your password.' });
    } catch (error) {
        console.error('Error verifying reset OTP:', error);
        res.status(500).json({ success: false, message: 'Server error verifying OTP' });
    }
};


  
const verifyStripe = async (req, res) => {
  try {
    const { appointmentId, success } = req.body;

    if (success === "true") {
      const updatedAppointment = await appointmentModel.findByIdAndUpdate(
        appointmentId,
        { payment: true },
        { new: true } // ✅ returns the updated document
      );

      if (!updatedAppointment) {
        return res.status(404).json({ success: false, message: 'Appointment not found' });
      }

      // ✅ Send confirmation email AFTER payment is marked
      const { userData, docData, slotDate, slotTime, amount } = updatedAppointment;

      if (userData?.email) {
        const subject = "✅ Appointment Confirmed - Practo HealthCare";
        const message = `
Hi ${userData.name || "Patient"},

🎉 Your payment was successful, and your appointment with Dr. ${docData?.name} is now confirmed.

🗓 Date: ${slotDate}
⏰ Time: ${slotTime}
💳 Paid: ${amount} ${process.env.CURRENCY?.toUpperCase() || 'USD'}

Thank you for choosing Practo HealthCare.

Regards,  
Practo HealthCare Team
        `;

        await sendEmail(userData.email, subject, message);
        console.log(`📨 Confirmation email sent to ${userData.email}`);
      }

      return res.json({ success: true, message: 'Payment Successful & Appointment Confirmed' });
    }

    return res.json({ success: false, message: 'Payment Failed' });

  } catch (error) {
    console.log("❌ verifyStripe error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ========= EXPORT ALL =========

export {
    loginUser,
    registerUser,
    getProfile,
    updateProfile,
    bookAppointment,
    listAppointment,
    cancelAppointment,
    paymentStripe,
    verifyStripe,
    sendOTP,
    resetPassword,
    verifyOtp,
    sendResetOTP,
    getAppointmentById,
    verifyResetOTP
};
