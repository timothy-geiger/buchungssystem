let sessionToken = null;

export function setSession(token) {
  sessionToken = token;
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: sessionToken } : {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unbekannter Fehler");
  }

  return res.json();
}

export function login(password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ password })
  });
}

export function getBookings() {
  return request("/bookings/");
}

export function createBooking(data) {
  return request("/bookings/", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function deleteBooking(id) {
  return request(`/bookings/${id}`, {
    method: "DELETE"
  });
}

export function getEnums() {
  return request("/bookings/enums");
}
