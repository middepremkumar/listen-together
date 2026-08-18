import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CreateRoom from './pages/CreateRoom.jsx';
import JoinRoom from './pages/JoinRoom.jsx';
import Room from './pages/Room.jsx';
import ErrorPage from './pages/ErrorPage.jsx';
import { SocketProvider } from './context/SocketContext.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateRoom />} />
      <Route path="/join" element={<JoinRoom />} />
      <Route path="/join/:roomId" element={<JoinRoom />} />
      <Route
        path="/room/:roomId"
        element={
          <SocketProvider>
            <Room />
          </SocketProvider>
        }
      />
      <Route
        path="*"
        element={
          <ErrorPage
            title="Page not found"
            message="The page you're looking for doesn't exist."
          />
        }
      />
    </Routes>
  );
}
