// ... keep all imports as-is
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import docImage from '../assets/doc1.png';
import { assets } from '../assets/assets';
import RelatedDoctors from '../components/RelatedDoctors';
import { toast } from 'react-toastify';
import axios from 'axios';
import PatientChat from '../components/PatientChat';

const Appointment = () => {
  const { docId } = useParams();
  const {
    doctors,
    currencySymbol,
    backendUrl,
    token,
    getDoctorsData,
    userData
  } = useContext(AppContext);

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const navigate = useNavigate();

  const [docInfo, setDocInfo] = useState(null);
  const [docSlots, setDocSlots] = useState([]);
  const [slotIndex, setSlotIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);

  const [userInsurances, setUserInsurances] = useState([]);
  const [selectedInsuranceId, setSelectedInsuranceId] = useState('');
  const [finalFee, setFinalFee] = useState(null);
  const [appointmentId, setAppointmentId] = useState(null);

  useEffect(() => {
    if (doctors && doctors.length > 0) {
      const foundDoc = doctors.find(doc => doc._id === docId);
      if (foundDoc) {
        setDocInfo(foundDoc);
        setFinalFee(foundDoc.fees ?? foundDoc.fee);
      }
    }
  }, [doctors, docId]);

  useEffect(() => {
    if (token) {
      axios.get(`${backendUrl}/api/insurance`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (Array.isArray(res.data)) setUserInsurances(res.data);
      }).catch(err => {
        console.error('Error fetching insurance:', err);
      });
    }
  }, [token, backendUrl]);

  useEffect(() => {
    const baseFee = docInfo?.fees ?? docInfo?.fee;
    if (!selectedInsuranceId) {
      setFinalFee(baseFee || null);
      return;
    }

    // Always charge 10% of the fee when insurance is selected
    setFinalFee(baseFee * 0.1);
  }, [selectedInsuranceId, docInfo]);

  useEffect(() => {
    if (!docInfo) return;
    setDocSlots([]);

    let today = new Date();
    const extraDays = selectedInsuranceId ? 9 : 7;

    for (let i = 0; i < extraDays; i++) {
      let currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);

      let endTime = new Date(currentDate);
      endTime.setHours(21, 0, 0, 0);

      if (today.getDate() === currentDate.getDate()) {
        currentDate.setHours(currentDate.getHours() > 10 ? currentDate.getHours() + 1 : 10);
        currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0);
      } else {
        currentDate.setHours(10);
        currentDate.setMinutes(0);
      }

      let timeSlots = [];
      while (currentDate < endTime) {
        let formattedTime = currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let day = currentDate.getDate();
        let month = currentDate.getMonth() + 1;
        let year = currentDate.getFullYear();

        const slotDate = `${day}_${month}_${year}`;
        const slotTime = formattedTime;

        const isSlotAvailable =
          docInfo.slots_booked[slotDate] &&
          docInfo.slots_booked[slotDate].includes(slotTime)
            ? false
            : true;

        if (isSlotAvailable) {
          timeSlots.push({
            datetime: new Date(currentDate),
            time: formattedTime,
          });
        }

        currentDate.setMinutes(currentDate.getMinutes() + 10);
      }

      setDocSlots(prev => [...prev, timeSlots]);
    }
  }, [docInfo, selectedInsuranceId]);

  useEffect(() => {
    const fetchExistingAppointment = async () => {
      if (!token || !userData || !docId) return;

      try {
        const { data } = await axios.get(`${backendUrl}/api/user/appointments`, {
          headers: { token }
        });

        if (data.success && Array.isArray(data.appointments)) {
          const found = data.appointments.find(
            (apt) => apt.docId === docId && !apt.cancelled
          );
          if (found) {
            setAppointmentId(found._id);
          }
        }
      } catch (error) {
        console.error("Error fetching existing appointment:", error);
      }
    };

    fetchExistingAppointment();
  }, [userData, docId]);

  const bookAppointment = async () => {
    if (!token) {
      toast.warn('Please login to book an appointment');
      return navigate('/login');
    }

    if (!selectedSlot) {
      toast.error('Please select a time slot.');
      return;
    }

    if (!selectedInsuranceId) {
      toast.error("Please select an insurance policy to proceed.");
      return;
    }

    setLoading(true);
    try {
      const date = selectedSlot.datetime;
      let day = date.getDate();
      let month = date.getMonth() + 1;
      let year = date.getFullYear();

      const slotDate = `${day}_${month}_${year}`;
      const slotTime = selectedSlot.time;

      const { data } = await axios.post(
        backendUrl + '/api/user/book-appointment',
        {
          docId,
          slotDate,
          slotTime,
          insuranceId: selectedInsuranceId
        },
        { headers: { token } }
      );

      if (data.success && data.appointment) {
        toast.success('Appointment booked successfully!');
        getDoctorsData();
        setAppointmentId(data.appointment._id);
      } else {
        toast.error(data.message || 'Failed to book appointment');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  if (!docInfo) {
    return <div>Loading doctor information...</div>;
  }

  const experienceText = `${docInfo.experience} ${docInfo.experience === 1 ? 'year' : 'years'}`;

  return (
    <div className="p-6 bg-gray-50 rounded-lg shadow-md max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <img className="w-40 h-40 md:w-52 md:h-52 rounded-lg shadow-md object-cover" src={docInfo.image || docImage} alt={docInfo.name} />
        <div className="flex-1">
          <p className="text-3xl font-bold text-gray-800 flex items-center">
            {docInfo.name}
            <img className="ml-2 w-5" src={assets.verified_icon} alt="Verified" />
          </p>
          <p className="text-lg text-gray-600 mt-1">
            {docInfo.degree} - {docInfo.speciality}
          </p>
          <span className="mt-2 inline-block bg-blue-600 text-white text-sm font-semibold py-1 px-3 rounded-full">
            {experienceText}
          </span>
          <p className="mt-4 text-gray-700 leading-relaxed text-sm">{docInfo.about}</p>
          <p className="mt-2 font-medium text-gray-600">
            Appointment Fee:
            <span className="text-gray-800 font-bold">
              {currencySymbol}{docInfo.fees ?? docInfo.fee ?? 'N/A'}
            </span>
          </p>
          {selectedInsuranceId && typeof finalFee === 'number' && (
            <p className="text-sm text-green-700 font-semibold mt-1">
              Discounted Fee: <span className="text-green-800 font-bold">{currencySymbol}{finalFee.toFixed(2)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-2xl font-bold text-gray-700 mb-4">Available Slots</h3>
        <div className="flex justify-center gap-4 mb-6">
          {[...Array(docSlots.length)].map((_, i) => (
            <button
              key={i}
              onClick={() => setSlotIndex(i)}
              className={`px-4 py-2 rounded-md border ${slotIndex === i ? 'border-blue-600 bg-blue-100' : 'border-gray-300'}`}
            >
              {daysOfWeek[(new Date().getDay() + i) % 7]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {(docSlots[slotIndex] || []).map((slot, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedSlot(slot)}
              className={`p-2 rounded-md border ${selectedSlot === slot ? 'border-green-600 bg-green-100' : 'border-gray-300'}`}
            >
              {slot.time}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h4 className="text-xl font-semibold mb-3">Select Insurance</h4>
        <select
          className="w-full p-2 border border-gray-300 rounded-md"
          value={selectedInsuranceId}
          onChange={e => setSelectedInsuranceId(e.target.value)}
        >
          <option value="">-- Select Insurance --</option>
          {userInsurances.map(ins => (
            <option key={ins._id} value={ins._id}>
              {ins.insuranceProvider} ({ins.coverageDetails})
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8">
        <button
          disabled={loading}
          onClick={bookAppointment}
          className="w-full p-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
        >
          {loading ? 'Booking...' : `Book Appointment${finalFee !== null ? ` - ${currencySymbol}${finalFee.toFixed(2)}` : ''}`}
        </button>
      </div>

      {appointmentId && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-2">Chat with Doctor</h2>
          <PatientChat appointmentId={appointmentId} userId={userData?._id} />
        </div>
      )}

      <RelatedDoctors currentDocId={docId} />
    </div>
  );
};

export default Appointment;
