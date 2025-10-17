import { useState, useEffect } from 'react';

function App() {
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Backend not connected'));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Network Simulator
          </h1>
          <p className="text-gray-600">
            A web-based network simulation platform
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">Status</h2>
          <p className="text-gray-700">Backend: {message || 'Loading...'}</p>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
          <p className="text-gray-700">
            Welcome to the Network Simulator! This is a starting point for
            building your network simulation application.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
