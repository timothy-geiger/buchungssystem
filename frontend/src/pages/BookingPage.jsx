import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import { getBookings, createBooking, getEnums } from "../api";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import BookingInfoBox from "../components/BookingInfoBox";

/* ======================
   Helpers
   ====================== */

function colorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${(Math.abs(hash) * 137.508) % 360}, 70%, 50%)`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

function buildDisabledBackgroundEvents(rules, resourceKey) {
  if (!rules || !resourceKey) return [];

  const now = new Date();
  const minAllowed = getMinAllowedDate(rules, resourceKey);

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const farPast = new Date(2000, 0, 1);

  return [
    // past days + earlier today
    {
      id: "disabled-past",
      start: farPast,
      end: startOfToday,
      display: "background",
      classNames: ["fc-disabled-range"],
    },

    // today buffer
    {
      id: "disabled-buffer",
      start: startOfToday,
      end: minAllowed,
      display: "background",
      classNames: ["fc-disabled-range"],
    },
  ];
}


/* ======================
   CET-safe local ISO
   ====================== */

function toLocalISOString(date) {
  const pad = n => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
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
   Buffer helpers
   ====================== */

function getBufferMinutes(rules, resourceKey) {
  return rules?.resource_rules?.[resourceKey]?.buffer_minutes ?? 0;
}

function getMinAllowedDate(rules, resourceKey) {
  const bufferMinutes = getBufferMinutes(rules, resourceKey);
  const now = new Date();

  const buffered = new Date(
    now.getTime() + bufferMinutes * 60000
  );

  buffered.setMinutes(
    Math.ceil(buffered.getMinutes() / rules.step_minutes) *
      rules.step_minutes,
    0,
    0
  );

  return buffered;
}

/* ======================
   Page
   ====================== */

export default function BookingPage() {
  const [resources, setResources] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [rules, setRules] = useState(null);
  const [resourceKey, setResourceKey] = useState(null);

  const [events, setEvents] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
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

  const minAllowedDate =
    rules && resourceKey
      ? getMinAllowedDate(rules, resourceKey)
      : null;

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
              id: `${b.start}-${b.room}`,
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
    if (minAllowedDate && info.start < minAllowedDate) return;

    setSelectedSlot({
      start: toLocalISOString(new Date(info.start)),
      end: toLocalISOString(new Date(info.end))
    });
  }

  function handleDateClick(info) {
    if (!isMobile) return;
    if (minAllowedDate && info.date < minAllowedDate) return;

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

  function closeModal() {
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
      closeModal();
      const bookings = await getBookings();
      setEvents(
        bookings
          .filter(b => resourceValueToKey[b.resource] === resourceKey)
          .map(b => ({
            id: `${b.start}-${b.room}`,
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
    <div className="card" style={{ maxWidth: 1000 }}>
      <h2>Buchung</h2>

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
        events={[...events, ...buildDisabledBackgroundEvents(rules, resourceKey)]}
        locale="de"
        allDaySlot={false}
        nowIndicator
        height="auto"
        slotMinTime={`${rules.min_time}:00`}
        slotMaxTime={`${rules.max_time}:00`}
        slotDuration={`00:${rules.step_minutes}:00`}
        snapDuration={`00:${rules.step_minutes}:00`}
        slotLaneClassNames={arg => {
          if (!minAllowedDate) return [];

          const slotTime = arg.date;
          const now = new Date();

          const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );

          const startOfSlotDay = new Date(
            slotTime.getFullYear(),
            slotTime.getMonth(),
            slotTime.getDate()
          );

          // 1️⃣ Past days → fully disabled
          if (startOfSlotDay < startOfToday) {
            return ["fc-slot-disabled"];
          }

          // 2️⃣ Today → disable only until buffer time
          if (isSameDay(slotTime, now) && slotTime < minAllowedDate) {
            return ["fc-slot-disabled"];
          }

          // 3️⃣ Future days → fully enabled
          return [];
        }}

        headerToolbar={{
          left: "prev,next",
          center: "title",
          right: isMobile ? "" : "today"
        }}
      />

      <Modal open={!!selectedSlot} onClose={closeModal}>
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
                  min={
                    minAllowedDate
                      ? toLocalTimeValue(minAllowedDate)
                      : rules.min_time
                  }
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
                      selectedRoom === r.key ? "#f6f6f6" : "#111"
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
              Buchung speichern
            </button>
          </>
        )}
      </Modal>

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
