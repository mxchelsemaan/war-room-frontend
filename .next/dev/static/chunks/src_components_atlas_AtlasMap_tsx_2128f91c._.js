(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/atlas/AtlasMap.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AtlasMap",
    ()=>AtlasMap
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
function AtlasMap({ events }) {
    _s();
    const containerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const mapRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const layerGroupRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Initialize map once
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AtlasMap.useEffect": ()=>{
            if (!containerRef.current || mapRef.current) return;
            // Dynamically import Leaflet so it only runs in the browser
            __turbopack_context__.A("[project]/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript, async loader)").then({
                "AtlasMap.useEffect": (L)=>{
                    if (!containerRef.current || mapRef.current) return;
                    const map = L.map(containerRef.current, {
                        center: [
                            33.85,
                            35.86
                        ],
                        zoom: 8,
                        minZoom: 7,
                        zoomControl: true
                    });
                    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                        subdomains: "abcd",
                        maxZoom: 19
                    }).addTo(map);
                    const group = L.layerGroup().addTo(map);
                    mapRef.current = map;
                    layerGroupRef.current = group;
                }
            }["AtlasMap.useEffect"]);
            return ({
                "AtlasMap.useEffect": ()=>{
                    if (mapRef.current) {
                        mapRef.current.remove();
                        mapRef.current = null;
                        layerGroupRef.current = null;
                    }
                }
            })["AtlasMap.useEffect"];
        }
    }["AtlasMap.useEffect"], []);
    // Rebuild markers whenever filtered events change
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AtlasMap.useEffect": ()=>{
            if (!mapRef.current || !layerGroupRef.current) return;
            __turbopack_context__.A("[project]/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript, async loader)").then({
                "AtlasMap.useEffect": (L)=>{
                    if (!layerGroupRef.current) return;
                    layerGroupRef.current.clearLayers();
                    events.forEach({
                        "AtlasMap.useEffect": (event)=>{
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
                                iconSize: [
                                    36,
                                    36
                                ],
                                iconAnchor: [
                                    18,
                                    18
                                ],
                                popupAnchor: [
                                    0,
                                    -22
                                ]
                            });
                            const marker = L.marker([
                                event.event_location.lat,
                                event.event_location.lng
                            ], {
                                icon
                            });
                            marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 160px;">
            <div style="font-size: 22px; text-align: center; margin-bottom: 6px;">${event.event_icon}</div>
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">${event.event_label}</div>
            <div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">📍 ${event.event_location.name}</div>
            <div style="font-size: 12px; margin-bottom: 2px;">Count: <strong>${event.event_count}</strong></div>
            <div style="font-size: 11px; color: #94a3b8;">${event.date}</div>
          </div>
        `);
                            layerGroupRef.current.addLayer(marker);
                        }
                    }["AtlasMap.useEffect"]);
                }
            }["AtlasMap.useEffect"]);
        }
    }["AtlasMap.useEffect"], [
        events
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute inset-0",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: containerRef,
            className: "w-full h-full"
        }, void 0, false, {
            fileName: "[project]/src/components/atlas/AtlasMap.tsx",
            lineNumber: 128,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/atlas/AtlasMap.tsx",
        lineNumber: 127,
        columnNumber: 5
    }, this);
}
_s(AtlasMap, "D/5bpjuIxRM2ZaZ9GCQ7SNhsmqw=");
_c = AtlasMap;
var _c;
__turbopack_context__.k.register(_c, "AtlasMap");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/atlas/AtlasMap.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/atlas/AtlasMap.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_components_atlas_AtlasMap_tsx_2128f91c._.js.map