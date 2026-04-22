import { useEffect, useState } from "react";

function App() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div>
      <h1>Helpdesk</h1>
      <p>API status: {status ?? "loading..."}</p>
    </div>
  );
}

export default App;
