import { useEffect, useRef, useState } from "react";
import type { Circle, Map } from "leaflet";

export function EventLocationPicker({
  latitude,
  longitude,
}: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const circle = useRef<Circle | null>(null);
  const [lat, setLat] = useState(String(latitude ?? ""));
  const [lng, setLng] = useState(String(longitude ?? ""));
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet")
      .then((leaflet) => {
        if (cancelled || !container.current) return;
        const hasPoint = latitude != null && longitude != null;
        const view = leaflet
          .map(container.current)
          .setView(
            hasPoint ? [latitude, longitude] : [-14.2, -51.9],
            hasPoint ? 17 : 4,
          );
        map.current = view;
        leaflet
          .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            referrerPolicy: "strict-origin-when-cross-origin",
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          })
          .addTo(view);
        circle.current = leaflet.circle([0, 0], { radius: 100 });
        view.on("click", ({ latlng }) => {
          const point = latlng.wrap();
          setLat(point.lat.toFixed(6));
          setLng(point.lng.toFixed(6));
          if (view.getZoom() < 16) view.setView(point, 16);
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      circle.current = null;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const view = map.current;
    const radius = circle.current;
    if (!ready || !view || !radius) return;
    if (
      lat &&
      lng &&
      Math.abs(Number(lat)) <= 90 &&
      Math.abs(Number(lng)) <= 180
    )
      radius.setLatLng([Number(lat), Number(lng)]).addTo(view);
    else radius.remove();
  }, [ready, lat, lng]);

  return (
    <fieldset className="event-location-picker">
      <legend>Localização do check-in</legend>
      <p>
        Clique no mapa para selecionar o local. O círculo mostra o raio de 100
        m.
      </p>
      <div
        ref={container}
        className="event-location-map"
        role="region"
        aria-label="Mapa do local do evento"
      />
      {mapError && (
        <p role="status">
          O mapa está indisponível. Preencha as coordenadas abaixo.
        </p>
      )}
      <label className="field">
        <span>Latitude do local</span>
        <input
          name="latitude"
          type="number"
          step="any"
          min={-90}
          max={90}
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>Longitude do local</span>
        <input
          name="longitude"
          type="number"
          step="any"
          min={-180}
          max={180}
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          required
        />
      </label>
    </fieldset>
  );
}
