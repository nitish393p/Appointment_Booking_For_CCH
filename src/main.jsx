import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";

// The public booking page lives at /book. Everything else is the staff app.
// Each side loads its own stylesheet, so the two never clash.
const isBooking = window.location.pathname.replace(/\/+$/, "") === "/book";
const Entry = lazy(() => (isBooking ? import("./pages/Booking.jsx") : import("./StaffApp.jsx")));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div className="splash">Loading…</div>}>
      <Entry />
    </Suspense>
  </React.StrictMode>
);
