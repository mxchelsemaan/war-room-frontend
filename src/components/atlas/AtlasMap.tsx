"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { MapEvent } from "@/data/index";

interface AtlasMapProps {
  events: MapEvent[];
}

export function AtlasMap({ events }: AtlasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamically import Leaflet so it only runs in the browser
    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [33.85, 35.86],
        zoom: 8,
        minZoom: 7,
        zoomControl: true,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      const group = L.layerGroup().addTo(map);

      mapRef.current = map;
      layerGroupRef.current = group;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // Rebuild markers whenever filtered events change
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    import("leaflet").then((L) => {
      if (!layerGroupRef.current) return;

      layerGroupRef.current.clearLayers();

      events.forEach((event) => {
        const pinHtml = `
          <div style="
            position: relative;
            width: 36px;
            height: 36px;
            background: #1e1e2e;
            border: 2px solid #334155;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          ">
            ${event.event_icon}
            <div style="
              position: absolute;
              top: -6px;
              right: -6px;
              background: #ef4444;
              color: #fff;
              font-size: 9px;
              font-weight: 700;
              font-family: sans-serif;
              line-height: 1;
              padding: 2px 4px;
              border-radius: 10px;
              min-width: 16px;
              text-align: center;
            ">${event.event_count}</div>
          </div>`;

        const icon = L.divIcon({
          html: pinHtml,
          className: "",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -22],
        });

        const marker = L.marker(
          [event.event_location.lat, event.event_location.lng],
          { icon }
        );

        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 160px;">
            <div style="font-size: 22px; text-align: center; margin-bottom: 6px;">${event.event_icon}</div>
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">${event.event_label}</div>
            <div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">📍 ${event.event_location.name}</div>
            <div style="font-size: 12px; margin-bottom: 2px;">Count: <strong>${event.event_count}</strong></div>
            <div style="font-size: 11px; color: #94a3b8;">${event.date}</div>
          </div>
        `);

        layerGroupRef.current!.addLayer(marker);
      });
    });
  }, [events]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
