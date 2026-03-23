async function run() {
  const p1 = fetch("http://localhost:8001/health").then(r => r.json()).catch(e => "FAIL");
  const p2 = fetch("http://localhost:8002/health").then(r => r.json()).catch(e => "FAIL");
  const p3 = fetch("http://localhost:8003/health").then(r => r.json()).catch(e => "FAIL");
  const p4 = fetch("http://localhost:8004/health").then(r => r.json()).catch(e => "FAIL");
  
  const results = await Promise.all([p1, p2, p3, p4]);
  console.log("8001 (Depression):", results[0]);
  console.log("8002 (PPG):", results[1]);
  console.log("8003 (Kineticare):", results[2]);
  console.log("8004 (Orchestrator):", results[3]);
}
run();
