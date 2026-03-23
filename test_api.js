async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/run-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journalText: "hi", baselineMap: 90, useCamera: false, simulateSpoof: false })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
