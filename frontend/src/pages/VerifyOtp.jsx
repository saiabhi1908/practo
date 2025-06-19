import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useLocation, useNavigate } from 'react-router-dom';

const backendUrl = 'http://localhost:4000';

const VerifyOtp = () => {
  const [otp, setOtp] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;
  const purpose = location.state?.purpose || 'register';

  useEffect(() => {
    if (!email) {
      toast.error('Email not found. Please start from the Forgot Password or Register page.');
      navigate(purpose === 'reset' ? '/forgot-password' : '/register');
    }
  }, [email, navigate, purpose]);

  const handleVerify = async () => {
    if (!otp.trim()) {
      toast.error('Please enter OTP');
      return;
    }

    try {
      const endpoint = purpose === 'reset' ? '/api/user/verify-reset-otp' : '/api/user/verify-otp';
      const res = await axios.post(`${backendUrl}${endpoint}`, { email, otp });

      if (res.data.success) {
        toast.success('OTP verified');
        if (purpose === 'reset') {
          navigate('/reset-password', { state: { email, otp } });
        } else {
          navigate('/login');
        }
      } else {
        toast.error(res.data.message || 'OTP verification failed');
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      toast.error('Error verifying OTP');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Verify OTP</h2>
        <p style={styles.subtitle}>
          We’ve sent a one-time password to <strong>{email}</strong>. Please enter it below to continue.
        </p>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter OTP"
          style={styles.input}
        />
        <button onClick={handleVerify} style={styles.button}>
          Verify
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
  },
  card: {
    background: '#ffffff',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#333',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
  },
  input: {
    width: '100%',
    padding: '12px 15px',
    marginBottom: '20px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#28a745',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
};

export default VerifyOtp;
