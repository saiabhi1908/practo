import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AdminContext } from '../../context/AdminContext';
import { AppContext } from '../../context/AppContext';
import { toast } from 'react-toastify';

const UploadReport = () => {
  const [reportFile, setReportFile] = useState(null);
  const [userId, setUserId] = useState('');
  const { aToken } = useContext(AdminContext);
  const { backendUrl } = useContext(AppContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportFile || !userId) {
      toast.error('Please provide all details.');
      return;
    }

    const formData = new FormData();
    formData.append('report', reportFile);
    formData.append('userId', userId);

    try {
      const res = await axios.post(`${backendUrl}/api/reports/upload`, formData, {
        headers: {
          Authorization: `Bearer ${aToken}`,
        },
      });
      toast.success(res.data.message);
      setReportFile(null);
      setUserId('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="m-5 p-5 bg-white rounded shadow max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Upload Medical Report</h2>
      <div className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Enter User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setReportFile(e.target.files[0])}
          className="border rounded px-3 py-2"
          required
        />
        <button type="submit" className="bg-primary text-white px-4 py-2 rounded">
          Upload
        </button>
      </div>
    </form>
  );
};

export default UploadReport;