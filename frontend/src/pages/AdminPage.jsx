import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import {
  getBookings,
  createBooking,
  deleteBooking,
  getEnums
} from "../api";

import Modal from "../components/Modal";
import Toast from "../components/Toast";
import BookingInfoBox from "../components/BookingInfoBox";

// TODO: Cobine with Booking Page to reduce duplicate code
/* ======================
   Helpers (IDENTICAL)
   ====================== */

function colorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${(Math.abs(hash) * 137.508) % 360}, 70%, 50%)`;
}

function snapTimeValue(value, stepMinutes) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  let [h, m] = value.split(":").map(Number);
  const snapped = Math.round(m / stepMinutes) * stepMinutes;

  if (snapped === 60) {
    h = (h + 1) % 24;
    m = 0;
  } else {
    m = snapped;
  }

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toLocalTimeValue(dateStr) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/* ======================
   CET-safe local ISO
   ====================== */

function toLocalISOString(date) {
  const pad = n => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` + // JS months are 0-based
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}:00`
  );
}

function combineDateAndTime(dateStr, timeStr) {
  const base = new Date(dateStr);
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return toLocalISOString(d);
}

function snap(date, step) {
  const d = new Date(date);
  d.setMinutes(Math.round(d.getMinutes() / step) * step, 0, 0);
  return d;
}

function extractErrorMessage(error) {
  if (!error) return "Unbekannter Fehler";
  if (typeof error === "string") return error;

  return (
    error.response?.data?.detail ||
    error.detail ||
    (() => {
      try {
        return JSON.parse(error.message)?.detail || error.message;
      } catch {
        return error.message;
      }
    })() ||
    "Ein Fehler ist aufgetreten"
  );
}

/* ======================
   Page
   ====================== */

export default function AdminPage() {
  const [resources, setResources] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [rules, setRules] = useState(null);
  const [resourceKey, setResourceKey] = useState(null);

  const [events, setEvents] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [toast, setToast] = useState(null);

  const [startDraft, setStartDraft] = useState("");
  const [endDraft, setEndDraft] = useState("");

  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  /* ---------- Derived ---------- */

  const resourceValueToKey = useMemo(
    () => Object.fromEntries(resources.map(r => [r.label, r.key])),
    [resources]
  );

  const roomLabelByKey = useMemo(
    () => Object.fromEntries(rooms.map(r => [r.key, r.label])),
    [rooms]
  );

  /* ---------- Load enums ---------- */

  useEffect(() => {
    getEnums()
      .then(data => {
        setRooms(data.rooms);
        setResources(data.resources);
        setRules(data.booking_rules);
        if (!resourceKey && data.resources.length) {
          setResourceKey(data.resources[0].key);
        }
      })
      .catch(e => setToast(extractErrorMessage(e)));
  }, []);

  /* ---------- Load bookings ---------- */

  useEffect(() => {
    if (!resourceKey || !rooms.length) return;

    getBookings()
      .then(bookings => {
        setEvents(
          bookings
            .filter(b => resourceValueToKey[b.resource] === resourceKey)
            .map(b => ({
              id: b.id,
              start: b.start,
              end: b.end,
              title: roomLabelByKey[b.room] ?? b.room,
              backgroundColor: colorFromString(b.room),
              borderColor: colorFromString(b.room),
              editable: false
            }))
        );
      })
      .catch(e => setToast(extractErrorMessage(e)));
  }, [resourceKey, rooms, resources]);

  /* ---------- Sync drafts ---------- */

  useEffect(() => {
    if (!selectedSlot) return;
    setStartDraft(toLocalTimeValue(selectedSlot.start));
    setEndDraft(toLocalTimeValue(selectedSlot.end));
  }, [selectedSlot]);

  if (!rules || !resourceKey) return null;

  /* ---------- Calendar handlers ---------- */

  function handleSelect(info) {
    if (isMobile) return;

    setSelectedSlot({
      start: toLocalISOString(new Date(info.start)),
      end: toLocalISOString(new Date(info.end))
    });
    setSelectedRoom(null);
  }

  function handleDateClick(info) {
    if (!isMobile) return;

    const start = snap(info.date, rules.step_minutes);
    const end = new Date(
      start.getTime() + rules.default_duration_minutes * 60000
    );

    setSelectedSlot({
      start: toLocalISOString(start),
      end: toLocalISOString(end)
    });
    setSelectedRoom(null);
  }

  function handleEventClick(info) {
    setSelectedEvent(info.event);
  }

  function closeCreateModal() {
    setSelectedSlot(null);
    setSelectedRoom(null);
  }

  async function submitBooking() {
    try {
      await createBooking({
        room: selectedRoom,
        resource: resourceKey,
        start: selectedSlot.start,
        end: selectedSlot.end
      });
      closeCreateModal();
      const bookings = await getBookings();
      setEvents(
        bookings
          .filter(b => resourceValueToKey[b.resource] === resourceKey)
          .map(b => ({
            id: b.id,
            start: b.start,
            end: b.end,
            title: roomLabelByKey[b.room] ?? b.room,
            backgroundColor: colorFromString(b.room),
            borderColor: colorFromString(b.room),
            editable: false
          }))
      );
    } catch (e) {
      setToast(extractErrorMessage(e));
    }
  }

  async function deleteSelectedBooking() {
    try {
      await deleteBooking(selectedEvent.id);
      setSelectedEvent(null);
      const bookings = await getBookings();
      setEvents(
        bookings
          .filter(b => resourceValueToKey[b.resource] === resourceKey)
          .map(b => ({
            id: b.id,
            start: b.start,
            end: b.end,
            title: roomLabelByKey[b.room] ?? b.room,
            backgroundColor: colorFromString(b.room),
            borderColor: colorFromString(b.room),
            editable: false
          }))
      );
    } catch (e) {
      setToast(extractErrorMessage(e));
    }
  }

  /* ---------- Render ---------- */

  return (
    <div className="card" style={{ maxWidth: 1100 }}>
      <h2>Buchung (Admin)</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {resources.map(r => (
          <button
            key={r.key}
            onClick={() => setResourceKey(r.key)}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 10,
              border: "none",
              background: resourceKey === r.key ? "#111" : "#e0e0e0",
              color: resourceKey === r.key ? "white" : "#111",
              fontWeight: 600
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
        selectable={!isMobile}
        select={handleSelect}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        events={events}
        locale="de"
        allDaySlot={false}
        nowIndicator
        height="auto"
        slotMinTime={`${rules.min_time}:00`}
        slotMaxTime={`${rules.max_time}:00`}
        slotDuration={`00:${rules.step_minutes}:00`}
        snapDuration={`00:${rules.step_minutes}:00`}
        headerToolbar={{
          left: "prev,next",
          center: "title",
          right: isMobile ? "" : "today"
        }}
      />

      {/* Create Modal */}
      <Modal open={!!selectedSlot} onClose={closeCreateModal}>
        {selectedSlot && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12
              }}
            >
              <h2 style={{ margin: 0, lineHeight: "24px" }}>
                Buchung erstellen
              </h2>

              <BookingInfoBox rules={rules} resourceKey={resourceKey} />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <label style={{ flex: 1 }}>
                Start
                <input
                  type="time"
                  step={rules.step_minutes * 60}
                  min={rules.min_time}
                  max={rules.max_time}
                  value={startDraft}
                  onChange={e => setStartDraft(e.target.value)}
                  onBlur={() => {
                    const snapped = snapTimeValue(
                      startDraft,
                      rules.step_minutes
                    );
                    if (!snapped) return;
                    setStartDraft(snapped);
                    setSelectedSlot(s => ({
                      ...s,
                      start: combineDateAndTime(s.start, snapped)
                    }));
                  }}
                />
              </label>

              <label style={{ flex: 1 }}>
                Ende
                <input
                  type="time"
                  step={rules.step_minutes * 60}
                  min={rules.min_time}
                  max={rules.max_time}
                  value={endDraft}
                  onChange={e => setEndDraft(e.target.value)}
                  onBlur={() => {
                    const snapped = snapTimeValue(
                      endDraft,
                      rules.step_minutes
                    );
                    if (!snapped) return;
                    setEndDraft(snapped);
                    setSelectedSlot(s => ({
                      ...s,
                      end: combineDateAndTime(s.end, snapped)
                    }));
                  }}
                />
              </label>
            </div>

            <div style={{ marginBottom: 20 }}>
              {rooms.map(r => (
                <button
                  key={r.key}
                  onClick={() => setSelectedRoom(r.key)}
                  style={{
                    marginRight: 10,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    background:
                      selectedRoom === r.key ? "#111" : "#f6f6f6",
                    color:
                      selectedRoom === r.key ? "white" : "#111"
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              disabled={!selectedRoom}
              onClick={submitBooking}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 10,
                background: selectedRoom ? "#111" : "#ccc",
                color: "white",
                border: "none"
              }}
            >
              Speichern
            </button>
          </>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!selectedEvent} onClose={() => setSelectedEvent(null)}>
        <h3>Buchung löschen?</h3>
        <p>{selectedEvent?.title}</p>
        <button
          onClick={deleteSelectedBooking}
          style={{
            background: "#c62828",
            color: "white",
            padding: "10px 16px",
            borderRadius: 8,
            border: "none"
          }}
        >
          Löschen
        </button>
      </Modal>

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
