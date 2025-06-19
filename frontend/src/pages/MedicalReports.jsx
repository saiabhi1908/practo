import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import { toast } from 'react-toastify';

const MedicalReports = () => {
  const { backendUrl, token } = useContext(AppContext);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/reports/user`, {
          headers: { token },
        });
        setReports(res.data.reports);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Could not fetch reports');
      }
    };
    if (token) fetchReports();
  }, [token]);

  return (
    <div className="m-5 p-5 bg-white rounded shadow max-w-4xl">
      <h2 className="text-xl font-semibold mb-4">My Medical Reports</h2>
      {reports.length === 0 ? (
        <p>No reports available.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((report, idx) => (
            <li key={idx} className="flex justify-between border p-3 rounded">
              <span>{report.reportName}</span>
<a
  href={report.fileUrl}
  download
  className="text-blue-600 hover:underline"
>
  Download
</a>

            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MedicalReports;
