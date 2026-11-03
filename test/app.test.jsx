import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within, cleanup } from "@testing-library/react";
import StaffApp from "../src/StaffApp.jsx";
import Booking from "../src/pages/Booking.jsx";
import { publicSlots } from "../src/lib/api.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const nav = (container, label) =>
  [...container.querySelectorAll(".nav-item")].find((b) => b.textContent.trim() === label);

describe("staff app (director)", () => {
  it("signs in and shows the dashboard with live data", async () => {
    const { container } = render(<StaffApp />);
    await waitFor(() => expect(container.querySelector(".page-title")).toBeTruthy(), { timeout: 8000 });
    expect(container.querySelector(".page-title").textContent).toContain("Capt. Sunil Srivastava");
    await waitFor(() => expect(container.querySelector(".alert-banner")).toBeTruthy());
    await waitFor(() => expect(container.querySelectorAll(".appt-card").length).toBeGreaterThanOrEqual(2));
    expect(nav(container, "Payments")).toBeTruthy();                        // leadership-only page visible
  });

  it("lists all appointments on the Appointments page", async () => {
    const { container } = render(<StaffApp />);
    await waitFor(() => expect(container.querySelector(".page-title")).toBeTruthy(), { timeout: 8000 });
    fireEvent.click(nav(container, "Appointments"));
    await waitFor(() => expect(container.querySelectorAll("table.table tbody tr").length).toBe(7));
  });

  it("shows payment totals on the Payments page", async () => {
    const { container } = render(<StaffApp />);
    await waitFor(() => expect(container.querySelector(".page-title")).toBeTruthy(), { timeout: 8000 });
    fireEvent.click(nav(container, "Payments"));
    await waitFor(() => expect(container.querySelector(".stat-val").textContent).toContain("38,000"));
  });

  it("shows the team with role controls for the director", async () => {
    const { container } = render(<StaffApp />);
    await waitFor(() => expect(container.querySelector(".page-title")).toBeTruthy(), { timeout: 8000 });
    fireEvent.click(nav(container, "Team"));
    await waitFor(() => expect(container.querySelectorAll(".member").length).toBe(3));
    // director can change the other two members' roles
    expect(container.querySelectorAll(".member select").length).toBe(2);
  });

  it("creates a staff account with the selected access role", async () => {
    const { container } = render(<StaffApp />);
    await waitFor(() => expect(container.querySelector(".page-title")).toBeTruthy(), { timeout: 8000 });
    fireEvent.click(nav(container, "Team"));

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Staff Member" } });
    fireEvent.change(screen.getByLabelText("Login email"), { target: { value: "new.staff@example.com" } });
    fireEvent.change(screen.getByLabelText("Initial password", { exact: false }), {
      target: { value: "abc123" },
    });
    expect(screen.getByLabelText("Initial password", { exact: false }).minLength).toBe(6);
    fireEvent.change(screen.getByLabelText("Access level"), {
      target: { value: "assistant_director" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(document.querySelector(".toast")?.textContent).toContain("created"));
    await waitFor(() => expect(container.querySelectorAll(".member").length).toBe(4));
    expect(container.textContent).toContain("New Staff Member");
  });

  it("explains how to fix an unreachable staff account function", async () => {
    const { container } = render(<StaffApp />);
    await waitFor(() => expect(container.querySelector(".page-title")).toBeTruthy(), { timeout: 8000 });
    fireEvent.click(nav(container, "Team"));

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Unavailable Staff" } });
    fireEvent.change(screen.getByLabelText("Login email"), { target: { value: "unavailable@example.com" } });
    fireEvent.change(screen.getByLabelText("Initial password", { exact: false }), {
      target: { value: "abc123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect((await screen.findByRole("alert")).textContent)
      .toContain("Confirm it is deployed to this Supabase project");
  });

  it("opens an appointment's details when its card is clicked", async () => {
    const { container } = render(<StaffApp />);
    await waitFor(() => expect(container.querySelector(".appt-card")).toBeTruthy(), { timeout: 8000 });
    fireEvent.click(container.querySelector(".appt-card"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { level: 2 }).textContent.length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Activity")).toBeTruthy();
    expect(within(dialog).queryByText("Mode", { exact: true })).toBeNull();
  });

  it("shows appointments in the dashboard calendar and opens their details", async () => {
    const { container } = render(<StaffApp />);
    await screen.findByRole("heading", { name: /Calendar & office holidays/ });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const calendar = container.querySelector(".calendar-grid");
    const todayButton = await waitFor(() => {
      const button = [...calendar.querySelectorAll(".calendar-day")]
        .find((item) => item.getAttribute("aria-label").startsWith(today));
      expect(button).toBeTruthy();
      return button;
    });

    fireEvent.click(todayButton);
    expect(container.querySelector(".calendar-appointments").textContent).toContain("Rahul Mehta");
    fireEvent.click(screen.getByRole("button", { name: "Open Rahul Mehta appointment details" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("lets a director add and remove a company holiday", async () => {
    render(<StaffApp />);
    await screen.findByRole("heading", { name: /Calendar & office holidays/ });
    const holidayDate = new Date();
    holidayDate.setDate(holidayDate.getDate() + 14);
    const dateValue = holidayDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    fireEvent.change(screen.getByLabelText("Holiday date"), { target: { value: dateValue } });
    fireEvent.change(screen.getByLabelText("Holiday name or reason"), { target: { value: "Test company holiday" } });
    fireEvent.click(screen.getByRole("button", { name: "Add holiday" }));

    await waitFor(() => expect(document.querySelector(".toast")?.textContent).toBe("Company holiday added"));
    expect(await screen.findByText("Test company holiday")).toBeTruthy();
    expect(await publicSlots(dateValue)).toEqual([]);

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: `Remove holiday ${dateValue}` }));
    await waitFor(() => expect(document.querySelector(".toast")?.textContent).toBe("Company holiday removed"));
    await waitFor(() => expect(screen.queryByText("Test company holiday")).toBeNull());
  });

  it("creates a new appointment through the form", async () => {
    const { container } = render(<StaffApp />);
    await waitFor(() => expect(container.querySelector(".page-title")).toBeTruthy(), { timeout: 8000 });
    fireEvent.click(screen.getByRole("button", { name: /Register client/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Register client" })).toBeTruthy();
    expect(within(dialog).queryByText("Mode", { exact: true })).toBeNull();
    expect(within(dialog).queryByLabelText("Urgency")).toBeNull();
    expect(within(dialog).queryByLabelText("Assigned to")).toBeNull();

    fireEvent.change(within(dialog).getByLabelText(/Client name/), { target: { value: "Test Client" } });
    fireEvent.change(dialog.querySelector("input[type=tel]"), { target: { value: "9811122233" } });
    fireEvent.click(within(dialog).getByLabelText("Digital forensics consultation"));
    const futureDate = new Date(Date.now() + 3 * 864e5);
    while (futureDate.getDay() === 1) futureDate.setDate(futureDate.getDate() + 1);
    const future = futureDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    fireEvent.change(dialog.querySelector("input[type=date]"), { target: { value: future } });
    await waitFor(() => expect(dialog.querySelectorAll(".register-slot:not(:disabled)").length).toBeGreaterThan(0));
    fireEvent.click(within(dialog).getByRole("button", { name: "4:00 pm" }));
    expect(within(dialog).getByRole("button", { name: "4:00 pm" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Register client" }));

    await waitFor(() => expect(document.querySelector(".toast")?.textContent).toContain("created"), { timeout: 8000 });
    expect(await screen.findByText("Test Client")).toBeTruthy();
    expect(container.textContent).not.toContain("mode");
  });
});

describe("public booking page (no login)", () => {
  it("loads free slots for a working day and submits a request", async () => {
    const { container } = render(<Booking />);
    expect(container.querySelector("h1").textContent).toContain("Cyber Crime Helpline");
    expect(container.textContent).not.toMatch(/meeting mode/i);
    expect(container.textContent).toContain("Consultation fee: ₹2,000.");
    expect(container.textContent).toContain("Additional charges may apply depending on the services required.");

    let off = 2, day;
    do {
      day = new Date(Date.now() + off * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      off++;
    } while (new Date(day + "T12:00:00+05:30").getDay() === 1);

    fireEvent.change(container.querySelector("input[type=date]"), { target: { value: day } });
    await waitFor(() => expect(container.querySelectorAll(".slot").length).toBe(9), { timeout: 8000 });

    fireEvent.click(container.querySelector(".slot:not([disabled])"));
    const service = [...container.querySelectorAll(".service-checkbox")]
      .find((label) => label.textContent.includes("Online financial fraud / UPI / banking"));
    fireEvent.click(service.querySelector("input"));
    fireEvent.change(container.querySelector("input[autocomplete=name]"), { target: { value: "Public Visitor" } });
    fireEvent.change(container.querySelector("input[type=tel]"), { target: { value: "9800098765" } });
    fireEvent.click(container.querySelector(".consent input[type=checkbox]"));
    fireEvent.click(container.querySelector("button[type=submit]"));

    await waitFor(() => expect(container.querySelector(".ref")?.textContent).toMatch(/^CCH-/), { timeout: 8000 });
  });

  it("refuses a request without consent", async () => {
    const { container } = render(<Booking />);
    const otherService = [...container.querySelectorAll(".service-checkbox")]
      .find((label) => label.textContent.includes("Other"));
    fireEvent.click(otherService.querySelector("input"));
    fireEvent.click(container.querySelector("button[type=submit]"));
    await waitFor(() => expect(container.querySelector(".err")?.textContent).toMatch(/Please pick a date|Please choose a date/));
  });
});
