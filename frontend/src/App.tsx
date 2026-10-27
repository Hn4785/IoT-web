import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";

import AppRoutes from "@/routes/AppRoutes";
import { useAuthStore } from "@/stores/authStore";

function App() {
  const {
    isLoading,
    restoreSession,
  } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (isLoading) {
    return null;
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;