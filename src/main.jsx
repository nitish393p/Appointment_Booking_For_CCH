import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";

// The public booking page lives at /book. Everything else is the staff app.
// Each side loads its own stylesheet, so the two never clash.
const isBooking = window.location.pathname.replace(/\/+$/, "") === "/book";
const Booking = lazy(() => import("./pages/Booking.jsx"));
const StaffApp = lazy(() => import("./StaffApp.jsx"));
const Entry = isBooking ? Booking : StaffApp;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div className="splash">Loading…</div>}>
      <Entry />
    </Suspense>
  </React.StrictMode>
);
