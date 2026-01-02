import { useState } from "react";
import LoginPage from "./pages/LoginPage";
import BookingPage from "./pages/BookingPage";
import AdminPage from "./pages/AdminPage";
import Footer from "./components/Footer";
import { setSession } from "./api";

export default function App() {
  const [session, setSessionState] = useState(null);

  function onLogin(data) {
    setSession(data.token);
    setSessionState(data);
  }

  let content;

  if (!session) {
    content = <LoginPage onLogin={onLogin} />;
  } else if (session.role === "admin") {
    content = <AdminPage />;
  } else {
    content = <BookingPage />;
  }

  return (
    <>
      {content}
      <Footer />
    </>
  );
}
