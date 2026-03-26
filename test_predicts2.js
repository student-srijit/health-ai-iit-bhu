async function post(url, payload) {
  try {
    const res = await fetch(url, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log(url, "->", res.status, text.slice(0, 80));
  } catch (err) {
    console.log(url, "-> ERROR", err.message);
  }
}

async function run() {
  const patientId = "test-id-123";
  const dp = {
    patient_id: patientId,
    journal_text: "hi",
    audio_features: new Array(128).fill(0.2),
    video_features: new Array(128).fill(0.15),
  };
  const pp = {
    patient_id: patientId,
    ppg_signal: new Array(100).fill(0.1),
    sampling_rate_hz: 100,
    baseline_map: 90,
  };
  const kp = {
    patient_id: patientId,
    dwell_times_ms: new Array(16).fill(100),
    flight_times_ms: new Array(16).fill(90),
    imu_accel_magnitude: new Array(128).fill(0.02),
    sampling_rate_hz: 50,
  };

  await post("http://127.0.0.1:8001/predict", dp);
  await post("http://127.0.0.1:8002/predict", pp);
  await post("http://127.0.0.1:8004/predict", kp);
  
  const op = {
      patient_id: patientId,
      depression: { depression_score: 0.8, risk_band: "high" },
      ppg: { map: 90, change_map: 0, ratio_map: 1, sbp: 120, dbp: 80, hr_bpm: 72, risk_band: "low" },
      kineticare: { risk_band: "low", session_quality: "good", signals_used: ["imu"] },
      camera_quality: { status: "accepted", camera_sqi: 1.0, spoof_detected: false }
  };
  await post("http://127.0.0.1:8003/summarize", op);
}
run();
